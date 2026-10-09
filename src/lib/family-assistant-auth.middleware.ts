import { createMiddleware } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";
import { assertPostgresConfigured, dataBackend } from "@/lib/data-backend";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

async function resolveAdminContext(): Promise<Record<string, unknown>> {
  if (dataBackend() === "postgres") {
    assertPostgresConfigured();
    const { readSessionToken } = await import("@/server/auth/cookies");
    const { resolveSession } = await import("@/server/auth/session");
    const { pgIsAdmin } = await import("@/server/pg/family");
    const token = readSessionToken();
    const session = await resolveSession(token);
    if (!session) throw new Error("Unauthorized");
    if (!(await pgIsAdmin(session.userId))) throw new Error("Forbidden: admin access required");
    return {
      userId: session.userId,
      email: session.email,
      isAdmin: true as const,
      backend: "postgres" as const,
    };
  }

  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: No authorization header provided");
  const token = authHeader.replace("Bearer ", "");
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");
  const userId = data.claims.sub;

  const role = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role.error || !role.data) throw new Error("Forbidden: admin access required");

  return {
    supabase: supabase as SupabaseClient<Database>,
    userId,
    claims: data.claims,
    isAdmin: true as const,
    backend: "supabase" as const,
  };
}

/** Dual-run admin gate evaluated per request from DATA_BACKEND. */
export const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next, context }) => {
  const admin = await resolveAdminContext();
  return next({
    context: {
      ...((context ?? {}) as Record<string, unknown>),
      ...admin,
    },
  });
});
