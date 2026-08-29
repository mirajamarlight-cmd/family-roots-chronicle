import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { DualDateField } from "@/components/DualDateField";
import { PersonAvatarBadge } from "@/components/person-identity";
import { PersonContact } from "@/components/PersonContact";
import { RelationshipManager } from "@/components/RelationshipManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { descendantCount, type FamilyGraph, type Person } from "@/lib/family";
import { cn } from "@/lib/utils";

export type PersonDraft = {
  id?: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  birth_date: string;
  death_date: string;
  notes: string;
  parent_id: string;
};

export const emptyPersonDraft: PersonDraft = {
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  birth_date: "",
  death_date: "",
  notes: "",
  parent_id: "",
};

export function personToDraft(p: Person): PersonDraft {
  const gender = (p.gender ?? "").trim().toLowerCase();
  return {
    id: p.id,
    first_name: p.first_name,
    middle_name: p.middle_name ?? "",
    last_name: p.last_name ?? "",
    gender: gender === "male" || gender === "female" ? gender : "",
    birth_date: p.birth_date ?? "",
    death_date: p.death_date ?? "",
    notes: p.notes ?? "",
    parent_id: "",
  };
}

const NAME_FIELDS = [
  ["first_name", "First name", "text"],
  ["middle_name", "Middle name", "text"],
  ["last_name", "Last name", "text"],
] as const;

const DATE_FIELDS = [
  ["birth_date", "Birth date"],
  ["death_date", "Death date"],
] as const;

function InspectorBody({
  graph,
  draft,
  onDraftChange,
  onSave,
  onDelete,
  onClose,
  busy,
  closeRef,
}: {
  graph: FamilyGraph;
  draft: PersonDraft;
  onDraftChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onDelete: (() => void) | undefined;
  onClose: () => void;
  busy: boolean;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const existing = draft.id ? graph.byId.get(draft.id) : undefined;
  const parent = draft.parent_id ? graph.byId.get(draft.parent_id) : undefined;
  const title = existing
    ? existing.display_name
    : draft.id
      ? [draft.first_name, draft.middle_name, draft.last_name].filter(Boolean).join(" ") || "Saved"
      : parent
        ? `New child of ${parent.display_name}`
        : "New person";

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {existing ? (
            <PersonAvatarBadge graph={graph} personId={existing.id} size="lg" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-display text-xl font-semibold text-muted-foreground">
              {(draft.first_name.trim().slice(0, 1) || "+").toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 id="admin-inspector-title" className="font-display text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {existing && (
              <p className="mt-1 text-xs text-muted-foreground">
                Generation {(graph.depthOf.get(existing.id) ?? 0) + 1} ·{" "}
                {descendantCount(graph, existing.id)} descendants
              </p>
            )}
            {!draft.id && parent && (
              <p className="mt-1 text-xs text-muted-foreground">Added under {parent.display_name}</p>
            )}
            {!draft.id && !parent && (
              <p className="mt-1 text-xs text-muted-foreground">No parent — new root</p>
            )}
          </div>
        </div>
        <Button
          ref={closeRef}
          size="icon"
          variant="ghost"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NAME_FIELDS.map(([key, label, type]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              type={type}
              value={draft[key]}
              onChange={(e) => onDraftChange({ ...draft, [key]: e.target.value })}
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            value={draft.gender}
            onChange={(e) => onDraftChange({ ...draft, gender: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        {DATE_FIELDS.map(([key, label]) => (
          <DualDateField
            key={key}
            id={key}
            label={label}
            value={draft[key]}
            onChange={(iso) => onDraftChange({ ...draft, [key]: iso })}
          />
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={draft.notes}
            onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
          />
        </div>
      </div>

      {draft.id && <RelationshipManager graph={graph} personId={draft.id} />}

      {draft.id && <PersonContact personId={draft.id} className="space-y-1.5 rounded-xl border border-border bg-secondary/40 p-3" />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onSave} disabled={busy}>
          Save
        </Button>
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={busy}>
            Delete
          </Button>
        )}
      </div>
    </>
  );
}

export function AdminInspector({
  graph,
  draft,
  onDraftChange,
  onSave,
  onDelete,
  onClose,
  busy,
}: {
  graph: FamilyGraph;
  draft: PersonDraft;
  onDraftChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onDelete: (() => void) | undefined;
  onClose: () => void;
  busy: boolean;
}) {
  const isMobile = useIsMobile();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [draft.id, draft.parent_id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const body = (
    <InspectorBody
      graph={graph}
      draft={draft}
      onDraftChange={onDraftChange}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
      busy={busy}
      closeRef={closeRef}
    />
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          aria-label="Close inspector"
          className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-inspector-title"
          className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(85dvh,40rem)] w-full flex-col gap-5 overflow-y-auto rounded-t-2xl border-t border-border bg-card/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_oklch(0.4_0.03_70_/_0.15)] backdrop-blur"
        >
          <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
          {body}
        </aside>
      </>
    );
  }

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-inspector-title"
      className={cn(
        "flex h-full w-full max-w-sm shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card/95 p-5 backdrop-blur",
        "animate-in slide-in-from-right-4 duration-200",
      )}
    >
      {body}
    </aside>
  );
}
