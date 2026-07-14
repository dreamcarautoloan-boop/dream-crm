import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function buildUserResponse(user: NonNullable<Awaited<ReturnType<typeof db.getUserByUsername>>>) {
  return {
    id: user.id,
    openId: user.openId,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.teamId,
    loginMethod: "password",
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
}

/**
 * Username/password login routes.
 * These sit alongside the existing OAuth routes (server/_core/oauth.ts) and reuse
 * the same JWT session-cookie mechanism, so protectedProcedure / adminProcedure and
 * the rest of the app keep working unchanged once a session cookie is set.
 */
export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body ?? {};

      if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
        res.status(400).json({ error: "username and password are required" });
        return;
      }

      const user = await db.getUserByUsername(username.trim().toLowerCase());

      // Avoid leaking which part (username vs password) was wrong.
      const { verifyPassword } = await import("./password");
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: "This account has been deactivated" });
        return;
      }

      await db.touchLastSignedIn(user.id);

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Same response shape as /api/oauth/mobile so the client can reuse one code path
      // for both web (cookie) and native (Bearer token) auth.
      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}
