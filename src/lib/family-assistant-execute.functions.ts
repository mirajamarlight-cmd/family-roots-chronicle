import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { dataBackend } from "@/lib/data-backend";
import { requireAdmin } from "@/lib/family-assistant-auth.middleware";

const executeInput = z.object({
  kind: z.enum(["approve_submission", "reject_submission", "add_child", "update_person"]),
  payload: z.record(z.unknown()),
});

async function executeAssistantActionPg(
  userId: string,
  kind: z.infer<typeof executeInput>["kind"],
  payload: Record<string, unknown>,
): Promise<{ ok: true; message: string; personId?: string }> {
  const { pgApproveSubmission, pgRejectSubmission } = await import("@/server/pg/submissions");
  const {
    pgInsertParentChild,
    pgInsertPerson,
    pgUpdatePerson,
    pgUpdatePersonDeceased,
  } = await import("@/server/pg/family");
  const { db } = await import("@/server/db");

  switch (kind) {
    case "approve_submission": {
      const submissionId = String(payload["submissionId"] ?? "");
      if (!submissionId) throw new Error("Missing submission id.");
      const personId = await pgApproveSubmission(submissionId, userId);
      return { ok: true, message: "Submission approved — now on the tree.", personId };
    }
    case "reject_submission": {
      const submissionId = String(payload["submissionId"] ?? "");
      if (!submissionId) throw new Error("Missing submission id.");
      await pgRejectSubmission(submissionId, userId);
      return { ok: true, message: "Submission rejected." };
    }
    case "add_child": {
      const parent_id = String(payload["parent_id"] ?? "");
      const first_name = String(payload["first_name"] ?? "").trim();
      if (!parent_id || !first_name) throw new Error("Parent and first name are required.");
      const middle_name = (payload["middle_name"] as string | null) ?? null;
      const last_name = (payload["last_name"] as string | null) ?? null;
      const display_name = [first_name, middle_name, last_name]
        .map((s) => String(s ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const id = await pgInsertPerson({
        first_name,
        middle_name,
        last_name,
        display_name,
        gender: (payload["gender"] as string | null) ?? null,
        birth_date: (payload["birth_date"] as string | null) ?? null,
        death_date: null,
        notes: null,
      });
      await pgInsertParentChild({ parent_id, child_id: id });
      return { ok: true, message: `Added ${display_name} to the tree.`, personId: id };
    }
    case "update_person": {
      const person_id = String(payload["person_id"] ?? "");
      const fields = (payload["fields"] ?? {}) as Record<string, unknown>;
      if (!person_id) throw new Error("Missing person id.");
      if (!Object.keys(fields).length) throw new Error("No fields to update.");
      const patch: Record<string, string | boolean | null> = {};
      for (const key of [
        "first_name",
        "middle_name",
        "last_name",
        "gender",
        "birth_date",
        "death_date",
        "notes",
      ] as const) {
        if (fields[key] !== undefined) {
          const v = fields[key];
          patch[key] = v == null || v === "" ? null : String(v);
        }
      }
      if (
        patch["first_name"] !== undefined ||
        patch["middle_name"] !== undefined ||
        patch["last_name"] !== undefined
      ) {
        const existing = await db()`
          SELECT first_name, middle_name, last_name FROM people WHERE id = ${person_id}::uuid
        `;
        const row = existing[0];
        if (!row) throw new Error("Person not found");
        const first = String(patch["first_name"] ?? row["first_name"]).trim();
        const middle = String(patch["middle_name"] ?? row["middle_name"] ?? "").trim();
        const last = String(patch["last_name"] ?? row["last_name"] ?? "").trim();
        patch["display_name"] = [first, middle, last].filter(Boolean).join(" ");
      }
      await pgUpdatePerson(person_id, patch);
      if (fields["is_deceased"] !== undefined) {
        await pgUpdatePersonDeceased(
          person_id,
          Boolean(fields["is_deceased"]),
          fields["death_date"] !== undefined ? String(fields["death_date"] || "") || null : null,
        );
      }
      return { ok: true, message: "Person updated.", personId: person_id };
    }
    default:
      throw new Error(`Unknown action: ${kind}`);
  }
}

export const familyAssistantExecute = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(executeInput)
  .handler(async ({ data, context }) => {
    if (dataBackend() === "postgres") {
      const { userId } = (context ?? {}) as { userId?: string };
      if (!userId) throw new Error("Unauthorized");
      return executeAssistantActionPg(userId, data.kind, data.payload);
    }
    const { supabase } = (context ?? {}) as { supabase?: SupabaseClient<Database> };
    if (!supabase) throw new Error("Unauthorized");
    const { executeAssistantAction } = await import("@/lib/family-assistant-execute.server");
    return executeAssistantAction(supabase, data.kind, data.payload);
  });
