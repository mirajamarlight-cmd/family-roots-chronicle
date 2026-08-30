import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AssistantConfirmKind } from "@/lib/family-assistant-actions";
import { personIsDeceased } from "@/lib/family";

async function applyDeceased(
  supabase: SupabaseClient<Database>,
  id: string,
  isDeceased: boolean,
  deathDate: string | null,
) {
  const death_date = isDeceased ? deathDate : null;
  const withFlag = await supabase
    .from("people")
    .update({ is_deceased: isDeceased, death_date })
    .eq("id", id);
  if (!withFlag.error) return;

  const msg = withFlag.error.message ?? "";
  if (!msg.includes("is_deceased")) throw withFlag.error;
  if (isDeceased && !death_date) {
    throw new Error("Add a death date, or run the is_deceased migration in Supabase SQL editor.");
  }
  const base = await supabase.from("people").update({ death_date }).eq("id", id);
  if (base.error) throw base.error;
}

export async function executeAssistantAction(
  supabase: SupabaseClient<Database>,
  kind: AssistantConfirmKind,
  payload: Record<string, unknown>,
): Promise<{ ok: true; message: string; personId?: string }> {
  switch (kind) {
    case "approve_submission": {
      const submissionId = String(payload.submissionId ?? "");
      if (!submissionId) throw new Error("Missing submission id.");
      const { data, error } = await supabase.rpc("approve_submission", { _id: submissionId });
      if (error) throw error;
      return {
        ok: true,
        message: "Submission approved — now on the tree.",
        personId: typeof data === "string" ? data : undefined,
      };
    }
    case "reject_submission": {
      const submissionId = String(payload.submissionId ?? "");
      if (!submissionId) throw new Error("Missing submission id.");
      const { error } = await supabase.rpc("reject_submission", { _id: submissionId });
      if (error) throw error;
      return { ok: true, message: "Submission rejected." };
    }
    case "add_child": {
      const parent_id = String(payload.parent_id ?? "");
      const first_name = String(payload.first_name ?? "").trim();
      if (!parent_id || !first_name) throw new Error("Parent and first name are required.");

      const row = {
        first_name,
        middle_name: (payload.middle_name as string | null) ?? null,
        last_name: (payload.last_name as string | null) ?? null,
        display_name: [first_name, payload.middle_name, payload.last_name]
          .map((s) => String(s ?? "").trim())
          .filter(Boolean)
          .join(" "),
        gender: (payload.gender as string | null) ?? null,
        birth_date: (payload.birth_date as string | null) ?? null,
        death_date: null,
        notes: null,
      };

      const { data, error } = await supabase.from("people").insert(row).select("id").single();
      if (error || !data) throw error ?? new Error("Could not add person.");

      const { error: linkError } = await supabase.from("parent_child").insert({
        parent_id,
        child_id: data.id,
        relationship_type: "biological",
      });
      if (linkError) throw linkError;

      return {
        ok: true,
        message: `Added ${row.display_name} to the tree.`,
        personId: data.id,
      };
    }
    case "update_person": {
      const person_id = String(payload.person_id ?? "");
      const fields = (payload.fields ?? {}) as Record<string, unknown>;
      if (!person_id) throw new Error("Missing person id.");
      if (!Object.keys(fields).length) throw new Error("No fields to update.");

      const update: Record<string, unknown> = {};
      if (fields.first_name !== undefined) update.first_name = String(fields.first_name).trim();
      if (fields.middle_name !== undefined) {
        update.middle_name = String(fields.middle_name).trim() || null;
      }
      if (fields.last_name !== undefined) update.last_name = String(fields.last_name).trim() || null;
      if (fields.gender !== undefined) update.gender = String(fields.gender).trim() || null;
      if (fields.birth_date !== undefined) {
        update.birth_date = String(fields.birth_date).trim() || null;
      }
      if (fields.notes !== undefined) update.notes = String(fields.notes).trim() || null;

      if (
        update.first_name !== undefined ||
        update.middle_name !== undefined ||
        update.last_name !== undefined
      ) {
        const { data: existing, error: readError } = await supabase
          .from("people")
          .select("first_name, middle_name, last_name")
          .eq("id", person_id)
          .single();
        if (readError) throw readError;
        const first = String(update.first_name ?? existing.first_name).trim();
        const middle = String(update.middle_name ?? existing.middle_name ?? "").trim();
        const last = String(update.last_name ?? existing.last_name ?? "").trim();
        update.display_name = [first, middle, last].filter(Boolean).join(" ");
      }

      if (fields.death_date !== undefined) {
        update.death_date = String(fields.death_date).trim() || null;
      }

      const { error } = await supabase.from("people").update(update).eq("id", person_id);
      if (error) throw error;

      if (fields.is_deceased !== undefined) {
        const isDeceased = Boolean(fields.is_deceased);
        const deathDate =
          fields.death_date !== undefined
            ? String(fields.death_date).trim() || null
            : isDeceased
              ? ((update.death_date as string | null) ?? null)
              : null;
        await applyDeceased(supabase, person_id, isDeceased, deathDate);
      } else if (fields.death_date !== undefined && !update.death_date) {
        await applyDeceased(supabase, person_id, false, null);
      } else if (fields.death_date !== undefined) {
        await applyDeceased(
          supabase,
          person_id,
          personIsDeceased({ is_deceased: false, death_date: update.death_date as string }),
          update.death_date as string,
        );
      }

      return { ok: true, message: "Person updated.", personId: person_id };
    }
    default:
      throw new Error(`Unknown action: ${kind satisfies never}`);
  }
}
