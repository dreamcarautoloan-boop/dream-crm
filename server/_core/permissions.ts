import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { customers, users, type Customer, type User } from "../../drizzle/schema";

/**
 * Central place for "can this user do X" checks so the logic lives in one
 * spot instead of being re-implemented (and drifting) inside every router.
 */

/** True if `user` is a sales_manager — they can see/do everything. */
export function isSalesManager(user: User): boolean {
  return user.role === "sales_manager";
}

/** True if `user` is a team_leader (or above). */
export function isTeamLeaderOrAbove(user: User): boolean {
  return user.role === "sales_manager" || user.role === "team_leader";
}

/**
 * Whether `user` may view/edit a specific customer record.
 * - sales_manager: always
 * - team_leader: any customer whose owner shares the team_leader's team
 * - sales: only customers assigned directly to them
 * - moderator: not customer-owners; handled separately (lead intake only)
 */
export async function canAccessCustomer(user: User, customer: Customer): Promise<boolean> {
  if (isSalesManager(user)) return true;

  if (user.role === "sales") {
    return customer.assignedToSalesId === user.id;
  }

  if (user.role === "team_leader") {
    if (customer.assignedToSalesId === user.id) return true;
    const db = await getDb();
    if (!db) return false;
    const [owner] = await db
      .select({ teamId: users.teamId })
      .from(users)
      .where(eq(users.id, customer.assignedToSalesId))
      .limit(1);
    return !!owner && owner.teamId != null && owner.teamId === user.teamId;
  }

  return false;
}

/** Throws FORBIDDEN if `user` cannot access `customer`. */
export async function assertCanAccessCustomer(user: User, customer: Customer): Promise<void> {
  const allowed = await canAccessCustomer(user, customer);
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this customer" });
  }
}

/** Loads a customer by id or throws NOT_FOUND. */
export async function getCustomerOrThrow(customerId: number): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
  }
  return customer;
}

/**
 * Whether `user` may reassign a customer between sales reps.
 * Only team_leader (within their own team) and sales_manager (anywhere).
 */
export function canReassignCustomers(user: User): boolean {
  return isTeamLeaderOrAbove(user);
}
