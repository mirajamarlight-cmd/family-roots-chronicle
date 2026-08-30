import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { RelationshipPersonPicker } from "@/components/RelationshipPersonPicker";
import { BirthOrderBadge } from "@/components/person-identity";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";
import { siblingsOf } from "@/lib/family";
import {
  addParentChild,
  addSibling,
  removeParentChild,
  setChildOrder,
  validateParentChild,
  validateSibling,
} from "@/lib/relationships";
import { cn } from "@/lib/utils";

function RelationshipSection({
  title,
  count,
  personId,
  section,
  children,
}: {
  title: string;
  count: number;
  personId: string;
  section: string;
  children: ReactNode;
}) {
  return (
    <Collapsible key={`${section}-${personId}`} defaultOpen={false} className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", "group-data-[state=open]:rotate-90")}
        />
        <span className="flex-1">{title}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
          {count}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ChildrenOrderList({
  graph,
  childIds,
  onReorder,
  onRemove,
}: {
  graph: FamilyGraph;
  childIds: string[];
  onReorder: (orderedIds: string[]) => void;
  onRemove: (childId: string) => void;
}) {
  const [order, setOrder] = useState(childIds);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    setOrder(childIds);
  }, [childIds]);

  const commitReorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = [...order];
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    setOrder(next);
    onReorder(next);
  };

  if (order.length === 0) {
    return <li className="text-sm text-muted-foreground">No recorded child.</li>;
  }

  return (
    <>
      {order.map((id, index) => (
        <li
          key={id}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragId && dragId !== id) setOverId(id);
          }}
          onDragLeave={() => setOverId((prev) => (prev === id ? null : prev))}
          onDrop={(e) => {
            e.preventDefault();
            const fromId = e.dataTransfer.getData("text/plain") || dragId;
            if (fromId) commitReorder(fromId, id);
            setDragId(null);
            setOverId(null);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-transparent bg-background/80 px-1 text-sm transition-colors",
            overId === id && "border-border bg-accent/60",
            dragId === id && "opacity-50",
          )}
        >
          <button
            type="button"
            draggable
            aria-label={`Drag to reorder ${effectiveDisplayName(graph, id)}`}
            className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", id);
              e.dataTransfer.effectAllowed = "move";
              setDragId(id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <BirthOrderBadge order={index + 1} />
          <span className="min-w-0 flex-1 truncate">{effectiveDisplayName(graph, id)}</span>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label="Remove child link"
            onClick={() => onRemove(id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </>
  );
}

export function RelationshipManager({
  graph,
  personId,
  embedded = false,
}: {
  graph: FamilyGraph;
  personId: string;
  embedded?: boolean;
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

  const reorderChildren = (ids: string[]) => {
    if (ids.join(",") === children.join(",")) return;
    void run(() => setChildOrder(personId, ids), "Birth order updated");
  };

  if (!person) return null;

  return (
    <div className={cn("space-y-3", !embedded && "space-y-5")}>
      {!embedded && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relationships
        </h3>
      )}

      <section className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
          <h4 className="text-sm font-medium">Parents</h4>
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
            {parents.length}/2
          </span>
        </div>
        <div className="space-y-2 px-3 py-3">
          <ul className="space-y-1">
            {parents.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{effectiveDisplayName(graph, id)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
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
        </div>
      </section>

      <RelationshipSection title="Children" count={children.length} personId={person.id} section="children">
        <p className="text-xs text-muted-foreground">
          Order by birthday when known; otherwise drag the handle to set birth order.
        </p>
        <ul className="space-y-1">
          <ChildrenOrderList
            graph={graph}
            childIds={children}
            onReorder={reorderChildren}
            onRemove={(childId) => detach(person.id, childId)}
          />
        </ul>
      </RelationshipSection>

      <RelationshipSection title="Siblings" count={siblings.length} personId={person.id} section="siblings">
        <ul className="space-y-1">
          {siblings.map((id) => (
            <li key={id} className="text-sm">
              {effectiveDisplayName(graph, id)}
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
      </RelationshipSection>
    </div>
  );
}
