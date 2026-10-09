import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AssistantAction } from "@/lib/family-assistant-actions";
import type { FamilyGraph } from "@/lib/family";
import { db } from "@/server/db";

type QueryResult = { data: unknown; error: null };

/** Minimal PostgREST-shaped stub so admin assistant tools can run on Postgres. */
function pgSubmissionsClient(): SupabaseClient<Database> {
  const makeBuilder = () => {
    const filters: Record<string, string> = {};
    const run = async (): Promise<QueryResult> => {
      if (filters["id"]) {
        const rows = await db()`
          SELECT * FROM person_submissions
          WHERE id = ${filters["id"]}::uuid
            AND status = ${filters["status"] ?? "pending"}
          LIMIT 1
        `;
        return { data: rows, error: null };
      }
      const rows = await db()`
        SELECT id, kind, first_name, middle_name, last_name, created_at, status
        FROM person_submissions
        WHERE status = ${filters["status"] ?? "pending"}
        ORDER BY created_at
      `;
      return { data: rows, error: null };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: string) => {
        filters[col] = val;
        return api;
      },
      order: () => Promise.resolve(run()),
      maybeSingle: async () => {
        const res = await run();
        const rows = res.data as unknown[];
        return { data: rows?.[0] ?? null, error: null };
      },
      then: (onfulfilled: (v: QueryResult) => unknown, onrejected?: (e: unknown) => unknown) =>
        run().then(onfulfilled, onrejected),
    };
    return api;
  };

  return {
    from(table: string) {
      if (table !== "person_submissions") {
        throw new Error(`Unsupported table in pg stub: ${table}`);
      }
      return makeBuilder();
    },
  } as unknown as SupabaseClient<Database>;
}

export async function runAdminAssistantToolPg(
  graph: FamilyGraph,
  name: string,
  args: Record<string, unknown>,
  actions: AssistantAction[],
): Promise<unknown> {
  const { runAdminAssistantTool } = await import("@/lib/family-assistant-admin.server");
  return runAdminAssistantTool(pgSubmissionsClient(), graph, name, args, actions);
}
