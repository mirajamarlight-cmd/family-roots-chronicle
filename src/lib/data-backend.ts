/**
 * Dual-run switch. Default remains Supabase until cutover.
 * Server: DATA_BACKEND. Client: VITE_DATA_BACKEND (must match for UI paths).
 */
export type DataBackend = "supabase" | "postgres";

export function dataBackend(): DataBackend {
  const fromProcess =
    typeof process !== "undefined" ? process.env["DATA_BACKEND"] || process.env["VITE_DATA_BACKEND"] : undefined;
  const fromVite =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_DATA_BACKEND"] as string | undefined)
      : undefined;
  const raw = (fromProcess || fromVite || "supabase").toLowerCase();
  if (raw === "postgres") return "postgres";
  return "supabase";
}

export function assertPostgresConfigured(): void {
  if (typeof process === "undefined") return;
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATA_BACKEND=postgres requires DATABASE_URL");
  }
  if (!process.env["SESSION_SECRET"] || process.env["SESSION_SECRET"].length < 16) {
    throw new Error("DATA_BACKEND=postgres requires SESSION_SECRET (min 16 chars)");
  }
}
