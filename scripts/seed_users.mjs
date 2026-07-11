// Creates the initial set of CRM users (one per role from the PRD) with hashed passwords.
// Usage:
//   DATABASE_URL="mysql://user:pass@host:port/dbname" node scripts/seed_users.mjs
//
// Safe to re-run: existing usernames are skipped, not duplicated.

import { randomBytes, scryptSync } from "node:crypto";
import mysql from "mysql2/promise";

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Edit this list to match your real team. `password` is the plaintext temp
// password to hand out — tell each person to change it after first login
// (change-password isn't wired up yet; see the note at the end of the chat reply).
const USERS = [
  { username: "manager1", name: "Sales Manager", role: "sales_manager", password: "Manager@2026" },
  { username: "leader1", name: "Team Leader 1", role: "team_leader", password: "Leader@2026" },
  { username: "sales1", name: "Sales Rep 1", role: "sales", password: "Sales1@2026" },
  { username: "sales2", name: "Sales Rep 2", role: "sales", password: "Sales2@2026" },
  { username: "sales3", name: "Sales Rep 3", role: "sales", password: "Sales3@2026" },
  { username: "sales4", name: "Sales Rep 4", role: "sales", password: "Sales4@2026" },
  { username: "sales5", name: "Sales Rep 5", role: "sales", password: "Sales5@2026" },
  { username: "sales6", name: "Sales Rep 6", role: "sales", password: "Sales6@2026" },
  { username: "moderator1", name: "Moderator 1", role: "moderator", password: "Mod1@2026" },
  { username: "moderator2", name: "Moderator 2", role: "moderator", password: "Mod2@2026" },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Set DATABASE_URL first, e.g.:");
    console.error('  DATABASE_URL="mysql://user:pass@host:3306/dbname" node scripts/seed_users.mjs');
    process.exit(1);
  }

  const conn = await mysql.createConnection(databaseUrl);

  try {
    for (const u of USERS) {
      const [existing] = await conn.execute("SELECT id FROM users WHERE username = ?", [
        u.username,
      ]);
      if (existing.length > 0) {
        console.log(`- ${u.username}: already exists, skipping`);
        continue;
      }

      const passwordHash = hashPassword(u.password);
      const openId = `local_${u.username}`;

      await conn.execute(
        `INSERT INTO users (openId, username, passwordHash, name, email, role, isActive, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, ?, true, NOW(), NOW(), NOW())`,
        [openId, u.username, passwordHash, u.name, `${u.username}@dreamloan.local`, u.role],
      );
      console.log(`+ ${u.username} (${u.role}) created — temp password: ${u.password}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
