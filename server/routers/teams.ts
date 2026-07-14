import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { teams, users } from "../../drizzle/schema";
import { crmProcedure, salesManagerProcedure } from "../_core/trpc";

export const teamsRouter = {
  list: crmProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(teams);
  }),

  create: salesManagerProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inserted] = await db.insert(teams).values({ name: input.name, description: input.description }).$returningId();
      return { id: inserted.id };
    }),

  /** Members of a team, used by team-leader "assign customer" and dashboards. */
  members: crmProcedure
    .input(z.object({ teamId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(users).where(eq(users.teamId, input.teamId));
    }),
};
