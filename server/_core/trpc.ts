import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { User } from "../../drizzle/schema";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "sales_manager") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * CRM role-gated procedures.
 * Roles: sales_manager (full access to everything) > team_leader > sales | moderator
 * (moderator is a peer of sales/team_leader for lead intake, not a superset).
 */
function requireRole(...allowedRoles: User["role"][]) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (!ctx.user.isActive) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Account is deactivated" });
    }

    // sales_manager always has full access regardless of the specific allow-list.
    if (ctx.user.role !== "sales_manager" && !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });
}

/** sales_manager only (alias kept for readability next to the other CRM procedures). */
export const salesManagerProcedure = adminProcedure;

/** sales_manager + team_leader */
export const teamLeaderProcedure = t.procedure.use(requireRole("team_leader"));

/** sales_manager + moderator */
export const moderatorProcedure = t.procedure.use(requireRole("moderator"));

/** sales_manager + team_leader + sales (anyone who works customers day-to-day) */
export const salesProcedure = t.procedure.use(requireRole("team_leader", "sales"));

/** sales_manager + team_leader + moderator — lead intake roles (manual entry, bulk import). */
export const leadIntakeProcedure = t.procedure.use(requireRole("team_leader", "moderator"));

/** Any authenticated, active CRM user regardless of role. */
export const crmProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!ctx.user.isActive) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Account is deactivated" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
