import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AssistantConfirmKind } from "@/lib/family-assistant-actions";
import { personIsDeceased } from "@/lib/family";

type PersonFields = {
  first_name?: unknown;
  middle_name?: unknown;
  last_name?: unknown;
  gender?: unknown;
  birth_date?: unknown;
  death_date?: unknown;
  notes?: unknown;
  is_deceased?: unknown;
};

type ActionPayload = {
  submissionId?: unknown;
  parent_id?: unknown;
  person_id?: unknown;
  first_name?: unknown;
  middle_name?: unknown;
  last_name?: unknown;
  gender?: unknown;
  birth_date?: unknown;
  fields?: PersonFields;
};

type PersonUpdate = {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string | null;
  display_name?: string;
  gender?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  notes?: string | null;
};

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
  const p = payload as ActionPayload;
  switch (kind) {
    case "approve_submission": {
      const submissionId = String(p.submissionId ?? "");
      if (!submissionId) throw new Error("Missing submission id.");
      const { data, error } = await supabase.rpc("approve_submission", { _id: submissionId });
      if (error) throw error;
      return {
        ok: true,
        message: "Submission approved — now on the tree.",
        ...(typeof data === "string" ? { personId: data } : {}),
      };
    }
    case "reject_submission": {
      const submissionId = String(p.submissionId ?? "");
      if (!submissionId) throw new Error("Missing submission id.");
      const { error } = await supabase.rpc("reject_submission", { _id: submissionId });
      if (error) throw error;
      return { ok: true, message: "Submission rejected." };
    }
    case "add_child": {
      const parent_id = String(p.parent_id ?? "");
      const first_name = String(p.first_name ?? "").trim();
      if (!parent_id || !first_name) throw new Error("Parent and first name are required.");

      const row = {
        first_name,
        middle_name: (p.middle_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
        display_name: [first_name, p.middle_name, p.last_name]
          .map((s) => String(s ?? "").trim())
          .filter(Boolean)
          .join(" "),
        gender: (p.gender as string | null) ?? null,
        birth_date: (p.birth_date as string | null) ?? null,
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
      const person_id = String(p.person_id ?? "");
      const fields: PersonFields = p.fields ?? {};
      if (!person_id) throw new Error("Missing person id.");
      if (!Object.keys(fields).length) throw new Error("No fields to update.");

      const update: PersonUpdate = {};
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
              ? (update.death_date ?? null)
              : null;
        await applyDeceased(supabase, person_id, isDeceased, deathDate);
      } else if (fields.death_date !== undefined && !update.death_date) {
        await applyDeceased(supabase, person_id, false, null);
      } else if (fields.death_date !== undefined) {
        await applyDeceased(
          supabase,
          person_id,
          personIsDeceased({ is_deceased: false, death_date: update.death_date ?? null }),
          update.death_date ?? null,
        );
      }

      return { ok: true, message: "Person updated.", personId: person_id };
    }
    default:
      throw new Error(`Unknown action: ${kind satisfies never}`);
  }
}
