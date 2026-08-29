import type { Person } from "@/lib/family";
import { emptyDraft, type PersonClaim, type SubmissionDraft } from "@/lib/submissions";

export function draftFromPerson(
  person: Person,
  email: string,
  claim: PersonClaim | null,
): SubmissionDraft {
  const mine = claim?.person_id === person.id ? claim : null;
  return {
    ...emptyDraft(mine?.email ?? email),
    kind: "edit",
    person_id: person.id,
    first_name: person.first_name,
    middle_name: person.middle_name ?? "",
    last_name: person.last_name ?? "",
    birth_date: person.birth_date ?? "",
    address: mine?.address ?? "",
    phone: mine?.phone ?? "",
    notes: person.notes ?? "",
  };
}
