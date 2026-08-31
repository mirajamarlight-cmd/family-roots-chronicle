import type { Database } from "@/integrations/supabase/types";

export const BACKUP_FORMAT = "family-roots-chronicle-backup";
export const BACKUP_VERSION = 1;

export type BackupPerson = Database["public"]["Tables"]["people"]["Row"];
export type BackupLink = Database["public"]["Tables"]["parent_child"]["Row"];
export type BackupMarriage = Database["public"]["Tables"]["marriages"]["Row"];
export type BackupClaim = Database["public"]["Tables"]["person_claims"]["Row"];

export type FamilyBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exported_at: string;
  people: BackupPerson[];
  parent_child: BackupLink[];
  marriages: BackupMarriage[];
  person_claims: BackupClaim[];
  meta?: {
    warnings: string[];
  };
};

export type BackupPreview = {
  people: number;
  parent_child: number;
  marriages: number;
  person_claims: number;
  exported_at: string | null;
};

export type ImportMode = "merge" | "replace";

export function backupDownloadDateStem() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `family-backup-${y}-${m}-${day}`;
}

export function backupDownloadFilename() {
  return `${backupDownloadDateStem()}.json`;
}

export function backupExcelDownloadFilename() {
  return `${backupDownloadDateStem()}.xlsx`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Structural validation — no graph cycle check (see backup.ts). */
export function validateBackupStructure(raw: unknown): { backup: FamilyBackup } | { error: string } {
  if (!isRecord(raw)) return { error: "Backup must be a JSON object" };
  if (raw.format !== BACKUP_FORMAT) return { error: "Unrecognized backup format" };
  if (raw.version !== BACKUP_VERSION) return { error: `Unsupported backup version (${raw.version})` };

  if (!Array.isArray(raw.people)) return { error: "Missing people array" };
  if (!Array.isArray(raw.parent_child)) return { error: "Missing parent_child array" };
  if (!Array.isArray(raw.marriages)) return { error: "Missing marriages array" };
  if (!Array.isArray(raw.person_claims)) return { error: "Missing person_claims array" };

  const people = raw.people as BackupPerson[];
  const parent_child = raw.parent_child as BackupLink[];
  const marriages = raw.marriages as BackupMarriage[];
  const person_claims = raw.person_claims as BackupClaim[];

  const personIds = new Set<string>();
  for (const p of people) {
    if (!p?.id || typeof p.first_name !== "string" || typeof p.display_name !== "string") {
      return { error: "Invalid person row in backup" };
    }
    personIds.add(p.id);
  }

  for (const link of parent_child) {
    if (!link?.id || !link.parent_id || !link.child_id) return { error: "Invalid parent_child row" };
    if (!personIds.has(link.parent_id) || !personIds.has(link.child_id)) {
      return { error: `Relationship references a person not in backup (${link.parent_id} → ${link.child_id})` };
    }
  }

  for (const m of marriages) {
    if (!m?.id || !m.person1_id || !m.person2_id) return { error: "Invalid marriage row" };
    if (!personIds.has(m.person1_id) || !personIds.has(m.person2_id)) {
      return { error: "Marriage references a person not in backup" };
    }
  }

  for (const claim of person_claims) {
    if (!claim?.user_id || !claim.person_id) return { error: "Invalid person_claims row" };
    if (!personIds.has(claim.person_id)) {
      return { error: `Claim references person ${claim.person_id} not in backup` };
    }
  }

  const exported_at =
    typeof raw.exported_at === "string" ? raw.exported_at : new Date().toISOString();

  return {
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exported_at,
      people,
      parent_child,
      marriages,
      person_claims,
    },
  };
}

export function parseBackupJson(text: string): { backup: FamilyBackup } | { error: string } {
  try {
    return validateBackupStructure(JSON.parse(text));
  } catch {
    return { error: "Invalid JSON file" };
  }
}

export function previewBackup(backup: FamilyBackup): BackupPreview {
  return {
    people: backup.people.length,
    parent_child: backup.parent_child.length,
    marriages: backup.marriages.length,
    person_claims: backup.person_claims.length,
    exported_at: backup.exported_at,
  };
}

/** Data-quality notes — does not block import. */
export function analyzeBackup(backup: FamilyBackup): string[] {
  const warnings: string[] = [];
  const noGender = backup.people.filter((p) => !p.gender?.trim()).length;
  if (noGender > 0) {
    warnings.push(`${noGender} people missing gender (will default to male on normalize)`);
  }
  const deceasedNoDate = backup.people.filter((p) => p.is_deceased && !p.death_date).length;
  if (deceasedNoDate > 0) {
    warnings.push(
      `${deceasedNoDate} marked deceased without a death date — add dates in the tree editor when you can`,
    );
  }
  const nullOrder = backup.parent_child.filter((l) => l.child_order == null).length;
  if (nullOrder > 0) {
    warnings.push(`${nullOrder} sibling links missing birth order (filled on normalize/export)`);
  }
  const childIds = new Set(backup.parent_child.map((l) => l.child_id));
  const roots = backup.people.filter((p) => !childIds.has(p.id)).length;
  if (roots > 1) {
    warnings.push(`${roots} root ancestors (expected for a large tree)`);
  }
  return warnings;
}

function fillMissingChildOrders(links: BackupLink[]): BackupLink[] {
  const byParent = new Map<string, BackupLink[]>();
  for (const link of links) {
    const group = byParent.get(link.parent_id) ?? [];
    group.push(link);
    byParent.set(link.parent_id, group);
  }

  const orderById = new Map<string, number>();
  for (const group of byParent.values()) {
    const sorted = [...group].sort((a, b) => {
      const ao = a.child_order ?? 1_000_000;
      const bo = b.child_order ?? 1_000_000;
      if (ao !== bo) return ao - bo;
      return a.child_id.localeCompare(b.child_id);
    });
    let next = 1;
    for (const link of sorted) {
      orderById.set(link.id, link.child_order ?? next++);
    }
  }

  return links.map((link) => ({
    ...link,
    child_order: orderById.get(link.id) ?? link.child_order,
  }));
}

/** Clean common legacy gaps before export/import. */
export function normalizeBackup(backup: FamilyBackup): FamilyBackup {
  const warnings = analyzeBackup(backup);
  return {
    ...backup,
    people: backup.people.map((p) => ({
      ...p,
      gender: p.gender?.trim() || "male",
    })),
    parent_child: fillMissingChildOrders(backup.parent_child),
    meta: warnings.length > 0 ? { warnings } : undefined,
  };
}
