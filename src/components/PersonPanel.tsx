import { GitBranch, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { PersonAvatarBadge } from "@/components/person-identity";
import { PersonContact } from "@/components/PersonContact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  branchFocusId,
  descendantCount,
  effectiveDisplayName,
  lineagePathLabel,
  siblingsOf,
  type FamilyGraph,
  type Person,
} from "@/lib/family";
import { cn, formatRecordDate } from "@/lib/utils";

function Names({
  graph,
  ids,
  onSelect,
}: {
  graph: FamilyGraph;
  ids: string[];
  onSelect: (id: string) => void;
}) {
  if (!ids.length) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs transition-colors hover:bg-secondary"
        >
          {effectiveDisplayName(graph, id)}
        </button>
      ))}
    </div>
  );
}

function PanelBody({
  graph,
  person,
  onClose,
  onNavigatePerson,
  onViewBranch,
  closeRef,
}: {
  graph: FamilyGraph;
  person: Person;
  onClose: () => void;
  onNavigatePerson: (id: string) => void;
  onViewBranch?: ((branchId: string) => void) | undefined;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const parents = graph.parentsOf.get(person.id) ?? [];
  const children = graph.childrenOf.get(person.id) ?? [];
  const siblings = siblingsOf(graph, person.id);
  const branchId = branchFocusId(graph, person.id);
  const pathLabel = lineagePathLabel(graph, person.id);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PersonAvatarBadge graph={graph} personId={person.id} size="lg" />
          <div className="min-w-0">
            <h2 id="person-panel-title" className="font-display text-xl font-semibold tracking-tight">
              {effectiveDisplayName(graph, person.id)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Generation {(graph.depthOf.get(person.id) ?? 0) + 1} ·{" "}
              {descendantCount(graph, person.id)} descendants
            </p>
          </div>
        </div>
        <Button ref={closeRef} size="icon" variant="ghost" aria-label="Close profile" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {pathLabel && (
        <p className="text-xs leading-relaxed text-muted-foreground">{pathLabel}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {person.gender && <Badge variant="secondary">{person.gender}</Badge>}
        {person.birth_date && <Badge variant="outline">b. {formatRecordDate(person.birth_date)}</Badge>}
        {person.death_date && <Badge variant="outline">d. {formatRecordDate(person.death_date)}</Badge>}
      </div>

      {branchId && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2"
          onClick={() => onViewBranch?.(branchId)}
        >
          <GitBranch className="size-4" />
          View this branch in tree
        </Button>
      )}

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parents</h3>
        <Names graph={graph} ids={parents} onSelect={onNavigatePerson} />
      </section>
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Siblings</h3>
        <Names graph={graph} ids={siblings} onSelect={onNavigatePerson} />
      </section>
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Children ({children.length})
        </h3>
        <Names graph={graph} ids={children} onSelect={onNavigatePerson} />
      </section>

      {person.notes && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
          <p className="text-sm leading-relaxed">{person.notes}</p>
        </section>
      )}

      <PersonContact personId={person.id} />
    </>
  );
}

export function PersonPanel({
  graph,
  personId,
  onClose,
  onNavigatePerson,
  onViewBranch,
}: {
  graph: FamilyGraph;
  personId: string | null;
  onClose: () => void;
  onNavigatePerson: (id: string) => void;
  onViewBranch?: ((branchId: string) => void) | undefined;
}) {
  const isMobile = useIsMobile();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (personId) {
      returnFocusRef.current = personId;
      closeRef.current?.focus();
    } else if (returnFocusRef.current) {
      const id = returnFocusRef.current;
      const btn =
        document.querySelector<HTMLElement>(`[data-node-id="${id}"]`) ??
        document.querySelector<HTMLElement>(`[data-tree-item-id="${id}"] [tabindex]`);
      btn?.focus();
      returnFocusRef.current = null;
    }
  }, [personId]);

  useEffect(() => {
    if (!personId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [personId, onClose]);

  if (!personId) return null;
  const person = graph.byId.get(personId);
  if (!person) return null;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          aria-label="Close profile"
          className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="person-panel-title"
          className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(70dvh,32rem)] w-full flex-col gap-5 overflow-y-auto rounded-t-2xl border-t border-border bg-card/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_oklch(0.4_0.03_70_/_0.15)] backdrop-blur"
        >
          <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
          <PanelBody
            graph={graph}
            person={person}
            onClose={onClose}
            onNavigatePerson={onNavigatePerson}
            onViewBranch={onViewBranch}
            closeRef={closeRef}
          />
        </aside>
      </>
    );
  }

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-panel-title"
      className={cn(
        "flex h-full w-full max-w-sm shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card/95 p-5 backdrop-blur",
        "animate-in slide-in-from-right-4 duration-200",
      )}
    >
      <PanelBody
        graph={graph}
        person={person}
        onClose={onClose}
        onNavigatePerson={onNavigatePerson}
        onViewBranch={onViewBranch}
        closeRef={closeRef}
      />
    </aside>
  );
}
