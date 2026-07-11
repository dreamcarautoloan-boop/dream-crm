import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing using Node's built-in scrypt (no external dependency).
 * Stored format: "<saltHex>:<hashHex>"
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const storedHash = Buffer.from(hashHex, "hex");
  const suppliedHash = scryptSync(password, salt, KEY_LENGTH);

  if (storedHash.length !== suppliedHash.length) return false;
  return timingSafeEqual(storedHash, suppliedHash);
}

/**
 * Basic password strength check used when an admin creates/resets an account.
 * Adjust to taste — this just guards against trivially weak passwords.
 */
export function isPasswordStrongEnough(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}
