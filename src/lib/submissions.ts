import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import { formatAddress, formatPhone, parseAddress, parsePhone } from "./contact-format";
import { submissionProblem, type SubmissionDraft, type SubmissionContext } from "./submission-draft";

export type PersonSubmission = Tables<"person_submissions">;
export type PersonClaim = Tables<"person_claims">;

export async function fetchPersonClaimIndex(): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("person_claim_index");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.person_id, row.user_id]));
}

export async function fetchJoinState(userId: string) {
  const [pendingRes, claimRes] = await Promise.all([
    supabase
      .from("person_submissions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle(),
    supabase.from("person_claims").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (pendingRes.error) throw pendingRes.error;
  if (claimRes.error) throw claimRes.error;
  return { pending: pendingRes.data, claim: claimRes.data };
}

export type { LinkSide, SubmissionContext, SubmissionDraft, SubmissionKind } from "./submission-draft";
export { emptyDraft, personClaimedByOther, submissionProblem } from "./submission-draft";

export async function submitRecord(
  userId: string,
  d: SubmissionDraft,
  existingParentCount = 0,
  ctx?: SubmissionContext,
) {
  const problem = submissionProblem(d, existingParentCount, {
    userId,
    claimsByPerson: ctx?.claimsByPerson,
  });
  if (problem) throw new Error(problem);
  const addingLink = d.parent_source === "add";
  const addingOther = d.other_source === "add";
  const { error } = await supabase.from("person_submissions").insert({
    user_id: userId,
    kind: d.kind,
    person_id: d.kind === "edit" ? d.person_id : null,
    parent_id: d.kind === "new" && d.parent_source === "listed" ? d.parent_id : null,
    link_side: d.link_side || null,
    first_name: d.first_name.trim(),
    middle_name: d.middle_name.trim() || null,
    last_name: d.last_name.trim() || null,
    birth_date: d.birth_date.trim(),
    address: formatAddress(parseAddress(d.address)),
    phone: formatPhone(parsePhone(d.phone)),
    email: d.email.trim(),
    notes: d.notes.trim() || null,
    other_parent_name: !addingOther ? d.other_parent_name.trim() || null : null,
    added_parent_first_name: addingLink ? d.added_parent_first_name.trim() || null : null,
    added_parent_middle_name: addingLink ? d.added_parent_middle_name.trim() || null : null,
    added_parent_last_name: addingLink ? d.added_parent_last_name.trim() || null : null,
    added_parent_birth_date: addingLink ? d.added_parent_birth_date.trim() || null : null,
    added_parent_death_date: addingLink ? d.added_parent_death_date.trim() || null : null,
    added_parent_of: addingLink ? d.added_parent_of : null,
    other_parent_first_name: addingOther ? d.other_parent_first_name.trim() || null : null,
    other_parent_middle_name: addingOther ? d.other_parent_middle_name.trim() || null : null,
    other_parent_last_name: addingOther ? d.other_parent_last_name.trim() || null : null,
    other_parent_birth_date: addingOther ? d.other_parent_birth_date.trim() || null : null,
    other_parent_death_date: addingOther ? d.other_parent_death_date.trim() || null : null,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error(
        error.message.includes("one_pending_edit_per_person")
          ? "Someone else is already waiting for approval on that person."
          : "You already have a submission waiting for approval.",
      );
    }
    if (error.message.includes("already linked to another account")) {
      throw new Error("That person is already linked to another account.");
    }
    if (error.message.includes("already has a family record")) {
      throw new Error("Your account is already linked to someone on the tree.");
    }
    throw error;
  }
}

export async function fetchPendingSubmissions() {
  const { data, error } = await supabase
    .from("person_submissions")
    .select("*")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function fetchRegisteredMembers() {
  const { data, error } = await supabase
    .from("person_claims")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function approveSubmission(id: string) {
  const { data, error } = await supabase.rpc("approve_submission", { _id: id });
  if (error) throw error;
  return data;
}

export async function rejectSubmission(id: string) {
  const { error } = await supabase.rpc("reject_submission", { _id: id });
  if (error) throw error;
}
