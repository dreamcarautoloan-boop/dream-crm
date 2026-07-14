import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { customers, users } from "../../drizzle/schema";
import { crmProcedure, teamLeaderProcedure } from "../_core/trpc";
import { assertCanAccessCustomer, canReassignCustomers, getCustomerOrThrow, isSalesManager } from "../_core/permissions";
import { logActivity } from "../_core/activityLogger";

const customerStatusEnum = z.enum([
  "new_lead",
  "qualified",
  "unqualified",
  "in_progress",
  "sales_opportunity",
  "closed_won",
  "closed_lost",
  "inactive",
]);

const interestLevelEnum = z.enum(["interested", "thinking", "not_interested"]);

export const customersRouter = {
  /**
   * List customers scoped to the caller's role:
   * - sales_manager: everyone
   * - team_leader: everyone on their team
   * - sales: only their own customers
   */
  list: crmProcedure
    .input(
      z.object({
        status: customerStatusEnum.optional(),
        search: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [] as any[];

      if (ctx.user.role === "sales") {
        conditions.push(eq(customers.assignedToSalesId, ctx.user.id));
      } else if (ctx.user.role === "team_leader") {
        // Team leaders see customers assigned to any sales rep on their team,
        // plus any they personally own.
        const teamMembers = ctx.user.teamId
          ? await db.select({ id: users.id }).from(users).where(eq(users.teamId, ctx.user.teamId))
          : [];
        const teamIds = teamMembers.map((m) => m.id);
        if (!teamIds.includes(ctx.user.id)) teamIds.push(ctx.user.id);
        if (teamIds.length === 0) return [];
        conditions.push(inArray(customers.assignedToSalesId, teamIds));
      }
      // sales_manager and moderator: no owner restriction (moderator manages intake, read access here is fine)

      if (input?.status) {
        conditions.push(eq(customers.status, input.status));
      }

      const rows = await db
        .select()
        .from(customers)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(customers.createdAt));

      if (input?.search) {
        const term = input.search.trim().toLowerCase();
        return rows.filter(
          (c) =>
            c.firstName.toLowerCase().includes(term) ||
            c.lastName.toLowerCase().includes(term) ||
            c.phone.includes(term),
        );
      }

      return rows;
    }),

  getById: crmProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.id);
      await assertCanAccessCustomer(ctx.user, customer);
      return customer;
    }),

  /**
   * Create a new customer/lead. Automatically flags likely duplicates by
   * phone number instead of silently rejecting — a human (moderator/team
   * leader) makes the final call per the PRD's duplicate-prevention flow.
   */
  create: crmProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().min(5),
        email: z.string().email().optional(),
        sourceId: z.number().int().positive(),
        assignedToSalesId: z.number().int().positive().optional(),
        externalId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // A plain "sales" rep can only create leads assigned to themselves.
      let assignedToSalesId = input.assignedToSalesId ?? ctx.user.id;
      if (ctx.user.role === "sales" && assignedToSalesId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sales reps can only create their own leads" });
      }

      const existing = await db.select().from(customers).where(eq(customers.phone, input.phone));
      const isDuplicate = existing.length > 0;

      const [inserted] = await db
        .insert(customers)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          email: input.email,
          sourceId: input.sourceId,
          assignedToSalesId,
          externalId: input.externalId,
          isDuplicate,
          duplicateOfId: isDuplicate ? existing[0].id : null,
        })
        .$returningId();

      await logActivity({
        userId: ctx.user.id,
        customerId: inserted.id,
        action: "customer_created",
        description: `Created customer ${input.firstName} ${input.lastName}`,
        metadata: { isDuplicate },
      });

      return { id: inserted.id, isDuplicate };
    }),

  /**
   * Update qualification / interest / pipeline status for a customer the
   * caller has access to. Sending installment docs is what actually moves a
   * customer to "sales_opportunity" (see installments.ts), so that specific
   * transition is blocked here to keep the workflow enforced server-side.
   */
  updateStatus: crmProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: customerStatusEnum.optional(),
        isQualified: z.boolean().optional(),
        interestLevel: interestLevelEnum.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.id);
      await assertCanAccessCustomer(ctx.user, customer);

      if (input.status === "sales_opportunity") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "sales_opportunity is set automatically when an installment application is created",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(customers)
        .set({
          ...(input.status ? { status: input.status } : {}),
          ...(input.isQualified !== undefined ? { isQualified: input.isQualified } : {}),
          ...(input.interestLevel ? { interestLevel: input.interestLevel } : {}),
        })
        .where(eq(customers.id, input.id));

      await logActivity({
        userId: ctx.user.id,
        customerId: input.id,
        action: "customer_status_updated",
        metadata: { status: input.status, isQualified: input.isQualified, interestLevel: input.interestLevel },
      });

      return { success: true } as const;
    }),

  /**
   * Reassign a customer from one sales rep to another.
   * team_leader: only within their own team. sales_manager: anywhere.
   */
  reassign: teamLeaderProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        newSalesId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!canReassignCustomers(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot reassign customers" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const customer = await getCustomerOrThrow(input.id);
      await assertCanAccessCustomer(ctx.user, customer);

      const [newOwner] = await db.select().from(users).where(eq(users.id, input.newSalesId)).limit(1);
      if (!newOwner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target sales rep not found" });
      }

      if (!isSalesManager(ctx.user) && newOwner.teamId !== ctx.user.teamId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Can only reassign within your own team" });
      }

      await db.update(customers).set({ assignedToSalesId: input.newSalesId }).where(eq(customers.id, input.id));

      await logActivity({
        userId: ctx.user.id,
        customerId: input.id,
        action: "customer_reassigned",
        metadata: { from: customer.assignedToSalesId, to: input.newSalesId },
      });

      return { success: true } as const;
    }),
};
