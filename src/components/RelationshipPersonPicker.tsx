import { X } from "lucide-react";

import { FamilyPlace } from "@/components/family-place";
import { PersonAvatarBadge } from "@/components/person-identity";
import { TreePersonSearch } from "@/components/TreePersonSearch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FamilyGraph } from "@/lib/family";

export function RelationshipPersonPicker({
  graph,
  label,
  personId,
  excludeId,
  onSelect,
  onClear,
  inline = false,
  placeholder,
}: {
  graph: FamilyGraph;
  label: string;
  personId: string | null;
  excludeId?: string | null | undefined;
  onSelect: (id: string) => void;
  onClear: () => void;
  inline?: boolean | undefined;
  placeholder?: string | undefined;
}) {
  const person = personId ? graph.byId.get(personId) : null;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {person ? (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/80 px-3 py-2.5">
          <PersonAvatarBadge graph={graph} personId={person.id} size="md" showBadge={false} />
          <FamilyPlace graph={graph} personId={person.id} className="min-w-0 flex-1" />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
            aria-label={`Clear ${label}`}
            onClick={onClear}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <TreePersonSearch
          graph={{
            ...graph,
            people: excludeId ? graph.people.filter((p) => p.id !== excludeId) : graph.people,
          }}
          onSelectPerson={onSelect}
          inline={inline}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
