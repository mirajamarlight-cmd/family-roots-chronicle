import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FamilyTreeCanvas } from "@/components/FamilyTreeCanvas";
import type { FamilyGraph } from "@/lib/family";
import {
  buildRelationshipTreeView,
  formatRelationshipBridge,
  getRelationshipBridge,
  type RelationshipResult,
} from "@/lib/relationship-finder";

export function RelationshipTreeView({
  graph,
  result,
}: {
  graph: FamilyGraph;
  result: Extract<RelationshipResult, { kind: "related" }>;
}) {
  const navigate = useNavigate();
  const view = useMemo(() => buildRelationshipTreeView(result), [result]);
  const [expanded, setExpanded] = useState(view.expanded);
  const bridge = getRelationshipBridge(result);

  useEffect(() => {
    setExpanded(new Set(view.expanded));
  }, [view.expanded]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openInTree = (personId: string) => {
    void navigate({
      to: "/tree",
      search: { person: personId, root: graph.branchOf.get(personId) ?? undefined },
    });
  };

  const lcaName = graph.byId.get(view.rootId)?.display_name ?? "Common ancestor";

  return (
    <div
      className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-3 sm:p-4"
      aria-label={bridge ? formatRelationshipBridge(graph, bridge) : undefined}
    >
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How they connect in the tree
        </p>
        <p className="text-xs text-muted-foreground">
          Highlighted lines follow each person up to {lcaName}. Siblings show for context.
        </p>
      </div>

      <div className="h-[min(70vh,36rem)] overflow-hidden rounded-xl border border-border bg-background/50">
        <FamilyTreeCanvas
          graph={graph}
          rootId={view.rootId}
          expanded={expanded}
          selectedId={null}
          focusedNodeId={null}
          accentIds={view.pathIds}
          accentEdgeIds={view.pathEdgeIds}
          ariaLabel="Relationship connection tree"
          onToggle={toggle}
          onSelect={openInTree}
          onFocusNode={() => {}}
        />
      </div>

      {bridge && (
        <p className="border-t border-border/60 pt-3 text-center text-xs leading-relaxed text-muted-foreground">
          {formatRelationshipBridge(graph, bridge)}
        </p>
      )}
    </div>
  );
}
