import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { customers, salesNotes } from "../../drizzle/schema";
import { crmProcedure } from "../_core/trpc";
import { assertCanAccessCustomer, getCustomerOrThrow } from "../_core/permissions";
import { logActivity } from "../_core/activityLogger";

const noteTypeEnum = z.enum(["call", "whatsapp", "email", "meeting", "follow_up"]);
const outcomeEnum = z.enum(["interested", "thinking", "not_interested", "qualified", "unqualified"]);

// Outcomes that automatically move the parent customer's qualification/interest fields.
const OUTCOME_TO_INTEREST: Record<string, "interested" | "thinking" | "not_interested" | undefined> = {
  interested: "interested",
  thinking: "thinking",
  not_interested: "not_interested",
};
const OUTCOME_TO_QUALIFIED: Record<string, boolean | undefined> = {
  qualified: true,
  unqualified: false,
};

export const salesNotesRouter = {
  listByCustomer: crmProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(salesNotes)
        .where(eq(salesNotes.customerId, input.customerId))
        .orderBy(asc(salesNotes.createdAt));
    }),

  /**
   * Add a note about a call/WhatsApp/email/meeting. If an outcome is given,
   * the parent customer's interest/qualification is updated automatically —
   * this is the "first call note stays attached and drives status" flow from
   * the PRD.
   */
  create: crmProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        note: z.string().min(1),
        noteType: noteTypeEnum,
        outcome: outcomeEnum.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await getCustomerOrThrow(input.customerId);
      await assertCanAccessCustomer(ctx.user, customer);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inserted] = await db
        .insert(salesNotes)
        .values({
          customerId: input.customerId,
          createdBySalesId: ctx.user.id,
          note: input.note,
          noteType: input.noteType,
          outcome: input.outcome,
        })
        .$returningId();

      if (input.outcome) {
        const interestLevel = OUTCOME_TO_INTEREST[input.outcome];
        const isQualified = OUTCOME_TO_QUALIFIED[input.outcome];

        const patch: Record<string, unknown> = {};
        if (interestLevel) patch.interestLevel = interestLevel;
        if (isQualified !== undefined) {
          patch.isQualified = isQualified;
          patch.status = isQualified ? "qualified" : "unqualified";
        }

        if (Object.keys(patch).length > 0) {
          await db.update(customers).set(patch).where(eq(customers.id, input.customerId));
        }
      }

      await logActivity({
        userId: ctx.user.id,
        customerId: input.customerId,
        action: "sales_note_created",
        description: `${input.noteType} note added`,
        metadata: { noteType: input.noteType, outcome: input.outcome },
      });

      return { id: inserted.id };
    }),
};
