import { Link } from "@tanstack/react-router";
import { GitBranch, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { personPortraitUrl } from "@/lib/brand";
import {
  ancestryPath,
  branchFocusId,
  descendantCount,
  siblingsOf,
  type FamilyGraph,
} from "@/lib/family";
import { cn } from "@/lib/utils";

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
          {graph.byId.get(id)?.display_name ?? "Unknown"}
        </button>
      ))}
    </div>
  );
}

export function PersonPanel({
  graph,
  personId,
  onClose,
  onNavigatePerson,
}: {
  graph: FamilyGraph;
  personId: string | null;
  onClose: () => void;
  onNavigatePerson: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (personId) {
      returnFocusRef.current = personId;
      closeRef.current?.focus();
    } else if (returnFocusRef.current) {
      const btn = document.querySelector<HTMLButtonElement>(
        `[data-node-id="${returnFocusRef.current}"]`,
      );
      btn?.focus();
      returnFocusRef.current = null;
    }
  }, [personId]);

  if (!personId) return null;
  const person = graph.byId.get(personId);
  if (!person) return null;

  const parents = graph.parentsOf.get(person.id) ?? [];
  const children = graph.childrenOf.get(person.id) ?? [];
  const siblings = siblingsOf(graph, person.id);
  const path = ancestryPath(graph, person.id);
  const portraitUrl = personPortraitUrl(graph, person.id);
  const branchId = branchFocusId(graph, person.id);

  return (
    <>
      {isMobile && (
        <button
          type="button"
          aria-label="Close profile"
          className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-panel-title"
        className={cn(
          "absolute z-30 flex w-full flex-col gap-5 overflow-y-auto border-border bg-card/95 backdrop-blur",
          isMobile
            ? "inset-x-0 bottom-0 max-h-[50%] rounded-t-2xl border-t p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_oklch(0.4_0.03_70_/_0.15)]"
            : "inset-y-0 right-0 h-full max-w-sm border-l p-5",
        )}
      >
        {isMobile && (
          <div className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {portraitUrl && (
              <Avatar className="size-16 shrink-0 border border-border">
                <AvatarImage src={portraitUrl} alt={person.display_name} />
                <AvatarFallback>{person.display_name.slice(0, 1)}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <h2
                id="person-panel-title"
                className="font-display text-xl font-semibold tracking-tight"
              >
                {person.display_name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Generation {(graph.depthOf.get(person.id) ?? 0) + 1} ·{" "}
                {descendantCount(graph, person.id)} descendants
              </p>
            </div>
          </div>
          <Button
            ref={closeRef}
            size="icon"
            variant="ghost"
            aria-label="Close profile"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {path.length > 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {path.map((p) => p.display_name).join(" › ")} › {person.display_name}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {person.gender && <Badge variant="secondary">{person.gender}</Badge>}
          {person.birth_date && <Badge variant="outline">b. {person.birth_date}</Badge>}
          {person.death_date && <Badge variant="outline">d. {person.death_date}</Badge>}
        </div>

        {branchId && (
          <Button asChild variant="outline" size="sm" className="w-full justify-center gap-2">
            <Link to="/" search={{ root: branchId }}>
              <GitBranch className="size-4" />
              View this branch in tree
            </Link>
          </Button>
        )}

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parents
          </h3>
          <Names graph={graph} ids={parents} onSelect={onNavigatePerson} />
        </section>
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Siblings
          </h3>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </h3>
            <p className="text-sm leading-relaxed">{person.notes}</p>
          </section>
        )}
      </aside>
    </>
  );
}
