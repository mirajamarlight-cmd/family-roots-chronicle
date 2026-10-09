/** Re-export for server-only callers. Prefer `@/lib/pg-auth.middleware` from *.functions.ts. */
export { requirePgAdmin, requirePgAuth } from "@/lib/pg-auth.middleware";
