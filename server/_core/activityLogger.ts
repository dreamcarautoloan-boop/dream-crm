import { getDb } from "../db";
import { activityLog } from "../../drizzle/schema";

/**
 * Fire-and-forget audit log write. Never throws — logging must not break the
 * user-facing mutation it's attached to. Call this *after* the main write
 * succeeds.
 */
export async function logActivity(params: {
  userId: number;
  customerId?: number | null;
  action: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(activityLog).values({
      userId: params.userId,
      customerId: params.customerId ?? null,
      action: params.action,
      description: params.description ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (error) {
    console.error("[ActivityLog] failed to record activity:", params.action, error);
  }
}
