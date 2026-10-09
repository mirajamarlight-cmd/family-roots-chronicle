import type { Link, Marriage, Person } from "@/lib/family";
import { db } from "@/server/db";

export async function pgFetchPeople(): Promise<Person[]> {
  const rows = await db()`
    SELECT id, first_name, middle_name, last_name, display_name, gender,
           birth_date::text, death_date::text, photo_url, notes, is_deceased
    FROM people
    ORDER BY display_name
  `;
  return rows.map((r) => ({
    id: String(r["id"]),
    first_name: String(r["first_name"]),
    middle_name: (r["middle_name"] as string | null) ?? null,
    last_name: (r["last_name"] as string | null) ?? null,
    display_name: String(r["display_name"]),
    gender: (r["gender"] as string | null) ?? null,
    birth_date: (r["birth_date"] as string | null) ?? null,
    death_date: (r["death_date"] as string | null) ?? null,
    photo_url: (r["photo_url"] as string | null) ?? null,
    notes: (r["notes"] as string | null) ?? null,
    is_deceased: Boolean(r["is_deceased"]),
  }));
}

export async function pgFetchLinks(): Promise<Link[]> {
  const rows = await db()`
    SELECT id, parent_id, child_id, relationship_type, child_order
    FROM parent_child
  `;
  return rows.map((r) => ({
    id: String(r["id"]),
    parent_id: String(r["parent_id"]),
    child_id: String(r["child_id"]),
    relationship_type: String(r["relationship_type"]),
    child_order: r["child_order"] == null ? null : Number(r["child_order"]),
  }));
}

export async function pgFetchMarriages(): Promise<Marriage[]> {
  const rows = await db()`
    SELECT id, person1_id, person2_id, marriage_date::text, notes
    FROM marriages
  `;
  return rows.map((r) => ({
    id: String(r["id"]),
    person1_id: String(r["person1_id"]),
    person2_id: String(r["person2_id"]),
    marriage_date: (r["marriage_date"] as string | null) ?? null,
    notes: (r["notes"] as string | null) ?? null,
  }));
}

export async function pgUpdatePersonDeceased(
  id: string,
  isDeceased: boolean,
  deathDate: string | null,
): Promise<void> {
  const death_date = isDeceased ? deathDate : null;
  await db()`
    UPDATE people
    SET is_deceased = ${isDeceased}, death_date = ${death_date}
    WHERE id = ${id}::uuid
  `;
}

export async function pgInsertPerson(row: {
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  display_name: string;
  gender: string | null;
  birth_date: string | null;
  death_date: string | null;
  notes: string | null;
}): Promise<string> {
  const rows = await db()`
    INSERT INTO people (
      first_name, middle_name, last_name, display_name, gender, birth_date, death_date, notes
    ) VALUES (
      ${row.first_name}, ${row.middle_name}, ${row.last_name}, ${row.display_name},
      ${row.gender}, ${row.birth_date}, ${row.death_date}, ${row.notes}
    )
    RETURNING id
  `;
  return String(rows[0]!["id"]);
}

export async function pgUpdatePerson(
  id: string,
  patch: Record<string, string | boolean | null>,
): Promise<void> {
  // ponytail: fixed column set — avoid dynamic SQL string building
  await db()`
    UPDATE people SET
      first_name = COALESCE(${patch["first_name"] ?? null}, first_name),
      middle_name = CASE WHEN ${"middle_name" in patch} THEN ${patch["middle_name"] ?? null} ELSE middle_name END,
      last_name = CASE WHEN ${"last_name" in patch} THEN ${patch["last_name"] ?? null} ELSE last_name END,
      display_name = COALESCE(${patch["display_name"] ?? null}, display_name),
      gender = CASE WHEN ${"gender" in patch} THEN ${patch["gender"] ?? null} ELSE gender END,
      birth_date = CASE WHEN ${"birth_date" in patch} THEN ${patch["birth_date"] ?? null} ELSE birth_date END,
      death_date = CASE WHEN ${"death_date" in patch} THEN ${patch["death_date"] ?? null} ELSE death_date END,
      notes = CASE WHEN ${"notes" in patch} THEN ${patch["notes"] ?? null} ELSE notes END,
      photo_url = CASE WHEN ${"photo_url" in patch} THEN ${patch["photo_url"] ?? null} ELSE photo_url END,
      is_deceased = CASE WHEN ${"is_deceased" in patch} THEN ${Boolean(patch["is_deceased"])} ELSE is_deceased END
    WHERE id = ${id}::uuid
  `;
}

export async function pgDeletePerson(id: string): Promise<void> {
  await db()`DELETE FROM people WHERE id = ${id}::uuid`;
}

export async function pgInsertParentChild(link: {
  parent_id: string;
  child_id: string;
  relationship_type?: string;
  child_order?: number | null;
}): Promise<void> {
  await db()`
    INSERT INTO parent_child (parent_id, child_id, relationship_type, child_order)
    VALUES (
      ${link.parent_id}::uuid,
      ${link.child_id}::uuid,
      ${link.relationship_type ?? "biological"},
      ${link.child_order ?? null}
    )
  `;
}

export async function pgUpdateChildOrder(id: string, childOrder: number | null): Promise<void> {
  await db()`UPDATE parent_child SET child_order = ${childOrder} WHERE id = ${id}::uuid`;
}

export async function pgDeleteParentChild(id: string): Promise<void> {
  await db()`DELETE FROM parent_child WHERE id = ${id}::uuid`;
}

export async function pgDeleteParentChildPair(parentId: string, childId: string): Promise<void> {
  await db()`
    DELETE FROM parent_child
    WHERE parent_id = ${parentId}::uuid AND child_id = ${childId}::uuid
  `;
}

export async function pgSetChildOrderForParent(
  parentId: string,
  orderedChildIds: string[],
): Promise<void> {
  await db().begin(async (tx) => {
    for (let index = 0; index < orderedChildIds.length; index++) {
      const childId = orderedChildIds[index]!;
      await tx`
        UPDATE parent_child
        SET child_order = ${index}
        WHERE parent_id = ${parentId}::uuid AND child_id = ${childId}::uuid
      `;
    }
  });
}

export async function pgIsAdmin(userId: string): Promise<boolean> {
  const rows = await db()`
    SELECT 1 FROM user_roles WHERE user_id = ${userId}::uuid AND role = 'admin' LIMIT 1
  `;
  return rows.length > 0;
}
