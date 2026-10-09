import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { assertPostgresConfigured, dataBackend } from "@/lib/data-backend";

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function ensurePg() {
  if (dataBackend() !== "postgres") {
    throw new Error("Auth server functions require DATA_BACKEND=postgres");
  }
  assertPostgresConfigured();
}

export const authRegisterFn = createServerFn({ method: "POST" })
  .validator(creds)
  .handler(async ({ data }) => {
    ensurePg();
    const { pgRegister } = await import("@/server/pg/auth");
    const { writeSessionCookie } = await import("@/server/auth/cookies");
    const result = await pgRegister(data.email, data.password);
    writeSessionCookie(result.token, result.expiresAt);
    return { userId: result.userId, email: result.email };
  });

export const authLoginFn = createServerFn({ method: "POST" })
  .validator(creds)
  .handler(async ({ data }) => {
    ensurePg();
    const { pgLogin } = await import("@/server/pg/auth");
    const { writeSessionCookie } = await import("@/server/auth/cookies");
    const result = await pgLogin(data.email, data.password);
    writeSessionCookie(result.token, result.expiresAt);
    return { userId: result.userId, email: result.email };
  });

export const authLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  if (dataBackend() !== "postgres") return { ok: true as const };
  const { readSessionToken, clearSessionCookie } = await import("@/server/auth/cookies");
  const { pgLogout } = await import("@/server/pg/auth");
  await pgLogout(readSessionToken());
  clearSessionCookie();
  return { ok: true as const };
});

export const authSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  if (dataBackend() !== "postgres") {
    return { userId: null, email: null, isAdmin: false };
  }
  assertPostgresConfigured();
  const { readSessionToken } = await import("@/server/auth/cookies");
  const { pgCurrentUser } = await import("@/server/pg/auth");
  const session = await pgCurrentUser(readSessionToken());
  if (!session) return { userId: null, email: null, isAdmin: false };
  return { userId: session.userId, email: session.email, isAdmin: session.isAdmin };
});
