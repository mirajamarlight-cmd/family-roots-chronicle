import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteSession, resolveSession } from "@/server/auth/session";
import { db } from "@/server/db";

export async function pgRegister(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || password.length < 6) {
    throw new Error("Valid email and password (min 6 characters) are required.");
  }
  const passwordHash = await hashPassword(password);
  try {
    const rows = await db()`
      INSERT INTO app_users (email, password_hash, email_verified_at)
      VALUES (${normalized}, ${passwordHash}, now())
      RETURNING id, email
    `;
    const user = rows[0]!;
    const session = await createSession(String(user["id"]));
    return {
      userId: String(user["id"]),
      email: String(user["email"]),
      token: session.token,
      expiresAt: session.expiresAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("app_users_email_lower") || msg.includes("unique")) {
      throw new Error("An account with that email already exists.");
    }
    throw err;
  }
}

export async function pgLogin(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db()`
    SELECT id, email, password_hash FROM app_users WHERE lower(email) = ${normalized} LIMIT 1
  `;
  const user = rows[0];
  if (!user) throw new Error("Email or password is incorrect.");
  const ok = await verifyPassword(password, String(user["password_hash"]));
  if (!ok) throw new Error("Email or password is incorrect.");
  const session = await createSession(String(user["id"]));
  return {
    userId: String(user["id"]),
    email: String(user["email"]),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function pgLogout(token: string | undefined) {
  if (token) await deleteSession(token);
}

export async function pgCurrentUser(token: string | undefined) {
  return resolveSession(token);
}
