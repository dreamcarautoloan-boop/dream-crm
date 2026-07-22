import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { customers, installmentApplications, salesNotes, salesOpportunities } from "../../drizzle/schema";
import { crmProcedure } from "../_core/trpc";
import { assertCanAccessCustomer, getCustomerOrThrow } from "../_core/permissions";
import { logActivity } from "../_core/activityLogger";

const stageEnum = z.enum([
  "inspection_pending",
  "quote_pending",
  "contract_pending",
  "registration_pending",
  "completed",
  "cancelled",
]);

export const salesOpportunitiesRouter = {
  getByCustomer: crmProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(salesOpportunities)
        .where(eq(salesOpportunities.customerId, input.customerId))
        .limit(1);
      return row ?? null;
    }),

  /**
   * Only creatable once the linked installment application is "approved" —
   * enforces the PRD's "on approval: inspection/quote → contract → license"
   * flow at the server, not just the UI.
   */
  create: crmProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        installmentApplicationId: z.number().int().positive(),
        vehicleType: z.enum(["new", "used"]),
        vehicleModel: z.string().optional(),
        vehiclePrice: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [application] = await db
        .select()
        .from(installmentApplications)
        .where(eq(installmentApplications.id, input.installmentApplicationId))
        .limit(1);
      if (!application || application.customerId !== input.customerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Installment application not found for this customer" });
      }
      if (application.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Installment application must be approved first" });
      }

      const initialStatus = input.vehicleType === "used" ? "inspection_pending" : "quote_pending";

      const [inserted] = await db
        .insert(salesOpportunities)
        .values({
          customerId: input.customerId,
          installmentApplicationId: input.installmentApplicationId,
          vehicleType: input.vehicleType,
          vehicleModel: input.vehicleModel,
          vehiclePrice: input.vehiclePrice?.toString(),
          status: initialStatus,
        })
        .$returningId();

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "sales_opportunity_created",
        metadata: { vehicleType: input.vehicleType },
      });

      return { id: inserted.id };
    }),

  /**
   * Advance/update a stage. When moved to "completed", the parent customer
   * is automatically flipped to closed_won (sale done + licensed).
   */
  updateStage: crmProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: stageEnum,
        inspectionResult: z.string().optional(),
        quoteDetails: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [opportunity] = await db.select().from(salesOpportunities).where(eq(salesOpportunities.id, input.id)).limit(1);
      if (!opportunity) throw new TRPCError({ code: "NOT_FOUND", message: "Sales opportunity not found" });

      const customer = await getCustomerOrThrow(opportunity.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const now = new Date();
      const patch: Record<string, unknown> = { status: input.status };

      if (input.status === "inspection_pending" && input.inspectionResult) {
        patch.inspectionResult = input.inspectionResult;
        patch.inspectionDate = now;
      }
      if (input.status === "quote_pending" && input.quoteDetails) {
        patch.quoteDetails = input.quoteDetails;
        patch.quoteDate = now;
      }
      if (input.status === "contract_pending") {
        patch.contractSignedDate = now;
      }
      if (input.status === "registration_pending") {
        patch.registrationDate = now;
      }

      await db.update(salesOpportunities).set(patch).where(eq(salesOpportunities.id, input.id));

      // Record the rep's note about this stage transition so it shows up in
      // the customer's regular notes timeline too, not just buried in the
      // opportunity record.
      if (input.note?.trim()) {
        await db.insert(salesNotes).values({
          customerId: opportunity.customerId,
          createdBySalesId: ctx.user.id,
          note: input.note.trim(),
          noteType: "follow_up",
        });
      }

      if (input.status === "completed") {
        await db.update(customers).set({ status: "closed_won" }).where(eq(customers.id, opportunity.customerId));
      }

      await logActivity({
        userId: ctx.user.id,
        customerId: opportunity.customerId,
        action: "sales_opportunity_stage_updated",
        metadata: { status: input.status },
      });

      return { success: true } as const;
    }),
};
