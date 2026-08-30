import { Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";

import { FamilyTreeCanvas } from "@/components/FamilyTreeCanvas";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";
import {
  buildRelationshipTreeView,
  formatRelationshipBridge,
  getRelationshipBridge,
  relationshipPathLinkIds,
  type RelationshipBridge,
  type RelationshipResult,
} from "@/lib/relationship-finder";

function RelationshipPathLinks({
  graph,
  bridge,
}: {
  graph: FamilyGraph;
  bridge: RelationshipBridge;
}) {
  const ids = useMemo(() => relationshipPathLinkIds(bridge), [bridge]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5 border-t border-border/60 pt-3">
      {ids.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && (
            <span className="px-0.5 text-xs text-muted-foreground" aria-hidden>
              →
            </span>
          )}
          <Link
            to="/tree"
            search={{ person: id, root: graph.branchOf.get(id) ?? undefined }}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary underline-offset-2 transition-colors hover:bg-secondary hover:underline"
          >
            {effectiveDisplayName(graph, id)}
          </Link>
        </Fragment>
      ))}
    </div>
  );
}

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
  const endpointIds = useMemo(() => new Set([view.aId, view.bId]), [view.aId, view.bId]);

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
          Only the direct path between them is shown. Tap a name to open them in the full tree.
        </p>
      </div>

      <div className="h-[min(70vh,36rem)] overflow-hidden rounded-xl border border-border bg-background/50">
        <FamilyTreeCanvas
          graph={graph}
          rootId={view.rootId}
          expanded={expanded}
          selectedId={null}
          focusedNodeId={view.lcaId}
          visibleIds={view.pathIds}
          accentIds={endpointIds}
          accentEdgeIds={view.pathEdgeIds}
          ariaLabel="Relationship connection tree"
          onToggle={toggle}
          onSelect={openInTree}
          onFocusNode={() => {}}
        />
      </div>

      {bridge && <RelationshipPathLinks graph={graph} bridge={bridge} />}
    </div>
  );
}
