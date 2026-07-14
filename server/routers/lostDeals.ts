import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { customers, lostDeals } from "../../drizzle/schema";
import { crmProcedure, salesManagerProcedure } from "../_core/trpc";
import { assertCanAccessCustomer, getCustomerOrThrow } from "../_core/permissions";
import { logActivity } from "../_core/activityLogger";

const reasonCategoryEnum = z.enum([
  "customer_not_interested",
  "financing_rejected",
  "found_competitor",
  "price_issue",
  "timing_issue",
  "other",
]);

export const lostDealsRouter = {
  /**
   * Any sales rep (or above) can close their own customer as lost — this is
   * "any closing of a customer has a specific reason" from the PRD. The
   * resulting record feeds the sales_manager-only Lost Deals repository.
   */
  create: crmProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        reason: z.string().min(1),
        reasonCategory: reasonCategoryEnum,
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inserted] = await db
        .insert(lostDeals)
        .values({
          customerId: input.customerId,
          closedBySalesId: ctx.user.id,
          reason: input.reason,
          reasonCategory: input.reasonCategory,
          notes: input.notes,
        })
        .$returningId();

      await db.update(customers).set({ status: "closed_lost" }).where(eq(customers.id, input.customerId));

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "customer_marked_lost",
        metadata: { reasonCategory: input.reasonCategory },
      });

      return { id: inserted.id };
    }),

  /** Sales-manager-only repository view, per "التيم ليدر يرى تقارير فريقه فقط؛ السيلز لا يرى". */
  list: salesManagerProcedure
    .input(z.object({ reasonCategory: reasonCategoryEnum.optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db.select().from(lostDeals).orderBy(desc(lostDeals.createdAt));
      if (input?.reasonCategory) {
        return rows.filter((r) => r.reasonCategory === input.reasonCategory);
      }
      return rows;
    }),

  /** Move a lost customer back into the active pipeline for another attempt. */
  reengage: salesManagerProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.update(customers).set({ status: "new_lead" }).where(eq(customers.id, input.customerId));

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "customer_reengaged",
      });
      return { success: true } as const;
    }),

  /** Permanently exclude — keeps status closed_lost but marks inactive so it stops surfacing for re-engagement. */
  exclude: salesManagerProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.update(customers).set({ status: "inactive" }).where(eq(customers.id, input.customerId));

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "customer_excluded",
      });
      return { success: true } as const;
    }),
};
