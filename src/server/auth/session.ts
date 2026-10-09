import { createHash, randomBytes } from "node:crypto";

import { db } from "@/server/db";

const SESSION_DAYS = 30;
export const SESSION_COOKIE = "frc_session";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db()`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await db()`DELETE FROM sessions WHERE token_hash = ${hashSessionToken(token)}`;
}

export async function resolveSession(
  token: string | undefined | null,
): Promise<{ userId: string; email: string; isAdmin: boolean } | null> {
  if (!token) return null;
  const rows = await db()`
    SELECT u.id, u.email,
      EXISTS (
        SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin'
      ) AS is_admin
    FROM sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashSessionToken(token)}
      AND s.expires_at > now()
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    userId: String(row["id"]),
    email: String(row["email"]),
    isAdmin: Boolean(row["is_admin"]),
  };
}
