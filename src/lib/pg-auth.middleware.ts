import { createMiddleware } from "@tanstack/react-start";

import { assertPostgresConfigured } from "@/lib/data-backend";

/** Cookie + role gate for Postgres dual-run serverFns (safe to import from *.functions.ts). */
export const requirePgAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  assertPostgresConfigured();
  const { readSessionToken } = await import("@/server/auth/cookies");
  const { resolveSession } = await import("@/server/auth/session");
  const token = readSessionToken();
  const session = await resolveSession(token);
  if (!session) throw new Error("Unauthorized");
  return next({
    context: {
      userId: session.userId,
      email: session.email,
      isAdmin: session.isAdmin,
      sessionToken: token,
    },
  });
});

export const requirePgAdmin = createMiddleware({ type: "function" })
  .middleware([requirePgAuth])
  .server(async ({ next, context }) => {
    const { userId } = (context ?? {}) as { userId?: string };
    if (!userId) throw new Error("Unauthorized");
    const { pgIsAdmin } = await import("@/server/pg/family");
    if (!(await pgIsAdmin(userId))) throw new Error("Forbidden: admin access required");
    return next({
      context: {
        ...((context ?? {}) as Record<string, unknown>),
        isAdmin: true as const,
      },
    });
  });
