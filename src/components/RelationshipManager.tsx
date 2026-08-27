import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RelationshipPersonPicker } from "@/components/RelationshipPersonPicker";
import { Button } from "@/components/ui/button";
import type { FamilyGraph } from "@/lib/family";
import { siblingsOf } from "@/lib/family";
import {
  addParentChild,
  addSibling,
  removeParentChild,
  validateParentChild,
  validateSibling,
} from "@/lib/relationships";

export function RelationshipManager({
  graph,
  personId,
}: {
  graph: FamilyGraph;
  personId: string;
}) {
  const queryClient = useQueryClient();
  const person = graph.byId.get(personId);
  const parents = person ? (graph.parentsOf.get(person.id) ?? []) : [];
  const children = person ? (graph.childrenOf.get(person.id) ?? []) : [];
  const siblings = person ? siblingsOf(graph, person.id) : [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family-graph"] });

  const run = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the relationship");
    }
  };

  const attachParent = (parentId: string) => {
    const check = validateParentChild(graph, parentId, personId);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    void run(() => addParentChild(parentId, personId), "Parent linked");
  };

  const attachChild = (childId: string) => {
    const check = validateParentChild(graph, personId, childId);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    void run(() => addParentChild(personId, childId), "Child linked");
  };

  const attachSibling = (siblingId: string) => {
    const check = validateSibling(graph, personId, siblingId);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    void run(() => addSibling(graph, personId, siblingId), "Sibling linked");
  };

  const detach = (parentId: string, childId: string) =>
    run(() => removeParentChild(parentId, childId), "Link removed");

  if (!person) return null;

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Relationships
      </h3>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Parents ({parents.length}/2)</h4>
        <ul className="space-y-1">
          {parents.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <span>{graph.byId.get(id)?.display_name ?? "Unknown"}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Remove parent link"
                onClick={() => detach(id, person.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
          {parents.length === 0 && (
            <li className="text-sm text-muted-foreground">No recorded parent.</li>
          )}
        </ul>
        {parents.length < 2 && (
          <RelationshipPersonPicker
            graph={graph}
            label="Add a parent"
            personId={null}
            excludeId={person.id}
            onSelect={attachParent}
            onClear={() => undefined}
            inline
          />
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Children ({children.length})</h4>
        <ul className="space-y-1">
          {children.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <span>{graph.byId.get(id)?.display_name ?? "Unknown"}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Remove child link"
                onClick={() => detach(person.id, id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
          {children.length === 0 && (
            <li className="text-sm text-muted-foreground">No recorded child.</li>
          )}
        </ul>
        <RelationshipPersonPicker
          graph={graph}
          label="Link an existing child"
          personId={null}
          excludeId={person.id}
          onSelect={attachChild}
          onClear={() => undefined}
          inline
        />
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Siblings ({siblings.length})</h4>
        <ul className="space-y-1">
          {siblings.map((id) => (
            <li key={id} className="text-sm">
              {graph.byId.get(id)?.display_name ?? "Unknown"}
            </li>
          ))}
          {siblings.length === 0 && (
            <li className="text-sm text-muted-foreground">No recorded sibling.</li>
          )}
        </ul>
        {parents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add a parent first — siblings are recorded through shared parents.
          </p>
        ) : (
          <RelationshipPersonPicker
            graph={graph}
            label="Add a sibling"
            personId={null}
            excludeId={person.id}
            onSelect={attachSibling}
            onClear={() => undefined}
            inline
          />
        )}
      </section>
    </div>
  );
}
