import { X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { personPortraitUrl } from "@/lib/brand";
import { ancestryPath, descendantCount, siblingsOf, type FamilyGraph } from "@/lib/family";

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
  if (!personId) return null;
  const person = graph.byId.get(personId);
  if (!person) return null;

  const parents = graph.parentsOf.get(person.id) ?? [];
  const children = graph.childrenOf.get(person.id) ?? [];
  const spouses = graph.spousesOf.get(person.id) ?? [];
  const siblings = siblingsOf(graph, person.id);
  const path = ancestryPath(graph, person.id);
  const portraitUrl = personPortraitUrl(graph, person.id);

  return (
    <aside className="absolute inset-x-0 bottom-0 z-30 flex max-h-[78%] w-full flex-col gap-5 overflow-y-auto rounded-t-2xl border-t border-border bg-card/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_oklch(0.4_0.03_70_/_0.15)] backdrop-blur sm:inset-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-none sm:border-l sm:border-t-0 sm:pb-5 sm:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {portraitUrl && (
            <Avatar className="size-16 shrink-0 border border-border">
              <AvatarImage src={portraitUrl} alt={person.display_name} />
              <AvatarFallback>{person.display_name.slice(0, 1)}</AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {person.display_name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Generation {(graph.depthOf.get(person.id) ?? 0) + 1} ·{" "}
              {descendantCount(graph, person.id)} descendants
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" aria-label="Close profile" onClick={onClose}>
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

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parents
        </h3>
        <Names graph={graph} ids={parents} onSelect={onNavigatePerson} />
      </section>
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Spouses
        </h3>
        <Names graph={graph} ids={spouses} onSelect={onNavigatePerson} />
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
  );
}
