import { Loader2, UserPlus, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { DualDateField } from "@/components/DualDateField";
import { PersonAvatarBadge } from "@/components/person-identity";
import { PersonContact } from "@/components/PersonContact";
import { RelationshipManager } from "@/components/RelationshipManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  descendantCount,
  effectiveDisplayName,
  personIsDeceased,
  type FamilyGraph,
  type Person,
} from "@/lib/family";
import { cn } from "@/lib/utils";

export type PersonDraft = {
  id?: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  birth_date: string;
  death_date: string;
  is_deceased: boolean;
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
  is_deceased: false,
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
    is_deceased: personIsDeceased(p),
    notes: p.notes ?? "",
    parent_id: "",
  };
}

function draftTitle(graph: FamilyGraph, draft: PersonDraft): string {
  const existing = draft.id ? graph.byId.get(draft.id) : undefined;
  if (existing) return effectiveDisplayName(graph, existing.id);
  const composed = [draft.first_name, draft.middle_name, draft.last_name].filter(Boolean).join(" ");
  if (composed) return composed;
  if (draft.id) return "Saved";
  const parent = draft.parent_id ? graph.byId.get(draft.parent_id) : undefined;
  if (parent) return `New child of ${effectiveDisplayName(graph, parent.id)}`;
  return "New person";
}

function InspectorSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm", className)}>
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function InspectorShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
}

