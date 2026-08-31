import type { FamilyBackup } from "./backup-format.ts";
import { backupExcelDownloadFilename } from "./backup-format.ts";

function parentLabels(childId: string, backup: FamilyBackup) {
  const personById = new Map(backup.people.map((p) => [p.id, p]));
  const parentIds = backup.parent_child.filter((l) => l.child_id === childId).map((l) => l.parent_id);

  let father = "";
  let mother = "";
  const other: string[] = [];

  for (const parentId of parentIds) {
    const parent = personById.get(parentId);
    if (!parent) continue;
    const name = parent.display_name;
    const g = parent.gender?.trim().toLowerCase();
    if (g === "female") mother = name;
    else if (g === "male") father = name;
    else other.push(name);
  }

  return {
    father,
    mother,
    other_parents: other.join("; "),
  };
}

/** ponytail: dynamic import keeps xlsx off the main admin bundle until export */
export async function downloadBackupExcel(backup: FamilyBackup) {
  const XLSX = await import("xlsx");

  const nameById = new Map(backup.people.map((p) => [p.id, p.display_name]));
  const claimByPerson = new Map(backup.person_claims.map((c) => [c.person_id, c]));

  const peopleRows = backup.people.map((p) => {
    const parents = parentLabels(p.id, backup);
    const claim = claimByPerson.get(p.id);
    return {
      id: p.id,
      display_name: p.display_name,
      first_name: p.first_name,
      middle_name: p.middle_name ?? "",
      last_name: p.last_name ?? "",
      gender: p.gender ?? "",
      birth_date: p.birth_date ?? "",
      death_date: p.death_date ?? "",
      is_deceased: p.is_deceased,
      father: parents.father,
      mother: parents.mother,
      other_parents: parents.other_parents,
      email: claim?.email ?? "",
      phone: claim?.phone ?? "",
      address: claim?.address ?? "",
      registered_member: claim ? "yes" : "",
      photo_url: p.photo_url ?? "",
      notes: p.notes ?? "",
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  const linkRows = backup.parent_child.map((l) => ({
    id: l.id,
    parent_id: l.parent_id,
    parent_name: nameById.get(l.parent_id) ?? "",
    parent_gender: backup.people.find((p) => p.id === l.parent_id)?.gender ?? "",
    child_id: l.child_id,
    child_name: nameById.get(l.child_id) ?? "",
    relationship: l.relationship_type,
    child_order: l.child_order ?? "",
    created_at: l.created_at,
  }));

  const marriageRows = backup.marriages.map((m) => ({
    id: m.id,
    person1_id: m.person1_id,
    person1_name: nameById.get(m.person1_id) ?? "",
    person2_id: m.person2_id,
    person2_name: nameById.get(m.person2_id) ?? "",
    marriage_date: m.marriage_date ?? "",
    notes: m.notes ?? "",
    created_at: m.created_at,
  }));

  const memberRows = backup.person_claims.map((c) => ({
    user_id: c.user_id,
    person_id: c.person_id,
    person_name: nameById.get(c.person_id) ?? "",
    address: c.address,
    phone: c.phone,
    email: c.email,
    created_at: c.created_at,
  }));

  const infoRows = [
    { field: "format", value: backup.format },
    { field: "version", value: String(backup.version) },
    { field: "exported_at", value: backup.exported_at },
    { field: "people_count", value: String(backup.people.length) },
    { field: "parent_child_count", value: String(backup.parent_child.length) },
    { field: "marriages_count", value: String(backup.marriages.length) },
    { field: "members_count", value: String(backup.person_claims.length) },
    {
      field: "relationships_note",
      value:
        "Parent→child links are in Parent_child. Father/mother on People are inferred from parent gender (male/female).",
    },
    {
      field: "contact_note",
      value: "Email, phone, address only exist for people who registered and linked an account (Members sheet).",
    },
    ...(backup.meta?.warnings ?? []).map((w, i) => ({
      field: `warning_${i + 1}`,
      value: w,
    })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleRows), "People");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linkRows), "Parent_child");
  if (marriageRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marriageRows), "Marriages");
  }
  if (memberRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), "Members");
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(infoRows), "Info");

  XLSX.writeFile(wb, backupExcelDownloadFilename());
}
