import { emptyDraft, submissionProblem, type SubmissionDraft } from "./submission-draft.ts";
import { formatRecordDate } from "./utils.ts";

function draft(over: Partial<SubmissionDraft>): SubmissionDraft {
  return {
    ...emptyDraft("a@b.c"),
    first_name: "Hamdi",
    birth_date: "1990-01-01",
    address: "Ethiopia, Harar",
    phone: "+251 911234567",
    ...over,
  };
}

function expectProblem(
  d: SubmissionDraft,
  includes: string,
  parentCount = 0,
  ctx?: { userId: string; claimsByPerson: Map<string, string> },
) {
  const problem = submissionProblem(d, parentCount, ctx);
  if (!problem?.toLowerCase().includes(includes.toLowerCase())) {
    throw new Error(`Expected problem containing "${includes}", got: ${problem}`);
  }
}

if (submissionProblem(draft({ kind: "edit", person_id: "p1" })) !== null) {
  throw new Error("complete edit draft should pass");
}
expectProblem(draft({ first_name: "" }), "first name");
expectProblem(draft({ birth_date: "" }), "birthday");
expectProblem(draft({ address: "" }), "country and city");
expectProblem(draft({ phone: "" }), "mobile");
expectProblem(draft({ email: "nope" }), "email");
expectProblem(draft({ kind: "new", link_side: "" }), "father or mother");
expectProblem(draft({ kind: "new", link_side: "mother" }), "already on the tree");
expectProblem(draft({ kind: "new", link_side: "mother", parent_source: "listed", parent_id: null }), "mother");
expectProblem(draft({ kind: "new", link_side: "father", parent_source: "listed", parent_id: null }), "father");
expectProblem(
  draft({ kind: "new", link_side: "mother", parent_source: "add", added_parent_first_name: "" }),
  "first name",
);
expectProblem(
  draft({
    kind: "new",
    link_side: "mother",
    parent_source: "add",
    added_parent_first_name: "Fatuma",
    added_parent_of: null,
  }),
  "belongs under",
);
expectProblem(draft({ kind: "edit", person_id: null }), "pick yourself");

const claims = new Map([["p-taken", "other-user"]]);
expectProblem(
  draft({ kind: "edit", person_id: "p-taken" }),
  "already linked",
  0,
  { userId: "me", claimsByPerson: claims },
);
if (
  submissionProblem(draft({ kind: "edit", person_id: "p-taken" }), 0, {
    userId: "other-user",
    claimsByPerson: claims,
  }) !== null
) {
  throw new Error("owner should still edit their linked person");
}
expectProblem(
  draft({ kind: "new", link_side: "mother", parent_source: "listed", parent_id: "p-mom" }),
  "already linked",
  0,
  { userId: "me", claimsByPerson: new Map([["p-mine", "me"]]) },
);

if (
  submissionProblem(
    draft({ kind: "new", link_side: "mother", parent_source: "listed", parent_id: "p-mom" }),
  ) !== null
) {
  throw new Error("listed mother should pass");
}
if (
  submissionProblem(
    draft({
      kind: "new",
      link_side: "father",
      parent_source: "add",
      added_parent_first_name: "Ahmed",
      added_parent_of: "p-grand",
    }),
  ) !== null
) {
  throw new Error("adding a late/missing father should pass");
}
if (
  submissionProblem(
    draft({
      kind: "edit",
      person_id: "p1",
      link_side: "mother",
      parent_source: "add",
      added_parent_first_name: "Fatuma",
      added_parent_death_date: "1980-01-01",
    }),
    1,
  ) !== null
) {
  throw new Error("edit adding the other parent should pass");
}
expectProblem(
  draft({
    kind: "new",
    link_side: "father",
    parent_source: "listed",
    parent_id: "p-dad",
    other_source: "add",
    other_parent_first_name: "",
  }),
  "mother",
);
if (
  submissionProblem(
    draft({
      kind: "new",
      link_side: "father",
      parent_source: "listed",
      parent_id: "p-dad",
      other_source: "add",
      other_parent_first_name: "Fatuma",
      other_parent_death_date: "1985-03-12",
    }),
  ) !== null
) {
  throw new Error("listed father plus adding a late mother should pass");
}

if (formatRecordDate("1985-03-12") !== "12 Mar 1985") {
  throw new Error(`unexpected date format: ${formatRecordDate("1985-03-12")}`);
}

console.log("submissions self-check passed");
