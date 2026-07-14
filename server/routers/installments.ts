import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { customers, installmentApplications, installmentPartners } from "../../drizzle/schema";
import { crmProcedure } from "../_core/trpc";
import { assertCanAccessCustomer, getCustomerOrThrow } from "../_core/permissions";
import { logActivity } from "../_core/activityLogger";

const applicationStatusEnum = z.enum(["submitted", "pending", "approved", "rejected", "customer_rejected"]);

export const installmentsRouter = {
  listPartners: crmProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(installmentPartners).where(eq(installmentPartners.isActive, true));
  }),

  listByCustomer: crmProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) return [];
      return db.select().from(installmentApplications).where(eq(installmentApplications.customerId, input.customerId));
    }),

  /**
   * Submitting installment docs → creates the application AND moves the
   * customer to "sales_opportunity" automatically, per the PRD workflow.
   */
  create: crmProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        partnerId: z.number().int().positive(),
        loanAmount: z.number().positive().optional(),
        monthlyPayment: z.number().positive().optional(),
        duration: z.number().int().positive().optional(),
        requiredDocuments: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inserted] = await db
        .insert(installmentApplications)
        .values({
          customerId: input.customerId,
          partnerId: input.partnerId,
          loanAmount: input.loanAmount?.toString(),
          monthlyPayment: input.monthlyPayment?.toString(),
          duration: input.duration,
          requiredDocuments: input.requiredDocuments ? JSON.stringify(input.requiredDocuments) : undefined,
        })
        .$returningId();

      await db.update(customers).set({ status: "sales_opportunity" }).where(eq(customers.id, input.customerId));

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "installment_application_created",
        metadata: { partnerId: input.partnerId },
      });

      return { id: inserted.id };
    }),

  /**
   * Update the outcome of an application: approved / pending (missing docs)
   * / rejected / customer_rejected. Approval is what unlocks creating a
   * Sales Opportunity (inspection/quote → contract → registration).
   */
  updateStatus: crmProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: applicationStatusEnum,
        reason: z.string().optional(),
        submittedDocuments: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [application] = await db
        .select()
        .from(installmentApplications)
        .where(eq(installmentApplications.id, input.id))
        .limit(1);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

      const customer = await getCustomerOrThrow(application.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      await db
        .update(installmentApplications)
        .set({
          status: input.status,
          reason: input.reason,
          submittedDocuments: input.submittedDocuments ? JSON.stringify(input.submittedDocuments) : undefined,
        })
        .where(eq(installmentApplications.id, input.id));

      // "Customer rejected continuing" or a hard rejection should not silently
      // leave the customer sitting in sales_opportunity with no path forward —
      // sales still closes it explicitly via lostDeals.create with a reason,
      // so we intentionally do NOT auto-close the customer here.

      await logActivity({
        userId: ctx.user.id,
        customerId: application.customerId,
        action: "installment_application_status_updated",
        metadata: { status: input.status },
      });

      return { success: true } as const;
    }),
};
