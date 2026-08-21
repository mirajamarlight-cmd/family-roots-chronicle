import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { PersonAvatarBadge } from "@/components/person-identity";
import { cn } from "@/lib/utils";
import type { FamilyGraph } from "@/lib/family";
import { branchColor } from "@/lib/colors";
import type { FilterVisibility } from "@/lib/tree-filters";

const NODE_WIDTH = 176;
const H_GAP = 26;
const V_GAP = 132;

export type TreeNodeData = {
  label: string;
  childCount: number;
  hiddenChildren: boolean;
  expanded: boolean;
  selected: boolean;
  focused: boolean;
  depth: number;
  branchKey: string;
  dimmed: boolean;
  matched: boolean;
};

const TreeHandlersContext = createContext<{
  graph: FamilyGraph;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
} | null>(null);

function PersonNode({ id, data }: NodeProps) {
  const d = data as unknown as TreeNodeData;
  const handlers = useContext(TreeHandlersContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const avatarSize = d.depth === 0 ? "xl" : "md";

  return (
    <div
      className={cn(
        "relative transition-opacity duration-200",
        mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
        d.dimmed && "opacity-40",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        data-node-id={id}
        onClick={() => handlers?.onSelect(id)}
        aria-label={`Open profile for ${d.label}`}
        className={cn(
          "w-full rounded-xl border bg-card px-3 py-2.5 text-left leaf-shadow transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          d.depth === 0 && "pt-3",
          d.selected
            ? "border-primary ring-2 ring-primary/35"
            : d.focused
              ? "border-primary/70 ring-2 ring-primary/20"
              : "border-border hover:border-primary/45",
          d.matched && !d.selected && "ring-2 ring-destructive/25",
        )}
      >
        <div className={cn("mb-2 flex justify-center", d.depth > 0 && "mb-1.5")}>
          <PersonAvatarBadge graph={handlers!.graph} personId={id} size={avatarSize} />
        </div>
        <span className="block truncate text-center font-display text-base font-semibold leading-tight">
          {d.label}
        </span>
        <span className="mt-0.5 block text-center text-xs text-muted-foreground">
          {d.childCount === 0 ? "No children recorded" : `${d.childCount} children`}
        </span>
      </button>
      {d.childCount > 0 && (
        <div className="absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => handlers?.onToggle(id)}
            aria-label={d.expanded ? "Collapse branch" : "Expand branch"}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="flex size-6 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              {d.expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </span>
          </button>
          {d.hiddenChildren && (
            <span className="rounded-full bg-secondary px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
              +{d.childCount}
            </span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { person: PersonNode };

export type CanvasFilters = Pick<FilterVisibility, "active" | "visible" | "selfMatch">;

type Props = {
  graph: FamilyGraph;
  rootId: string;
  expanded: Set<string>;
  selectedId: string | null;
  focusedNodeId: string | null;
  filters?: CanvasFilters;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onFocusNode: (id: string | null) => void;
  onClosePanel?: () => void;
};

function buildFlow(
  graph: FamilyGraph,
  rootId: string,
  expanded: Set<string>,
  selectedId: string | null,
  focusedNodeId: string | null,
  filters: CanvasFilters | undefined,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let cursor = 0;
  const placed = new Set<string>();
  const placedX = new Map<string, number>();

  const layout = (id: string, depth: number): number => {
    if (placed.has(id)) return placedX.get(id)!;

    const children = expanded.has(id) ? (graph.childrenOf.get(id) ?? []) : [];
    let x: number;
    if (children.length === 0) {
      x = cursor;
      cursor += NODE_WIDTH + H_GAP;
    } else {
      const positions = children.map((c) => layout(c, depth + 1));
      x = (positions[0]! + positions[positions.length - 1]!) / 2;
    }
    const person = graph.byId.get(id);
    const allChildren = graph.childrenOf.get(id) ?? [];
    const filterActive = filters?.active ?? false;
    const dimmed = filterActive && !(filters?.selfMatch.has(id) ?? false);
    nodes.push({
      id,
      type: "person",
      position: { x, y: depth * V_GAP },
      data: {
        label: person?.display_name ?? "Unknown",
        childCount: allChildren.length,
        hiddenChildren: allChildren.length > 0 && !expanded.has(id),
        expanded: expanded.has(id),
        selected: selectedId === id,
        focused: focusedNodeId === id,
        depth,
        branchKey: graph.branchOf.get(id) ?? person?.display_name ?? id,
        dimmed,
        matched: filters?.selfMatch.has(id) ?? false,
      } satisfies TreeNodeData as unknown as Record<string, unknown>,
      draggable: false,
    });
    placed.add(id);
    placedX.set(id, x);
    for (const c of children) {
      edges.push({
        id: `${id}-${c}`,
        source: id,
        target: c,
        type: "smoothstep",
        style: { stroke: "var(--border)", strokeWidth: 1.6 },
      });
    }
    return x;
  };

  if (graph.byId.has(rootId)) layout(rootId, 0);
  return { nodes, edges };
}

function buildNavMaps(nodes: Node[], edges: Edge[]) {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    parentOf.set(edge.target, edge.source);
    const kids = childrenOf.get(edge.source) ?? [];
    kids.push(edge.target);
    childrenOf.set(edge.source, kids);
  }
  for (const kids of childrenOf.values()) {
    kids.sort((a, b) => {
      const na = nodes.find((n) => n.id === a);
      const nb = nodes.find((n) => n.id === b);
      return (na?.position.x ?? 0) - (nb?.position.x ?? 0);
    });
  }
  const orderedIds = [...nodes].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
  return { parentOf, childrenOf, orderedIds };
}

function Canvas({
  graph,
  rootId,
  expanded,
  selectedId,
  focusedNodeId,
  filters,
  onToggle,
  onSelect,
  onFocusNode,
  onClosePanel,
}: Props) {
  const { nodes, edges } = useMemo(
    () => buildFlow(graph, rootId, expanded, selectedId, focusedNodeId, filters),
    [graph, rootId, expanded, selectedId, focusedNodeId, filters],
  );
  const flow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const fitForRoot = useRef<string | null>(null);

  const handlers = useMemo(() => ({ graph, onToggle, onSelect }), [graph, onToggle, onSelect]);

  useEffect(() => {
    if (!nodes.length || fitForRoot.current === rootId) return;
    fitForRoot.current = rootId;
    requestAnimationFrame(() => {
      flow.fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.4, duration: 300 });
    });
  }, [rootId, nodes.length, flow]);

  useEffect(() => {
    fitForRoot.current = null;
  }, [rootId]);

  useEffect(() => {
    if (!selectedId) return;
    const node = flow.getNode(selectedId);
    if (node)
      flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + 40, {
        zoom: 0.9,
        duration: 500,
      });
  }, [selectedId, flow, nodes.length]);

  const navigateFocus = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!nodes.length) return;
      const { parentOf, childrenOf, orderedIds } = buildNavMaps(nodes, edges);
      const current = focusedNodeId ?? selectedId ?? rootId;
      if (!current) return;

      let next: string | null = null;
      if (direction === "up") {
        next = parentOf.get(current) ?? null;
      } else if (direction === "down") {
        next = childrenOf.get(current)?.[0] ?? null;
      } else {
        const siblings =
          current === rootId
            ? orderedIds.filter((id) => !parentOf.has(id))
            : (() => {
                const parent = parentOf.get(current);
                return parent ? (childrenOf.get(parent) ?? []) : orderedIds;
              })();
        const idx = siblings.indexOf(current);
        if (idx !== -1) {
          if (direction === "left" && idx > 0) next = siblings[idx - 1]!;
          if (direction === "right" && idx < siblings.length - 1) next = siblings[idx + 1]!;
        }
      }

      if (next) {
        onFocusNode(next);
        const node = flow.getNode(next);
        if (node)
          flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + 40, {
            zoom: flow.getZoom(),
            duration: 200,
          });
      }
    },
    [nodes, edges, focusedNodeId, selectedId, rootId, onFocusNode, flow],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateFocus("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateFocus("down");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateFocus("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateFocus("right");
      } else if (e.key === "Enter" && (focusedNodeId ?? selectedId)) {
        e.preventDefault();
        onSelect(focusedNodeId ?? selectedId!);
      } else if (e.key === " " && (focusedNodeId ?? selectedId)) {
        e.preventDefault();
        onToggle(focusedNodeId ?? selectedId!);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClosePanel?.();
      }
    },
    [navigateFocus, focusedNodeId, selectedId, onSelect, onToggle, onClosePanel],
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full outline-none"
      tabIndex={0}
      role="tree"
      aria-label="Family tree"
      onKeyDown={onKeyDown}
    >
      <TreeHandlersContext.Provider value={handlers}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          minZoom={0.15}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background color="var(--border)" gap={28} size={1.5} />
          <Controls
            showInteractive={false}
            className="!rounded-lg !border !border-border !bg-card"
          />
          {nodes.length > 40 && (
            <MiniMap
              className="!rounded-lg !border !border-border !bg-card/90 !bottom-14 !left-3 !h-24 !w-32"
              nodeColor={(node) => {
                const branchKey = (node.data as TreeNodeData)?.branchKey ?? "";
                return branchColor(branchKey);
              }}
              maskColor="oklch(0.4 0.03 70 / 0.08)"
              pannable
              zoomable
            />
          )}
        </ReactFlow>
      </TreeHandlersContext.Provider>
    </div>
  );
}

export function FamilyTreeCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
