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

/** Returns a problem string, or null if the draft is ready to submit. */
export function submissionProblem(d: SubmissionDraft, existingParentCount = 0): string | null {
  if (!d.first_name.trim()) return "Your first name is required.";
  if (!d.birth_date.trim()) return "Birthday is required.";
  if (!d.address.trim()) return "Address is required.";
  if (!d.phone.trim()) return "Phone number is required.";
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