function InspectorBody({
  graph,
  draft,
  onDraftChange,
  onDeceasedChange,
  onSave,
  onDelete,
  onClose,
  busy,
  closeRef,
}: {
  graph: FamilyGraph;
  draft: PersonDraft;
  onDraftChange: (draft: PersonDraft) => void;
  onDeceasedChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onDelete: (() => void) | undefined;
  onClose: () => void;
  busy: boolean;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const existing = draft.id ? graph.byId.get(draft.id) : undefined;
  const parent = draft.parent_id ? graph.byId.get(draft.parent_id) : undefined;
  const title = draftTitle(graph, draft);
  const isNew = !draft.id;

  return (
    <InspectorShell>
      <header className="shrink-0 border-b border-border/60 bg-card/80 px-5 py-4 backdrop-blur">
        <div className="flex items-start gap-3">
          {existing ? (
            <PersonAvatarBadge graph={graph} personId={existing.id} size="lg" className="ring-2 ring-border/40" />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/50 font-display text-lg font-semibold text-muted-foreground">
              {(draft.first_name.trim().slice(0, 1) || "+").toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 id="admin-inspector-title" className="font-display text-lg font-semibold leading-tight tracking-tight">
                {title}
              </h2>
              <Button
                ref={closeRef}
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 rounded-full"
                aria-label="Close"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {existing && (
                <Badge variant="outline" className="rounded-full text-[11px] font-normal">
                  {descendantCount(graph, existing.id)} descendants
                </Badge>
              )}
              {isNew && (
                <Badge className="gap-1 rounded-full text-[11px] font-medium">
                  <UserPlus className="size-3" aria-hidden />
                  New record
                </Badge>
              )}
              {isNew && parent && (
                <Badge variant="outline" className="rounded-full text-[11px] font-normal">
                  Under {effectiveDisplayName(graph, parent.id)}
                </Badge>
              )}
              {isNew && !parent && (
                <Badge variant="outline" className="rounded-full text-[11px] font-normal">
                  Root person
                </Badge>
              )}
              {draft.is_deceased && (
                <Badge variant="outline" className="rounded-full text-[11px] font-normal">
                  Deceased
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <InspectorSection title="Identity" description="Names shown across the family tree.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={draft.first_name}
                onChange={(e) => onDraftChange({ ...draft, first_name: e.target.value })}
                placeholder="Given name"
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="middle_name">Middle name</Label>
              <Input
                id="middle_name"
                value={draft.middle_name}
                onChange={(e) => onDraftChange({ ...draft, middle_name: e.target.value })}
                placeholder="Optional"
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                value={draft.last_name}
                onChange={(e) => onDraftChange({ ...draft, last_name: e.target.value })}
                placeholder="Family name"
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Gender</Label>
              <RadioGroup
                value={draft.gender || undefined}
                onValueChange={(value) =>
                  onDraftChange({ ...draft, gender: draft.gender === value ? "" : value })
                }
                className="flex flex-wrap gap-x-5 gap-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="male"
                    id="gender-male"
                    onPointerDown={(e) => {
                      if (draft.gender === "male") {
                        e.preventDefault();
                        onDraftChange({ ...draft, gender: "" });
                      }
                    }}
                  />
                  <Label htmlFor="gender-male" className="cursor-pointer font-normal">
                    Male
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="female"
                    id="gender-female"
                    onPointerDown={(e) => {
                      if (draft.gender === "female") {
                        e.preventDefault();
                        onDraftChange({ ...draft, gender: "" });
                      }
                    }}
                  />
                  <Label htmlFor="gender-female" className="cursor-pointer font-normal">
                    Female
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </InspectorSection>

        <InspectorSection title="Life details" description="Birth, death, and living status.">
          <div className="space-y-4">
            <DualDateField
              id="birth_date"
              label="Birth date"
              value={draft.birth_date}
              onChange={(iso) => onDraftChange({ ...draft, birth_date: iso })}
            />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="is_deceased" className="text-sm">
                  Deceased
                </Label>
                <p className="text-xs text-muted-foreground">
                  {draft.is_deceased ? "No longer living" : "Currently living"}
                </p>
              </div>
              <Switch
                id="is_deceased"
                checked={draft.is_deceased}
                disabled={busy}
                onCheckedChange={(deceased) =>
                  onDeceasedChange({
                    ...draft,
                    is_deceased: deceased,
                    death_date: deceased ? draft.death_date : "",
                  })
                }
                aria-label={draft.is_deceased ? "Mark as living" : "Mark as deceased"}
              />
            </div>
            {draft.is_deceased && (
              <DualDateField
                id="death_date"
                label="Death date"
                value={draft.death_date}
                onChange={(iso) => onDraftChange({ ...draft, death_date: iso })}
              />
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Notes" description="Private admin notes — not shown on the public tree.">
          <Textarea
            id="notes"
            value={draft.notes}
            onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
            placeholder="Memories, sources, spelling notes…"
            className="min-h-[88px] resize-y bg-background"
          />
        </InspectorSection>

        {draft.id && (
          <>
            <Separator className="opacity-60" />
            <InspectorSection title="Relationships" description="Parents, children, and siblings.">
              <RelationshipManager graph={graph} personId={draft.id} embedded />
            </InspectorSection>
          </>
        )}

        {draft.id && (
          <PersonContact
            personId={draft.id}
            className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm"
          />
        )}
      </div>

      <footer className="shrink-0 border-t border-border/60 bg-card/80 px-5 py-3 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onSave} disabled={busy} className="flex-1 rounded-full sm:order-1">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          {onDelete && (
            <Button variant="destructive" onClick={onDelete} disabled={busy} className="rounded-full sm:order-2">
              Delete
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Esc to close</p>
      </footer>
    </InspectorShell>
  );
}

export function AdminInspector({
  graph,
  draft,
  onDraftChange,
  onDeceasedChange,
  onSave,
  onDelete,
  onClose,
  busy,
}: {
  graph: FamilyGraph;
  draft: PersonDraft;
  onDraftChange: (draft: PersonDraft) => void;
  onDeceasedChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onDelete: (() => void) | undefined;
  onClose: () => void;
  busy: boolean;
}) {
  const isMobile = useIsMobile();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobile) return;
    closeRef.current?.focus({ preventScroll: true });
  }, [draft.id, draft.parent_id, isMobile]);

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
      onDeceasedChange={onDeceasedChange}
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
          className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(90dvh,42rem)] w-full flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card/95 shadow-[0_-8px_30px_oklch(0.4_0.03_70_/_0.15)] backdrop-blur"
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
          {body}
        </aside>
      </>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label="Person editor"
      className={cn(
        "flex min-h-0 w-full max-w-[22rem] shrink-0 flex-col self-stretch overflow-hidden border-l border-border/80 bg-card/95 shadow-xl backdrop-blur xl:max-w-sm",
        "animate-in slide-in-from-right-4 duration-200",
      )}
    >
      {body}
    </aside>
  );
}
