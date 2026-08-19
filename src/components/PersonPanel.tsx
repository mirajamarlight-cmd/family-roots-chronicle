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
    <aside className="absolute right-0 top-0 z-30 flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto border-l border-border bg-card/95 p-5 backdrop-blur">
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
