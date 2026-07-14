import { getDb } from "../db";
import { leadSources } from "../../drizzle/schema";
import { crmProcedure } from "../_core/trpc";

export const leadSourcesRouter = {
  list: crmProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(leadSources);
  }),
};
