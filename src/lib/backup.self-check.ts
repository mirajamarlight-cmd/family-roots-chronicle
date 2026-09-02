import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupDownloadFilename,
  backupExcelDownloadFilename,
  normalizeBackup,
  validateBackupStructure,
} from "./backup-format.ts";

const sample = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exported_at: "2026-08-31T00:00:00.000Z",
  people: [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      first_name: "Ahmed",
      middle_name: null,
      last_name: "Yonis",
      display_name: "Ahmed Yonis",
      gender: "male",
      birth_date: null,
      death_date: null,
      is_deceased: false,
      photo_url: null,
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      first_name: "Feqi",
      middle_name: null,
      last_name: "Ahmed",
      display_name: "Feqi Ahmed",
      gender: "male",
      birth_date: null,
      death_date: null,
      is_deceased: false,
      photo_url: null,
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  parent_child: [
    {
      id: "b0000000-0000-4000-8000-000000000001",
      parent_id: "a0000000-0000-4000-8000-000000000001",
      child_id: "a0000000-0000-4000-8000-000000000002",
      relationship_type: "biological",
      child_order: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  marriages: [],
  person_claims: [
    {
      user_id: "c0000000-0000-4000-8000-000000000001",
      person_id: "a0000000-0000-4000-8000-000000000002",
      address: "Addis",
      phone: "+251911",
      email: "feqi@example.com",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const ok = validateBackupStructure(sample);
if ("error" in ok) throw new Error(`expected valid backup: ${ok.error}`);

const normalized = normalizeBackup(ok.backup);
if (normalized.people.some((p) => !p.gender)) throw new Error("normalize should set gender");
if (normalized.parent_child.some((l) => l.child_order == null)) throw new Error("normalize should set child_order");

const withNullOrder = {
  ...sample,
  parent_child: sample.parent_child.map((l) => ({ ...l, child_order: null })),
};
const struct2 = validateBackupStructure(withNullOrder);
if ("error" in struct2) throw new Error(struct2.error);
const norm2 = normalizeBackup(struct2.backup);
if (norm2.parent_child[0]?.child_order !== 1) throw new Error("expected child_order 1");

const bad = validateBackupStructure({ format: "wrong", version: 99 });
if (!("error" in bad)) throw new Error("expected format error");

const filename = backupDownloadFilename();
if (!/^family-backup-\d{4}-\d{2}-\d{2}\.json$/.test(filename)) {
  throw new Error(`unexpected filename: ${filename}`);
}
const xlsxName = backupExcelDownloadFilename();
if (!/^family-backup-\d{4}-\d{2}-\d{2}\.xlsx$/.test(xlsxName)) {
  throw new Error(`unexpected xlsx filename: ${xlsxName}`);
}

console.log("backup.self-check ok");
