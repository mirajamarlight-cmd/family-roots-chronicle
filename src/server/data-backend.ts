/**
 * Dual-run switch. Default remains Supabase until cutover.
 * Set DATA_BACKEND=postgres only when DATABASE_URL is configured and verified.
 */
export type DataBackend = "supabase" | "postgres";

export function dataBackend(): DataBackend {
  const raw = (process.env["DATA_BACKEND"] || "supabase").toLowerCase();
  if (raw === "postgres") {
    if (!process.env["DATABASE_URL"]) {
      throw new Error("DATA_BACKEND=postgres requires DATABASE_URL");
    }
    return "postgres";
  }
  return "supabase";
}
