import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomBytes } from "node:crypto";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword } from "./_core/password";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({
        connection: {
          uri: process.env.DATABASE_URL,
          // Managed MySQL providers (e.g. TiDB Cloud) require TLS. Toggle with
          // DATABASE_SSL=true rather than requiring the connection string
          // itself to encode SSL parameters.
          ssl: process.env.DATABASE_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(
  user: Omit<InsertUser, "username" | "passwordHash"> & Partial<Pick<InsertUser, "username" | "passwordHash">>,
): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      // OAuth-provisioned accounts don't use password login, but the schema
      // requires a unique username + passwordHash for every row. Generate
      // placeholders on first insert only — never touched on update, so an
      // account that later gets a real username/password (see users router)
      // is unaffected.
      username: user.username ?? `oauth_${randomBytes(6).toString("hex")}`,
      passwordHash: user.passwordHash ?? hashPassword(randomBytes(32).toString("hex")),
      name: user.name || "Unknown",
      email: user.email || "",
      role: user.role || "sales",
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      if (field === "phone") {
        values[field] = normalized;
        updateSet[field] = normalized;
      } else {
        values[field] = normalized || "";
        updateSet[field] = normalized || "";
      }
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "sales_manager";
      updateSet.role = "sales_manager";
    } else {
      values.role = "sales";
      updateSet.role = "sales";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Bumps lastSignedIn for an existing user without touching any other field
 *  (used by the username/password login route — upsertUser is for OAuth). */
export async function touchLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

// TODO: add feature queries here as your schema grows.
