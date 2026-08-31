import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { downloadBackupExcel } from "@/lib/backup-excel";
import {
  backupDownloadFilename,
  backupExcelDownloadFilename,
  downloadJsonFile,
  fetchBackupData,
  parseBackupJson,
  previewBackup,
  analyzeBackup,
  type FamilyBackup,
  type ImportMode,
} from "@/lib/backup";
import { importFamilyBackupFn } from "@/lib/backup.functions";
import { formatRelativeTime } from "@/lib/utils";

export function AdminBackup() {
  const queryClient = useQueryClient();
  const importFn = useServerFn(importFamilyBackupFn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<"json" | "excel" | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<FamilyBackup | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [fileWarnings, setFileWarnings] = useState<string[]>([]);

  const preview = pendingBackup ? previewBackup(pendingBackup) : null;

  const handleExportJson = async () => {
    setExporting("json");
    try {
      const data = await fetchBackupData();
      downloadJsonFile(data, backupDownloadFilename());
      toast.success("JSON backup downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const data = await fetchBackupData();
      await downloadBackupExcel(data);
      toast.success("Excel backup downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleFile = async (file: File | undefined) => {
    setFileError(null);
    setFileWarnings([]);
    setPendingBackup(null);
    if (!file) return;

    const text = await file.text();
    const parsed = parseBackupJson(text);
    if ("error" in parsed) {
      setFileError(parsed.error);
      return;
    }
    setPendingBackup(parsed.backup);
    setFileWarnings(parsed.backup.meta?.warnings ?? analyzeBackup(parsed.backup));
  };

  const handleImport = async () => {
    if (!pendingBackup) return;
    const mode: ImportMode = replaceMode ? "replace" : "merge";
    if (
      replaceMode &&
      !window.confirm(
        "Replace entire tree? This deletes all people, relationships, marriages, and registered member links before importing. This cannot be undone.",
      )
    ) {
      return;
    }

    setImporting(true);
    try {
      const result = await importFn({ data: { backup: pendingBackup, mode } });
      if (result.ok) {
        toast.success(
          `Imported ${result.peopleUpserted} people, ${result.linksUpserted} links, ${result.claimsUpserted} member records`,
        );
        setPendingBackup(null);
        if (fileRef.current) fileRef.current.value = "";
        void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
        void queryClient.invalidateQueries({ queryKey: ["registered-members"] });
        void queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
        void queryClient.invalidateQueries({ queryKey: ["join-state"] });
      } else {
        toast.error("Import finished with errors");
      }
      if (result.errors.length > 0) {
        console.error("Backup import errors:", result.errors);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/60 bg-card/40 px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">Backup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export or restore the full family record — people, relationships, marriages, and registered member contact
          details.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto grid max-w-2xl gap-6">
          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold">Export</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              JSON for full restore. Excel for browsing and editing in a spreadsheet (import still uses JSON).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="rounded-full gap-2"
                onClick={() => void handleExportJson()}
                disabled={exporting !== null}
              >
                {exporting === "json" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4" aria-hidden />
                )}
                Download JSON
              </Button>
              <Button
                variant="outline"
                className="rounded-full gap-2"
                onClick={() => void handleExportExcel()}
                disabled={exporting !== null}
              >
                {exporting === "excel" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="size-4" aria-hidden />
                )}
                Download Excel
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-mono">{backupDownloadFilename()}</span>
              {" · "}
              <span className="font-mono">{backupExcelDownloadFilename()}</span>
            </p>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold">Import</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Merge adds or updates records by ID. Replace clears the tree first — use only when restoring from a full
              backup.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => void handleFile(e.target.files?.[0])}
                aria-label="Choose backup file"
              />

              {fileError && (
                <Alert variant="destructive">
                  <AlertTitle>Invalid backup</AlertTitle>
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              )}

              {preview && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
                  <p className="font-medium">Ready to import</p>
                  <ul className="mt-2 space-y-0.5 text-muted-foreground">
                    <li>{preview.people} people</li>
                    <li>{preview.parent_child} parent–child links</li>
                    <li>{preview.marriages} marriages</li>
                    <li>{preview.person_claims} registered member records</li>
                    {preview.exported_at && (
                      <li>Exported {formatRelativeTime(preview.exported_at)}</li>
                    )}
                  </ul>
                  {fileWarnings.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                      {fileWarnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <Checkbox
                  id="replace-mode"
                  checked={replaceMode}
                  onCheckedChange={(v) => setReplaceMode(v === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="replace-mode" className="text-sm font-medium leading-none">
                    Replace entire tree before import
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Deletes all existing people and relationships. Registered members lose their tree link until claims
                    are restored from the backup.
                  </p>
                </div>
              </div>

              {replaceMode && (
                <Alert>
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertTitle>Destructive action</AlertTitle>
                  <AlertDescription>
                    Replace mode wipes the current tree. Only use when restoring from a complete backup of this site.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="rounded-full gap-2"
                disabled={!pendingBackup || importing}
                onClick={() => void handleImport()}
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
                {replaceMode ? "Replace and import" : "Merge import"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Member records link to auth accounts. Claims import only works when those user accounts still exist in
                this project.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
