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
const V_GAP = 160;

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
  onToggleDeep?: ((id: string) => void) | undefined;
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
        "pointer-events-auto relative transition-[opacity,transform] duration-300 ease-out",
        mounted ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0",
        d.dimmed && "opacity-40",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none", width: 1, height: 1, minWidth: 1, minHeight: 1 }}
      />
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
        <div className="absolute -bottom-3.5 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if ((e.altKey || e.shiftKey) && handlers?.onToggleDeep) handlers.onToggleDeep(id);
              else handlers?.onToggle(id);
            }}
            title={
              d.expanded
                ? "Collapse branch (alt-click to collapse all below)"
                : `Show ${d.childCount} children (alt-click to expand all below)`
            }
            aria-label={
              d.expanded
                ? `Collapse branch of ${d.label}`
                : `Expand ${d.childCount} children of ${d.label}`
            }
            aria-expanded={d.expanded}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              d.expanded
                ? "border-border bg-card text-muted-foreground hover:text-foreground"
                : "border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {d.expanded ? (
              <>
                <ChevronDown className="size-3.5" aria-hidden />
                Hide
              </>
            ) : (
              <>
                <ChevronRight className="size-3.5" aria-hidden />
                {d.childCount}
              </>
            )}
          </button>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none", width: 1, height: 1, minWidth: 1, minHeight: 1 }}
      />
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
  filters?: CanvasFilters | undefined;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onFocusNode: (id: string | null) => void;
  onClosePanel?: (() => void) | undefined;
  onToggleDeep?: ((id: string) => void) | undefined;
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
  const orderedIds = [...nodes]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((n) => n.id);
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
  onToggleDeep,
}: Props) {
  const { nodes, edges } = useMemo(
    () => buildFlow(graph, rootId, expanded, selectedId, focusedNodeId, filters),
    [graph, rootId, expanded, selectedId, focusedNodeId, filters],
  );
  const flow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const fitForRoot = useRef<string | null>(null);

  const handlers = useMemo(
    () => ({ graph, onToggle, onSelect, onToggleDeep }),
    [graph, onToggle, onSelect, onToggleDeep],
  );

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

  // Keep the toggled branch in view when a node is expanded or collapsed.
  const [settling, setSettling] = useState(false);
  const prevExpanded = useRef<Set<string>>(expanded);
  useEffect(() => {
    const prev = prevExpanded.current;
    prevExpanded.current = expanded;
    if (prev === expanded) return;
    let changedId: string | null = null;
    for (const id of expanded) if (!prev.has(id)) changedId = id;
    if (!changedId) for (const id of prev) if (!expanded.has(id)) changedId = id;
    if (!changedId) return;
    const target = changedId;
    const ids = [target, ...(graph.childrenOf.get(target) ?? [])].map((id) => ({ id }));
    setSettling(true);
    const timer = setTimeout(() => {
      void flow.fitView({ nodes: ids, padding: 0.25, minZoom: 0.55, maxZoom: 0.95, duration: 400 });
    }, 80);
    const done = setTimeout(() => setSettling(false), 560);
    return () => {
      clearTimeout(timer);
      clearTimeout(done);
    };
  }, [expanded, flow, graph]);

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
