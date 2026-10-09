import type { PersonClaim, PersonSubmission } from "@/lib/submissions";
import { db, withAppUser } from "@/server/db";

function mapSubmission(r: Record<string, unknown>): PersonSubmission {
  return r as unknown as PersonSubmission;
}

function mapClaim(r: Record<string, unknown>): PersonClaim {
  return r as unknown as PersonClaim;
}

export async function pgPersonClaimIndex(actorId: string): Promise<Map<string, string>> {
  const rows = await db()`SELECT * FROM person_claim_index(${actorId}::uuid)`;
  return new Map(
    rows.map((row) => [String(row["person_id"]), String(row["user_id"])]),
  );
}

export async function pgFetchJoinState(userId: string) {
  const [pendingRows, claimRows] = await Promise.all([
    db()`
      SELECT * FROM person_submissions
      WHERE user_id = ${userId}::uuid AND status = 'pending'
      LIMIT 1
    `,
    db()`
      SELECT * FROM person_claims WHERE user_id = ${userId}::uuid LIMIT 1
    `,
  ]);
  return {
    pending: pendingRows[0] ? mapSubmission(pendingRows[0] as Record<string, unknown>) : null,
    claim: claimRows[0] ? mapClaim(claimRows[0] as Record<string, unknown>) : null,
  };
}

export async function pgInsertSubmission(
  userId: string,
  row: Record<string, unknown>,
): Promise<void> {
  await withAppUser(userId, async (tx) => {
    await tx`
      INSERT INTO person_submissions (
        user_id, kind, person_id, parent_id, link_side,
        first_name, middle_name, last_name, birth_date,
        address, phone, email, notes, other_parent_name,
        added_parent_first_name, added_parent_middle_name, added_parent_last_name,
        added_parent_birth_date, added_parent_death_date, added_parent_of,
        other_parent_first_name, other_parent_middle_name, other_parent_last_name,
        other_parent_birth_date, other_parent_death_date
      ) VALUES (
        ${userId}::uuid,
        ${row["kind"] as string},
        ${row["person_id"] as string | null},
        ${row["parent_id"] as string | null},
        ${row["link_side"] as string | null},
        ${row["first_name"] as string},
        ${row["middle_name"] as string | null},
        ${row["last_name"] as string | null},
        ${row["birth_date"] as string},
        ${row["address"] as string},
        ${row["phone"] as string},
        ${row["email"] as string},
        ${row["notes"] as string | null},
        ${row["other_parent_name"] as string | null},
        ${row["added_parent_first_name"] as string | null},
        ${row["added_parent_middle_name"] as string | null},
        ${row["added_parent_last_name"] as string | null},
        ${row["added_parent_birth_date"] as string | null},
        ${row["added_parent_death_date"] as string | null},
        ${row["added_parent_of"] as string | null},
        ${row["other_parent_first_name"] as string | null},
        ${row["other_parent_middle_name"] as string | null},
        ${row["other_parent_last_name"] as string | null},
        ${row["other_parent_birth_date"] as string | null},
        ${row["other_parent_death_date"] as string | null}
      )
    `;
  });
}

export async function pgFetchPendingSubmissions(): Promise<PersonSubmission[]> {
  const rows = await db()`
    SELECT * FROM person_submissions WHERE status = 'pending' ORDER BY created_at
  `;
  return rows.map((r) => mapSubmission(r as Record<string, unknown>));
}

export async function pgFetchRegisteredMembers(): Promise<PersonClaim[]> {
  const rows = await db()`
    SELECT * FROM person_claims ORDER BY created_at DESC
  `;
  return rows.map((r) => mapClaim(r as Record<string, unknown>));
}

export async function pgApproveSubmission(id: string, actorId: string): Promise<string> {
  const rows = await db()`SELECT approve_submission(${id}::uuid, ${actorId}::uuid) AS id`;
  return String(rows[0]!["id"]);
}

export async function pgRejectSubmission(id: string, actorId: string): Promise<void> {
  await db()`SELECT reject_submission(${id}::uuid, ${actorId}::uuid)`;
}

export async function pgFetchClaimForPerson(personId: string): Promise<PersonClaim | null> {
  const rows = await db()`
    SELECT * FROM person_claims WHERE person_id = ${personId}::uuid LIMIT 1
  `;
  return rows[0] ? mapClaim(rows[0] as Record<string, unknown>) : null;
}
