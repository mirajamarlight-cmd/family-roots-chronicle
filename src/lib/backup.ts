import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { buildGraph, type Link, type Person } from "@/lib/family";

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type FamilyBackup,
  type ImportMode,
  normalizeBackup,
  validateBackupStructure,
} from "./backup-format.ts";

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  analyzeBackup,
  backupDownloadFilename,
  backupExcelDownloadFilename,
  normalizeBackup,
  previewBackup,
  type BackupClaim,
  type BackupLink,
  type BackupMarriage,
  type BackupPerson,
  type BackupPreview,
  type FamilyBackup,
  type ImportMode,
} from "./backup-format.ts";

const BATCH_SIZE = 100;

export function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchBackupData(): Promise<FamilyBackup> {
  const [peopleRes, linksRes, marriagesRes, claimsRes] = await Promise.all([
    supabase.from("people").select("*").order("display_name"),
    supabase.from("parent_child").select("*"),
    supabase.from("marriages").select("*"),
    supabase.from("person_claims").select("*"),
  ]);

  if (peopleRes.error) throw peopleRes.error;
  if (linksRes.error) throw linksRes.error;
  if (marriagesRes.error) throw marriagesRes.error;
  if (claimsRes.error) throw claimsRes.error;

  return normalizeBackup({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    people: peopleRes.data ?? [],
    parent_child: linksRes.data ?? [],
    marriages: marriagesRes.data ?? [],
    person_claims: claimsRes.data ?? [],
  });
}

export function validateBackup(raw: unknown): { backup: FamilyBackup } | { error: string } {
  const structural = validateBackupStructure(raw);
  if ("error" in structural) return structural;

  const { backup } = structural;
  try {
    const graphPeople: Person[] = backup.people.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      middle_name: p.middle_name,
      last_name: p.last_name,
      display_name: p.display_name,
      gender: p.gender,
      birth_date: p.birth_date,
      death_date: p.death_date,
      is_deceased: p.is_deceased ?? false,
      photo_url: p.photo_url,
      notes: p.notes,
    }));
    const graphLinks: Link[] = backup.parent_child.map((l) => ({
      id: l.id,
      parent_id: l.parent_id,
      child_id: l.child_id,
      relationship_type: l.relationship_type,
      child_order: l.child_order,
    }));
    buildGraph(graphPeople, graphLinks, []);
  } catch {
    return { error: "Backup tree structure is invalid (cycle or integrity issue)" };
  }

  return { backup: normalizeBackup(structural.backup) };
}

export function parseBackupJson(text: string): { backup: FamilyBackup } | { error: string } {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { error: "Invalid JSON file" };
  }
}

export type ImportResult = {
  ok: boolean;
  mode: ImportMode;
  peopleUpserted: number;
  linksUpserted: number;
  marriagesUpserted: number;
  claimsUpserted: number;
  errors: string[];
};

type DbClient = SupabaseClient<Database>;

async function upsertBatches<T extends Record<string, unknown>>(
  table: "people" | "parent_child" | "marriages" | "person_claims",
  rows: T[],
  onConflict: string,
  client: DbClient,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await client.from(table).upsert(chunk as never, { onConflict });
    if (error) errors.push(`${table} (rows ${i + 1}–${i + chunk.length}): ${error.message}`);
    else count += chunk.length;
  }
  return { count, errors };
}

export async function importFamilyBackup(
  treeClient: DbClient,
  claimsClient: DbClient,
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

  if (mode === "replace") {
    const sentinel = "00000000-0000-0000-0000-000000000000";
    const { error } = await treeClient.from("people").delete().neq("id", sentinel);
    if (error) {
      result.errors.push(`Could not clear tree: ${error.message}`);
      return result;
    }
  }

  const peopleRows = normalized.people.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    middle_name: p.middle_name,
    last_name: p.last_name,
    display_name: p.display_name,
    gender: p.gender,
    birth_date: p.birth_date,
    death_date: p.death_date,
    is_deceased: p.is_deceased ?? false,
    photo_url: p.photo_url,
    notes: p.notes,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const peopleRes = await upsertBatches("people", peopleRows, "id", treeClient);
  result.peopleUpserted = peopleRes.count;
  result.errors.push(...peopleRes.errors);

  const linksRes = await upsertBatches(
    "parent_child",
    normalized.parent_child.map((l) => ({
      id: l.id,
      parent_id: l.parent_id,
      child_id: l.child_id,
      relationship_type: l.relationship_type,
      child_order: l.child_order,
      created_at: l.created_at,
    })),
    "id",
    treeClient,
  );
  result.linksUpserted = linksRes.count;
  result.errors.push(...linksRes.errors);

  if (backup.marriages.length > 0) {
    const marriagesRes = await upsertBatches(
      "marriages",
      backup.marriages.map((m) => ({
        id: m.id,
        person1_id: m.person1_id,
        person2_id: m.person2_id,
        marriage_date: m.marriage_date,
        notes: m.notes,
        created_at: m.created_at,
      })),
      "id",
      treeClient,
    );
    result.marriagesUpserted = marriagesRes.count;
    result.errors.push(...marriagesRes.errors);
  }

  if (backup.person_claims.length > 0) {
    const claimsRes = await upsertBatches(
      "person_claims",
      backup.person_claims.map((c) => ({
        user_id: c.user_id,
        person_id: c.person_id,
        address: c.address,
        phone: c.phone,
        email: c.email,
        created_at: c.created_at,
      })),
      "user_id",
      claimsClient,
    );
    result.claimsUpserted = claimsRes.count;
    result.errors.push(...claimsRes.errors);
  }

  result.ok = result.errors.length === 0;
  return result;
}
