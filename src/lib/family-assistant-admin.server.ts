import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AssistantAction } from "@/lib/family-assistant-actions";
import { resolvePersonQuery } from "@/lib/family-assistant-tools";
import {
  duplicateEffectiveNames,
  effectiveDisplayName,
  lineageLabel,
  searchPeople,
  type FamilyGraph,
} from "@/lib/family";
import type { PersonSubmission } from "@/lib/submissions";
import { formatRecordDate } from "@/lib/utils";

export type AdminToolName =
  | "get_submission_detail"
  | "match_submission_to_tree"
  | "list_duplicate_names"
  | "select_person_in_admin"
  | "prepare_approve_submission"
  | "prepare_reject_submission"
  | "prepare_add_child"
  | "prepare_update_person";

export const ADMIN_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_pending_submissions",
      description: "List join/edit submissions waiting for admin approval.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_submission_detail",
      description: "Full detail for one pending submission, including tree placement.",
      parameters: {
        type: "object",
        properties: {
          submission_id: { type: "string", description: "Submission uuid." },
        },
        required: ["submission_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "match_submission_to_tree",
      description: "Suggest existing tree people who might match a submission (duplicate check).",
      parameters: {
        type: "object",
        properties: {
          submission_id: { type: "string", description: "Submission uuid." },
        },
        required: ["submission_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_duplicate_names",
      description: "List effective display names shared by more than one person, with lineages.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "select_person_in_admin",
      description: "Open a person in the admin editor for the user.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Person name or id." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_approve_submission",
      description:
        "Prepare approving a submission. Returns a confirm button — does not approve until the admin clicks it.",
      parameters: {
        type: "object",
        properties: {
          submission_id: { type: "string", description: "Submission uuid." },
        },
        required: ["submission_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_reject_submission",
      description:
        "Prepare rejecting a submission. Returns a confirm button — does not reject until the admin clicks it.",
      parameters: {
        type: "object",
        properties: {
          submission_id: { type: "string", description: "Submission uuid." },
        },
        required: ["submission_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_add_child",
      description:
        "Prepare adding a new child under a parent. Returns a confirm button — does not save until the admin clicks it.",
      parameters: {
        type: "object",
        properties: {
          parent_query: { type: "string", description: "Parent name or id." },
          first_name: { type: "string" },
          middle_name: { type: "string" },
          last_name: { type: "string" },
          gender: { type: "string", description: "male or female" },
          birth_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["parent_query", "first_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_update_person",
      description:
        "Prepare updating fields on an existing person. Returns a confirm button — does not save until the admin clicks it.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Person name or id." },
          first_name: { type: "string" },
          middle_name: { type: "string" },
          last_name: { type: "string" },
          gender: { type: "string" },
          birth_date: { type: "string" },
          death_date: { type: "string" },
          notes: { type: "string" },
          is_deceased: { type: "boolean" },
        },
        required: ["query"],
      },
    },
  },
];

function submissionName(row: Pick<PersonSubmission, "first_name" | "middle_name" | "last_name">) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

async function fetchSubmission(
  supabase: SupabaseClient<Database>,
  submissionId: string,
): Promise<PersonSubmission | null> {
  const { data, error } = await supabase
    .from("person_submissions")
    .select("*")
    .eq("id", submissionId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return data;
}

function submissionSummary(graph: FamilyGraph, row: PersonSubmission) {
  const listedId =
    row.kind === "edit" ? row.person_id : row.parent_id ?? row.added_parent_of;
  return {
    id: row.id,
    kind: row.kind,
    name: submissionName(row),
    birth_date: row.birth_date,
    birth_date_label: formatRecordDate(row.birth_date),
    created_at: row.created_at,
    link_side: row.link_side,
    tree_anchor: listedId
      ? {
          id: listedId,
          name: effectiveDisplayName(graph, listedId),
          lineage: lineageLabel(graph, listedId),
        }
      : null,
    notes: row.notes,
    has_added_parent: !!(
      row.added_parent_first_name ||
      row.added_parent_middle_name ||
      row.added_parent_last_name
    ),
    has_other_parent: !!(
      row.other_parent_first_name ||
      row.other_parent_middle_name ||
      row.other_parent_last_name ||
      row.other_parent_name
    ),
  };
}

function matchCandidates(graph: FamilyGraph, row: PersonSubmission) {
  const name = submissionName(row);
  const byName = searchPeople(graph, name, 8);
  const byFirst = searchPeople(graph, row.first_name, 8);
  const ids = new Set<string>();
  const candidates = [];
  for (const p of [...byName, ...byFirst]) {
    if (ids.has(p.id)) continue;
    ids.add(p.id);
    candidates.push({
      id: p.id,
      name: effectiveDisplayName(graph, p.id),
      lineage: lineageLabel(graph, p.id),
      birth_date: p.birth_date,
    });
  }
  return { submission_name: name, candidates };
}

function listDuplicates(graph: FamilyGraph) {
  const duplicates = duplicateEffectiveNames(graph);
  return [...duplicates].map((name) => ({
    name,
    people: graph.people
      .filter((p) => effectiveDisplayName(graph, p.id) === name)
      .map((p) => ({
        id: p.id,
        lineage: lineageLabel(graph, p.id),
      })),
  }));
}

function pickUpdateFields(args: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const key of [
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "birth_date",
    "death_date",
    "notes",
    "is_deceased",
  ] as const) {
    if (args[key] !== undefined) fields[key] = args[key];
  }
  return fields;
}

export async function runAdminAssistantTool(
  supabase: SupabaseClient<Database>,
  graph: FamilyGraph,
  name: string,
  args: Record<string, unknown>,
  actions: AssistantAction[],
): Promise<unknown> {
  switch (name) {
    case "list_pending_submissions": {
      const { data, error } = await supabase
        .from("person_submissions")
        .select("id, kind, first_name, middle_name, last_name, created_at, status")
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return {
        submissions: (data ?? []).map((row) => ({
          id: row.id,
          kind: row.kind,
          name: submissionName(row),
          created_at: row.created_at,
        })),
      };
    }
    case "get_submission_detail": {
      const row = await fetchSubmission(supabase, String(args["submission_id"] ?? ""));
      if (!row) return { error: "Pending submission not found." };
      return submissionSummary(graph, row);
    }
    case "match_submission_to_tree": {
      const row = await fetchSubmission(supabase, String(args["submission_id"] ?? ""));
      if (!row) return { error: "Pending submission not found." };
      return matchCandidates(graph, row);
    }
    case "list_duplicate_names":
      return { duplicates: listDuplicates(graph) };
    case "select_person_in_admin": {
      const resolved = resolvePersonQuery(graph, String(args["query"] ?? ""));
      if (!resolved.ok) return resolved;
      const label = effectiveDisplayName(graph, resolved.id);
      actions.push({ type: "open_person", personId: resolved.id, label });
      return { opened: true, person_id: resolved.id, name: label };
    }
    case "prepare_approve_submission": {
      const row = await fetchSubmission(supabase, String(args["submission_id"] ?? ""));
      if (!row) return { error: "Pending submission not found." };
      const name = submissionName(row);
      const id = crypto.randomUUID();
      actions.push({
        type: "confirm",
        id,
        kind: "approve_submission",
        label: `Approve ${name}`,
        payload: { submissionId: row.id },
      });
      return {
        prepared: true,
        confirm_id: id,
        summary: submissionSummary(graph, row),
        instruction: "Tell the admin what will happen, then ask them to click Approve.",
      };
    }
    case "prepare_reject_submission": {
      const row = await fetchSubmission(supabase, String(args["submission_id"] ?? ""));
      if (!row) return { error: "Pending submission not found." };
      const name = submissionName(row);
      const id = crypto.randomUUID();
      actions.push({
        type: "confirm",
        id,
        kind: "reject_submission",
        label: `Reject ${name}`,
        payload: { submissionId: row.id },
      });
      return {
        prepared: true,
        confirm_id: id,
        summary: submissionSummary(graph, row),
        instruction: "Explain the rejection, then ask them to click Reject to confirm.",
      };
    }
    case "prepare_add_child": {
      const resolved = resolvePersonQuery(graph, String(args["parent_query"] ?? ""));
      if (!resolved.ok) return resolved;
      const parentName = effectiveDisplayName(graph, resolved.id);
      const first_name = String(args["first_name"] ?? "").trim();
      if (!first_name) return { error: "first_name is required." };
      const id = crypto.randomUUID();
      const payload = {
        parent_id: resolved.id,
        first_name,
        middle_name: String(args["middle_name"] ?? "").trim() || null,
        last_name: String(args["last_name"] ?? "").trim() || null,
        gender: String(args["gender"] ?? "").trim() || null,
        birth_date: String(args["birth_date"] ?? "").trim() || null,
      };
      actions.push({
        type: "confirm",
        id,
        kind: "add_child",
        label: `Add ${first_name} under ${parentName}`,
        payload,
      });
      return {
        prepared: true,
        confirm_id: id,
        parent: { id: resolved.id, name: parentName },
        child: payload,
        instruction: "Summarize the new person, then ask them to click to confirm.",
      };
    }
    case "prepare_update_person": {
      const resolved = resolvePersonQuery(graph, String(args["query"] ?? ""));
      if (!resolved.ok) return resolved;
      const fields = pickUpdateFields(args);
      if (!Object.keys(fields).length) {
        return { error: "Provide at least one field to update." };
      }
      const personName = effectiveDisplayName(graph, resolved.id);
      const id = crypto.randomUUID();
      actions.push({
        type: "confirm",
        id,
        kind: "update_person",
        label: `Update ${personName}`,
        payload: { person_id: resolved.id, fields },
      });
      return {
        prepared: true,
        confirm_id: id,
        person: { id: resolved.id, name: personName },
        fields,
        instruction: "Summarize the changes, then ask them to click to confirm.",
      };
    }
    default:
      return { error: `Unknown admin tool: ${name}` };
  }
}
