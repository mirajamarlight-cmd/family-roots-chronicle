import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type FamilyBackup,
  type ImportMode,
  normalizeBackup,
} from "@/lib/backup-format";
import type { ImportResult } from "@/lib/backup";
import { db } from "@/server/db";

export async function pgFetchBackupData(): Promise<FamilyBackup> {
  const [people, parent_child, marriages, person_claims] = await Promise.all([
    db()`SELECT * FROM people ORDER BY display_name`,
    db()`SELECT * FROM parent_child`,
    db()`SELECT * FROM marriages`,
    db()`SELECT * FROM person_claims`,
  ]);
  return normalizeBackup({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    people: people as never,
    parent_child: parent_child as never,
    marriages: marriages as never,
    person_claims: person_claims as never,
  });
}

export async function pgImportFamilyBackup(
  backup: FamilyBackup,
  mode: ImportMode,
): Promise<ImportResult> {
  const normalized = normalizeBackup(backup);
  const result: ImportResult = {
    ok: false,
    mode,
    peopleUpserted: 0,
    linksUpserted: 0,
    marriagesUpserted: 0,
    claimsUpserted: 0,
    errors: [],
  };

  try {
    await db().begin(async (tx) => {
      if (mode === "replace") {
        await tx`TRUNCATE person_claims, person_submissions, marriages, parent_child, people CASCADE`;
      }

      for (const p of normalized.people) {
        await tx`
          INSERT INTO people (
            id, first_name, middle_name, last_name, display_name, gender,
            birth_date, death_date, is_deceased, photo_url, notes, created_at, updated_at
          ) VALUES (
            ${p.id}::uuid, ${p.first_name}, ${p.middle_name}, ${p.last_name}, ${p.display_name},
            ${p.gender}, ${p.birth_date}, ${p.death_date}, ${p.is_deceased ?? false},
            ${p.photo_url}, ${p.notes}, ${p.created_at}, ${p.updated_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            middle_name = EXCLUDED.middle_name,
            last_name = EXCLUDED.last_name,
            display_name = EXCLUDED.display_name,
            gender = EXCLUDED.gender,
            birth_date = EXCLUDED.birth_date,
            death_date = EXCLUDED.death_date,
            is_deceased = EXCLUDED.is_deceased,
            photo_url = EXCLUDED.photo_url,
            notes = EXCLUDED.notes,
            updated_at = EXCLUDED.updated_at
        `;
        result.peopleUpserted++;
      }

      await tx`ALTER TABLE parent_child DISABLE TRIGGER USER`;
      for (const l of normalized.parent_child) {
        await tx`
          INSERT INTO parent_child (id, parent_id, child_id, relationship_type, child_order, created_at)
          VALUES (
            ${l.id}::uuid, ${l.parent_id}::uuid, ${l.child_id}::uuid,
            ${l.relationship_type}, ${l.child_order}, ${l.created_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            parent_id = EXCLUDED.parent_id,
            child_id = EXCLUDED.child_id,
            relationship_type = EXCLUDED.relationship_type,
            child_order = EXCLUDED.child_order
        `;
        result.linksUpserted++;
      }
      await tx`ALTER TABLE parent_child ENABLE TRIGGER USER`;

      for (const m of normalized.marriages) {
        await tx`
          INSERT INTO marriages (id, person1_id, person2_id, marriage_date, notes, created_at)
          VALUES (
            ${m.id}::uuid, ${m.person1_id}::uuid, ${m.person2_id}::uuid,
            ${m.marriage_date}, ${m.notes}, ${m.created_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            person1_id = EXCLUDED.person1_id,
            person2_id = EXCLUDED.person2_id,
            marriage_date = EXCLUDED.marriage_date,
            notes = EXCLUDED.notes
        `;
        result.marriagesUpserted++;
      }

      for (const c of normalized.person_claims) {
        await tx`
          INSERT INTO person_claims (user_id, person_id, address, phone, email, created_at)
          VALUES (
            ${c.user_id}::uuid, ${c.person_id}::uuid, ${c.address}, ${c.phone}, ${c.email}, ${c.created_at}
          )
          ON CONFLICT (user_id) DO UPDATE SET
            person_id = EXCLUDED.person_id,
            address = EXCLUDED.address,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email
        `;
        result.claimsUpserted++;
      }
    });
    result.ok = result.errors.length === 0;
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }
  return result;
}
