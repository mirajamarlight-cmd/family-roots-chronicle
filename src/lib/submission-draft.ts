import { isValidAddress, isValidPhone, parseAddress, parsePhone } from "./contact-format.ts";
import {
  hasPatronymicFatherChain,
  personHasPatronymicChain,
  previewPatronymicName,
} from "./patronymic-name.ts";
import type { FamilyGraph } from "./family.ts";

export type LinkSide = "father" | "mother";
export type SubmissionKind = "new" | "edit";
export type ParentSource = "listed" | "add" | "";

export type SubmissionDraft = {
  kind: SubmissionKind;
  person_id: string | null;
  parent_id: string | null;
  parent_source: ParentSource;
  link_side: LinkSide | "";
  first_name: string;
  middle_name: string;
  last_name: string;
  birth_date: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
  added_parent_first_name: string;
  added_parent_middle_name: string;
  added_parent_last_name: string;
  added_parent_birth_date: string;
  added_parent_death_date: string;
  added_parent_of: string | null;
  other_source: "skip" | "add";
  other_parent_name: string;
  other_parent_first_name: string;
  other_parent_middle_name: string;
  other_parent_last_name: string;
  other_parent_birth_date: string;
  other_parent_death_date: string;
};

export function emptyDraft(email = ""): SubmissionDraft {
  return {
    kind: "new",
    person_id: null,
    parent_id: null,
    parent_source: "",
    link_side: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    birth_date: "",
    address: "",
    phone: "",
    email,
    notes: "",
    added_parent_first_name: "",
    added_parent_middle_name: "",
    added_parent_last_name: "",
    added_parent_birth_date: "",
    added_parent_death_date: "",
    added_parent_of: null,
    other_source: "skip",
    other_parent_name: "",
    other_parent_first_name: "",
    other_parent_middle_name: "",
    other_parent_last_name: "",
    other_parent_birth_date: "",
    other_parent_death_date: "",
  };
}

function parentWord(side: LinkSide | "") {
  return side === "mother" ? "mother" : side === "father" ? "father" : "parent";
}

function otherWord(side: LinkSide | "") {
  return side === "mother" ? "father" : side === "father" ? "mother" : "other parent";
}

export type SubmissionContext = {
  userId?: string | null | undefined;
  claimsByPerson?: ReadonlyMap<string, string> | undefined;
};

export function personClaimedByOther(personId: string, ctx?: SubmissionContext): boolean {
  if (!ctx?.claimsByPerson) return false;
  const owner = ctx.claimsByPerson.get(personId);
  return !!owner && owner !== ctx.userId;
}

/** Returns a problem string, or null if the draft is ready to submit. */
export function submissionProblem(
  d: SubmissionDraft,
  existingParentCount = 0,
  ctx?: SubmissionContext,
): string | null {
  if (!d.first_name.trim()) return "Your first name is required.";
  if (!d.birth_date.trim()) return "Birthday is required.";
  if (!isValidAddress(parseAddress(d.address))) return "Choose a country and city.";
  const phone = parsePhone(d.phone);
  if (!isValidPhone(phone)) {
    return phone.countryId === "ET"
      ? "Enter a valid Ethiopian mobile number (9xx xxx xxxx)."
      : "Enter a valid phone number.";
  }
  const email = d.email.trim();
  if (!email || !email.includes("@")) return "A valid email is required.";
  if (d.kind === "new") {
    if (d.link_side !== "father" && d.link_side !== "mother") {
      return "Choose whether you are linked through your father or mother.";
    }
    if (d.parent_source !== "listed" && d.parent_source !== "add") {
      return `Say whether your ${parentWord(d.link_side)} is already on the tree, or you need to add them.`;
    }
    if (d.parent_source === "listed" && !d.parent_id) {
      return `Your ${parentWord(d.link_side)} (already on the tree) is required.`;
    }
    if (d.parent_source === "add") {
      if (!d.added_parent_first_name.trim()) {
        return `Your ${parentWord(d.link_side)}'s first name is required.`;
      }
      if (!d.added_parent_of) {
        return `Pick who on the tree your ${parentWord(d.link_side)} belongs under.`;
      }
    }
    if (d.other_source === "add" && !d.other_parent_first_name.trim()) {
      return `Your ${otherWord(d.link_side)}'s first name is required.`;
    }
  }
  if (d.kind === "edit" && !d.person_id) return "Pick yourself from the tree first.";
  if (d.kind === "edit" && d.person_id && personClaimedByOther(d.person_id, ctx)) {
    return "That person is already linked to another account.";
  }
  if (ctx?.userId && ctx.claimsByPerson) {
    for (const [personId, ownerId] of ctx.claimsByPerson) {
      if (ownerId !== ctx.userId) continue;
      if (d.kind === "new" || (d.kind === "edit" && d.person_id && d.person_id !== personId)) {
        return "Your account is already linked to someone on the tree.";
      }
    }
  }
  if (d.kind === "edit" && d.parent_source === "add") {
    if (d.link_side !== "father" && d.link_side !== "mother") {
      return "Choose whether you are adding your father or mother.";
    }
    if (!d.added_parent_first_name.trim()) {
      return `Your ${parentWord(d.link_side)}'s first name is required.`;
    }
    if (existingParentCount === 0 && !d.added_parent_of) {
      return `Pick who on the tree your ${parentWord(d.link_side)} belongs under.`;
    }
  }
  return null;
}

/** Join form only needs a given name when father + grandfather are already on the tree. */
export function joinDraftUsesPatronymic(graph: FamilyGraph, d: SubmissionDraft): boolean {
  if (d.link_side !== "father") return false;
  if (d.kind === "edit" && d.person_id) return personHasPatronymicChain(graph, d.person_id);
  if (d.parent_source === "listed" && d.parent_id) {
    return hasPatronymicFatherChain(graph, d.parent_id);
  }
  if (d.parent_source === "add" && d.added_parent_of) {
    return hasPatronymicFatherChain(graph, d.added_parent_of);
  }
  return false;
}

/** Preview full patronymic name while filling in a join form. */
export function previewPatronymicForJoin(graph: FamilyGraph, d: SubmissionDraft): string | null {
  const first = d.first_name.trim();
  if (!first || !joinDraftUsesPatronymic(graph, d)) return null;
  if (d.kind === "edit" && d.person_id) {
    for (const pid of graph.parentsOf.get(d.person_id) ?? []) {
      if (hasPatronymicFatherChain(graph, pid)) {
        return previewPatronymicName(graph, first, pid);
      }
    }
    return null;
  }
  if (d.parent_source === "listed" && d.parent_id) {
    return previewPatronymicName(graph, first, d.parent_id);
  }
  if (d.parent_source === "add" && d.added_parent_of) {
    const grandfather = graph.byId.get(d.added_parent_of);
    const fatherFirst = d.added_parent_first_name.trim();
    if (!grandfather || !fatherFirst) return null;
    return `${first} ${fatherFirst} ${grandfather.first_name}`;
  }
  return null;
}
