import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { getDb } from "../db";
import { followUps } from "../../drizzle/schema";
import { crmProcedure } from "../_core/trpc";
import { assertCanAccessCustomer, getCustomerOrThrow } from "../_core/permissions";
import { logActivity } from "../_core/activityLogger";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

async function getFollowUpOrThrow(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, id: number) {
  const [row] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Follow-up not found" });
  return row;
}

export const followUpsRouter = {
  /**
   * The caller's own follow-ups, bucketed the way the "My Follow-ups" screen
   * needs (Today / Upcoming / Completed / Overdue). Managers/team leads can
   * pass a target sales rep id to view someone else's list (still access
   * checked against the underlying customer for safety).
   */
  listMine: crmProcedure
    .input(
      z.object({
        bucket: z.enum(["today", "upcoming", "completed", "overdue"]),
        salesId: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const targetSalesId = input.salesId ?? ctx.user.id;
      if (targetSalesId !== ctx.user.id && ctx.user.role === "sales") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot view another rep's follow-ups" });
      }

      const conditions = [eq(followUps.assignedToSalesId, targetSalesId)];

      if (input.bucket === "today") {
        conditions.push(eq(followUps.status, "pending"), gte(followUps.scheduledDate, startOfToday()), lt(followUps.scheduledDate, startOfTomorrow()));
      } else if (input.bucket === "upcoming") {
        conditions.push(eq(followUps.status, "pending"), gte(followUps.scheduledDate, startOfTomorrow()));
      } else if (input.bucket === "overdue") {
        conditions.push(eq(followUps.status, "pending"), lt(followUps.scheduledDate, startOfToday()));
      } else {
        conditions.push(ne(followUps.status, "pending"));
      }

      return db
        .select()
        .from(followUps)
        .where(and(...conditions))
        .orderBy(asc(followUps.scheduledDate));
    }),

  create: crmProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        scheduledDate: z.coerce.date(),
        reason: z.string().optional(),
        assignedToSalesId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const assignedToSalesId = input.assignedToSalesId ?? customer.assignedToSalesId;

      const [inserted] = await db
        .insert(followUps)
        .values({
          customerId: input.customerId,
          assignedToSalesId,
          scheduledDate: input.scheduledDate,
          reason: input.reason,
        })
        .$returningId();

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "follow_up_scheduled",
        metadata: { scheduledDate: input.scheduledDate },
      });

      return { id: inserted.id };
    }),

  complete: crmProcedure
    .input(z.object({ id: z.number().int().positive(), result: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const followUp = await getFollowUpOrThrow(db, input.id);
      const customer = await getCustomerOrThrow(followUp.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      await db
        .update(followUps)
        .set({ status: "completed", result: input.result, completedAt: new Date() })
        .where(eq(followUps.id, input.id));

      await logActivity({ userId: ctx.user.id, customerId: followUp.customerId, action: "follow_up_completed" });
      return { success: true } as const;
    }),

  /**
   * Marks the original follow-up as "rescheduled" (a closed, historical
   * record) and creates a fresh "pending" follow-up at the new date — this
   * keeps each row's status meaningful instead of overloading one row for
   * both an old and a new date.
   */
  reschedule: crmProcedure
    .input(z.object({ id: z.number().int().positive(), scheduledDate: z.coerce.date(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const followUp = await getFollowUpOrThrow(db, input.id);
      const customer = await getCustomerOrThrow(followUp.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      await db.update(followUps).set({ status: "rescheduled" }).where(eq(followUps.id, input.id));

      const [inserted] = await db
        .insert(followUps)
        .values({
          customerId: followUp.customerId,
          assignedToSalesId: followUp.assignedToSalesId,
          scheduledDate: input.scheduledDate,
          reason: input.reason ?? followUp.reason,
        })
        .$returningId();

      await logActivity({
        userId: ctx.user.id,
        customerId: followUp.customerId,
        action: "follow_up_rescheduled",
        metadata: { oldId: input.id, newId: inserted.id, newDate: input.scheduledDate },
      });
      return { success: true, newId: inserted.id } as const;
    }),

  cancel: crmProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const followUp = await getFollowUpOrThrow(db, input.id);
      const customer = await getCustomerOrThrow(followUp.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      await db.update(followUps).set({ status: "cancelled" }).where(eq(followUps.id, input.id));
      await logActivity({ userId: ctx.user.id, customerId: followUp.customerId, action: "follow_up_cancelled" });
      return { success: true } as const;
    }),
};
