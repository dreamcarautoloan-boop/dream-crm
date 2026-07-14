import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { crmProcedure, salesManagerProcedure } from "../_core/trpc";
import { hashPassword, isPasswordStrongEnough } from "../_core/password";
import { logActivity } from "../_core/activityLogger";

const roleEnum = z.enum(["sales_manager", "team_leader", "sales", "moderator"]);

export const usersRouter = {
  /** Directory of active team members — used for assignment pickers etc. */
  list: crmProcedure
    .input(z.object({ role: roleEnum.optional(), teamId: z.number().int().positive().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db.select().from(users);
      return rows
        .filter((u) => (input?.role ? u.role === input.role : true))
        .filter((u) => (input?.teamId ? u.teamId === input.teamId : true))
        .map(({ passwordHash: _passwordHash, ...safe }) => safe);
    }),

  /**
   * "مدير المبيعات: إضافة سيلز جديد" — only sales_manager may onboard a new
   * team member (sales, team_leader, or moderator). Password is set here and
   * the user logs in with it directly (see app/login.tsx).
   */
  create: salesManagerProcedure
    .input(
      z.object({
        username: z.string().min(3),
        password: z.string().min(8),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        role: roleEnum,
        teamId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isPasswordStrongEnough(input.password)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password must be at least 8 characters" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [existing] = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
      }

      const [inserted] = await db
        .insert(users)
        .values({
          openId: `local:${input.username}`,
          username: input.username,
          passwordHash: hashPassword(input.password),
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: input.role,
          teamId: input.teamId,
        })
        .$returningId();

      await logActivity({
        userId: ctx.user.id,
        action: "user_created",
        description: `Created ${input.role} account: ${input.username}`,
      });

      return { id: inserted.id };
    }),

  /** Activate/deactivate an account (e.g. offboarding a sales rep). */
  setActive: salesManagerProcedure
    .input(z.object({ userId: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));

      await logActivity({
        userId: ctx.user.id,
        action: input.isActive ? "user_activated" : "user_deactivated",
        metadata: { targetUserId: input.userId },
      });
      return { success: true } as const;
    }),
};
