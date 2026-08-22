import { X } from "lucide-react";

import { PersonAvatarBadge } from "@/components/person-identity";
import { TreePersonSearch } from "@/components/TreePersonSearch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FamilyGraph } from "@/lib/family";
import { lineageLabel } from "@/lib/family";

export function RelationshipPersonPicker({
  graph,
  label,
  personId,
  excludeId,
  onSelect,
  onClear,
}: {
  graph: FamilyGraph;
  label: string;
  personId: string | null;
  excludeId?: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const person = personId ? graph.byId.get(personId) : null;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {person ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 px-3 py-2.5">
          <PersonAvatarBadge graph={graph} personId={person.id} size="md" showBadge={false} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{person.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">{lineageLabel(graph, person.id)}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label={`Clear ${label}`} onClick={onClear}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <TreePersonSearch
          graph={{
            ...graph,
            people: excludeId
              ? graph.people.filter((p) => p.id !== excludeId)
              : graph.people,
          }}
          onSelectPerson={onSelect}
        />
      )}
    </div>
  );
}
