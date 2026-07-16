import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { customers, users, leadSources, salesNotes, followUps, lostDeals } from "../../drizzle/schema";
import { crmProcedure, leadIntakeProcedure, salesManagerProcedure, teamLeaderProcedure } from "../_core/trpc";
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

  /**
   * Bulk-create leads parsed client-side from an uploaded Excel/CSV sheet.
   * Every row is assigned to the same sales rep (the person distributing the
   * sheet picks who gets it). Duplicate phone numbers are flagged exactly
   * like single `create`, never silently dropped, so nothing gets lost.
   */
  bulkImport: leadIntakeProcedure
    .input(
      z.object({
        sourceId: z.number().int().positive(),
        assignedToSalesId: z.number().int().positive(),
        rows: z
          .array(
            z.object({
              firstName: z.string().min(1),
              lastName: z.string().min(1),
              phone: z.string().min(5),
              email: z.string().email().optional().or(z.literal("")),
            }),
          )
          .min(1)
          .max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!isSalesManager(ctx.user)) {
        const [target] = await db.select().from(users).where(eq(users.id, input.assignedToSalesId)).limit(1);
        if (!target || target.teamId !== ctx.user.teamId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Can only import leads for your own team" });
        }
      }

      const existingPhones = new Set(
        (await db.select({ phone: customers.phone }).from(customers)).map((c) => c.phone),
      );

      let imported = 0;
      let duplicates = 0;

      for (const row of input.rows) {
        const isDuplicate = existingPhones.has(row.phone);
        await db.insert(customers).values({
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone,
          email: row.email || undefined,
          sourceId: input.sourceId,
          assignedToSalesId: input.assignedToSalesId,
          isDuplicate,
        });
        existingPhones.add(row.phone);
        if (isDuplicate) duplicates++;
        else imported++;
      }

      await logActivity({
        userId: ctx.user.id,
        action: "customers_bulk_imported",
        metadata: { imported, duplicates, assignedToSalesId: input.assignedToSalesId },
      });

      return { imported, duplicates, total: input.rows.length };
    }),

  /**
   * One-time historical migration from a legacy tracking sheet. Unlike
   * `bulkImport`, each row carries its own status/qualification/interest/
   * note/follow-up/lost-deal info (already cleaned client-side from the old
   * sheet) and is routed to a specific sales rep by username — so this
   * reconstructs real history instead of dumping everything as fresh leads.
   * sales_manager only, since it can create accounts' worth of historical
   * data across the whole team at once.
   */
  legacyImport: salesManagerProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              salesRepUsername: z.string(),
              firstName: z.string().min(1),
              lastName: z.string(),
              phone: z.string().min(5),
              sourceKey: z.enum(["existing_customer", "facebook_leads", "referral", "external_call"]),
              status: customerStatusEnum,
              isQualified: z.boolean().nullable().optional(),
              interestLevel: interestLevelEnum.nullable().optional(),
              note: z.string().optional(),
              nextFollowUp: z.coerce.date().nullable().optional(),
              isLost: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const allUsers = await db.select().from(users);
      const userByUsername = new Map(allUsers.map((u) => [u.username, u]));

      const allSources = await db.select().from(leadSources);
      const sourceByKey = new Map(allSources.map((s) => [s.name, s.id]));

      const existingPhones = new Set(
        (await db.select({ phone: customers.phone }).from(customers)).map((c) => c.phone),
      );

      let imported = 0;
      let duplicates = 0;
      const skippedUnknownRep = new Set<string>();

      for (const row of input.rows) {
        const rep = userByUsername.get(row.salesRepUsername);
        if (!rep) {
          skippedUnknownRep.add(row.salesRepUsername);
          continue;
        }
        const sourceId = sourceByKey.get(row.sourceKey);
        if (!sourceId) continue;

        const isDuplicate = existingPhones.has(row.phone);
        const [inserted] = await db
          .insert(customers)
          .values({
            firstName: row.firstName,
            lastName: row.lastName || row.firstName,
            phone: row.phone,
            sourceId,
            assignedToSalesId: rep.id,
            status: row.status,
            isQualified: row.isQualified ?? undefined,
            interestLevel: row.interestLevel ?? undefined,
            isDuplicate,
          })
          .$returningId();
        existingPhones.add(row.phone);
        if (isDuplicate) duplicates++;
        else imported++;

        if (row.note) {
          await db.insert(salesNotes).values({
            customerId: inserted.id,
            createdBySalesId: rep.id,
            note: row.note,
            noteType: "call",
          });
        }

        if (row.nextFollowUp) {
          await db.insert(followUps).values({
            customerId: inserted.id,
            assignedToSalesId: rep.id,
            scheduledDate: row.nextFollowUp,
          });
        }

        if (row.isLost) {
          await db.insert(lostDeals).values({
            customerId: inserted.id,
            closedBySalesId: rep.id,
            reason: row.note?.slice(0, 500) || "Imported from legacy sheet",
            reasonCategory: "other",
          });
        }
      }

      await logActivity({
        userId: ctx.user.id,
        action: "legacy_customers_imported",
        metadata: { imported, duplicates, skippedUnknownRep: Array.from(skippedUnknownRep) },
      });

      return { imported, duplicates, total: input.rows.length, skippedUnknownRep: Array.from(skippedUnknownRep) };
    }),
};
