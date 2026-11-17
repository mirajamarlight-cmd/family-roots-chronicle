import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { type KeyboardEvent, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { DECEASED_LABEL, birthOrderAmongSiblings, duplicateEffectiveNames, effectiveDisplayName, personContextLabel, personIsDeceased, type FamilyGraph } from "@/lib/family";
import { personPortraitUrl } from "@/lib/brand";
import { branchColor } from "@/lib/colors";
import type { FilterVisibility } from "@/lib/tree-filters";
import {
  TREE_NODE_H,
  TREE_NODE_W,
  TREE_PORTRAIT,
  layoutFamilyCanvas,
  neighborhood,
  type TreeDepth,
} from "@/lib/tree-graph";
import { cn } from "@/lib/utils";

const HANDLE = {
  opacity: 0,
  pointerEvents: "none" as const,
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  border: "none",
  background: "transparent",
};

export type TreeNodeData = {
  label: string;
  fullName: string;
  contextLabel: string | null;
  photoUrl: string | null;
  initial: string;
  childCount: number;
  hiddenChildren: boolean;
  selected: boolean;
  focused: boolean;
  accent: boolean;
  lit: boolean;
  keepName: boolean;
  dimmed: boolean;
  matched: boolean;
  deceased: boolean;
  birthOrder: number | null;
  siblingCount: number | null;
  color: string;
};

type PersonNode = Node<TreeNodeData, "person">;

const TreeHandlersContext = createContext<{
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onToggleDeep?: ((id: string) => void) | undefined;
} | null>(null);

function labelOpacity(zoom: number) {
  if (zoom >= 0.62) return 1;
  if (zoom <= 0.22) return 0;
  return (zoom - 0.22) / 0.4;
}

function PersonPortrait({ id, data }: NodeProps<PersonNode>) {
  const d = data;
  const handlers = useContext(TreeHandlersContext);
  const zoom = useStore((s) => s.transform[2]);
  const keepLabel = d.keepName || d.selected || d.focused || d.matched || d.accent || d.lit;
  const order =
    d.birthOrder != null && d.siblingCount != null ? `${d.birthOrder} of ${d.siblingCount}` : null;
  const children =
    d.childCount === 0 ? "No children recorded" : d.childCount === 1 ? "1 child" : `${d.childCount} children`;
  const portraitMid = TREE_PORTRAIT / 2;
  const sideInset = (TREE_NODE_W - TREE_PORTRAIT) / 2;
  const ring =
    d.selected
      ? `0 0 0 3px var(--tree-ink), 0 0 0 6px ${d.color}`
      : d.focused || d.accent
        ? `0 0 0 2px var(--tree-ink), 0 0 0 4px ${d.color}`
        : `0 0 0 2px ${d.color}`;

  return (
    <div
      className={cn("tree-person group relative", d.dimmed && "tree-person-dim")}
      style={{ width: TREE_NODE_W, height: TREE_NODE_H }}
    >
      <Handle type="target" id="up" position={Position.Top} style={{ ...HANDLE, left: "50%", top: 0, transform: "translate(-50%, 0)" }} />
      <Handle type="source" id="down" position={Position.Bottom} style={{ ...HANDLE, left: "50%", top: TREE_PORTRAIT, bottom: "auto", transform: "translate(-50%, 0)" }} />
      <Handle type="target" id="left" position={Position.Left} style={{ ...HANDLE, left: sideInset, top: portraitMid, transform: "none" }} />
      <Handle type="source" id="right" position={Position.Right} style={{ ...HANDLE, left: sideInset + TREE_PORTRAIT, right: "auto", top: portraitMid, transform: "none" }} />

      <button
        type="button"
        data-node-id={id}
        onClick={() => handlers?.onSelect(id)}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (d.hiddenChildren) handlers?.onToggle(id);
        }}
        aria-label={`${d.fullName}, ${children}`}
        className="flex w-full flex-col items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:[&_.tree-portrait]:ring-2 focus-visible:[&_.tree-portrait]:ring-[var(--tree-label)] focus-visible:[&_.tree-portrait]:ring-offset-2 focus-visible:[&_.tree-portrait]:ring-offset-[var(--tree-ink)]"
      >
        <span
          className={cn(
            "tree-portrait",
            d.deceased && "tree-portrait-deceased",
            d.matched && "tree-portrait-match",
          )}
          style={{ boxShadow: ring }}
        >
          {d.photoUrl ? (
            <img src={d.photoUrl} alt="" className="tree-portrait-img" />
          ) : (
            <span className="tree-portrait-fallback" style={{ background: d.color }} aria-hidden>
              {d.initial}
            </span>
          )}
        </span>
        <span className="tree-person-label" style={{ opacity: keepLabel ? 1 : labelOpacity(zoom) }}>
          {d.label}
        </span>
      </button>

      {d.hiddenChildren && (
        <button
          type="button"
          data-toggle-id={id}
          className="tree-count"
          aria-label={
            d.childCount === 1 ? `Show 1 child of ${d.label}` : `Show ${d.childCount} children of ${d.label}`
          }
          title="Show children. Alt-click shows the whole branch."
          onClick={(e) => {
            e.stopPropagation();
            if ((e.altKey || e.shiftKey) && handlers?.onToggleDeep) handlers.onToggleDeep(id);
            else handlers?.onToggle(id);
          }}
        >
          {d.childCount > 99 ? "99+" : d.childCount}
        </button>
      )}

      <div className="tree-hover-card" aria-hidden="true">
        <p className="tree-hover-name">{d.fullName}</p>
        {d.contextLabel && <p className="tree-hover-meta">{d.contextLabel}</p>}
        {order && <p className="tree-hover-meta">{order}</p>}
        {d.deceased && <p className="tree-hover-meta">{DECEASED_LABEL}</p>}
        <p className="tree-hover-meta">{children}</p>
        {d.hiddenChildren && <p className="tree-hover-meta">Double-click to open the branch</p>}
      </div>
    </div>
  );
}

const nodeTypes = { person: PersonPortrait };

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
  accentIds?: Set<string> | undefined;
  accentEdgeIds?: Set<string> | undefined;
  visibleIds?: Set<string> | undefined;
  ariaLabel?: string | undefined;
  panelOpen?: boolean | undefined;
  depth?: TreeDepth | undefined;
};

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
  accentIds,
  accentEdgeIds,
  visibleIds,
  ariaLabel = "Family tree",
  panelOpen = false,
  depth = "all",
}: Props) {
  const duplicateNames = useMemo(() => duplicateEffectiveNames(graph), [graph]);
  const layoutFocus = depth === "all" ? null : (focusedNodeId ?? selectedId ?? rootId);
  const laid = useMemo(
    () =>
      layoutFamilyCanvas({
        graph,
        rootId,
        expanded,
        depth,
        focusId: layoutFocus,
        visibleIds,
      }),
    [graph, rootId, expanded, depth, layoutFocus, visibleIds],
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Obsidian-style: only hover dims the rest. Selection keeps the whole depth view readable.
  const lit = useMemo(() => (hoveredId ? neighborhood(graph, hoveredId, 1) : null), [graph, hoveredId]);

  const placedIds = useMemo(() => new Set(laid.nodes.map((n) => n.id)), [laid.nodes]);
  const namedCore = useMemo(() => {
    if (depth === "all") return laid.nodes.length <= 36 ? placedIds : null;
    if (!layoutFocus) return placedIds;
    // Depth 2 can be huge — keep names on the focus person and close kin.
    return new Set([...neighborhood(graph, layoutFocus, 1)].filter((id) => placedIds.has(id)));
  }, [depth, layoutFocus, graph, placedIds, laid.nodes.length]);

  const nodes = useMemo<PersonNode[]>(() => {
    return laid.nodes.map((n) => {
      const person = graph.byId.get(n.id);
      const kids = graph.childrenOf.get(n.id) ?? [];
      const shownKids = kids.filter((c) => placedIds.has(c));
      const parentId = graph.parentsOf.get(n.id)?.[0];
      const siblingCount = parentId ? (graph.childrenOf.get(parentId)?.length ?? null) : null;
      const matched = filters?.selfMatch.has(n.id) ?? false;
      const accent = accentIds?.has(n.id) ?? false;
      const isLit = lit?.has(n.id) ?? false;
      const kinDim = Boolean(lit && !isLit);
      const filterDim = Boolean(filters?.active && !matched);
      return {
        id: n.id,
        type: "person",
        position: { x: n.x, y: n.y },
        width: TREE_NODE_W,
        height: TREE_NODE_H,
        zIndex: n.id === selectedId || n.id === focusedNodeId || isLit ? 10 : 0,
        draggable: false,
        data: {
          label: person?.first_name ?? "Unknown",
          fullName: person ? effectiveDisplayName(graph, n.id) : "Unknown",
          contextLabel: person ? personContextLabel(graph, n.id, duplicateNames) : null,
          photoUrl: personPortraitUrl(graph, n.id),
          initial: (person?.first_name?.slice(0, 1) || person?.display_name?.slice(0, 1) || "?").toUpperCase(),
          childCount: kids.length,
          hiddenChildren: depth === "all" && kids.length > shownKids.length,
          selected: selectedId === n.id,
          focused: focusedNodeId === n.id,
          accent,
          lit: isLit,
          keepName: namedCore?.has(n.id) ?? false,
          dimmed: !accent && ((kinDim && !matched) || filterDim),
          matched,
          deceased: person ? personIsDeceased(person) : false,
          birthOrder: birthOrderAmongSiblings(graph, n.id),
          siblingCount,
          color: branchColor(graph.branchOf.get(n.id) ?? person?.display_name ?? n.id),
        },
      };
    });
  }, [
    laid.nodes,
    graph,
    placedIds,
    filters,
    accentIds,
    lit,
    selectedId,
    focusedNodeId,
    depth,
    duplicateNames,
    namedCore,
  ]);

  const edges = useMemo<Edge[]>(() => {
    return laid.edges.map((e) => {
      const onPath = accentEdgeIds?.has(e.id) ?? false;
      const endsLit = !lit || (lit.has(e.source) && lit.has(e.target));
      const dim = !onPath && !endsLit;
      const spouse = e.kind === "spouse";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: spouse ? "straight" : "smoothstep",
        zIndex: onPath ? 2 : 0,
        style: {
          stroke: onPath ? "var(--tree-path)" : spouse ? "var(--tree-spouse)" : "var(--tree-line)",
          strokeWidth: onPath ? 2.2 : 1.15,
          strokeDasharray: spouse ? "2 5" : undefined,
          opacity: dim ? 0.08 : 1,
        },
        data: { kind: e.kind },
      };
    });
  }, [laid.edges, accentEdgeIds, lit]);

  const flow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const fitKey = useRef<string | null>(null);
  const restoreFocusRef = useRef<string | null>(null);

  const focusNodeButton = useCallback((id: string) => {
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-node-id="${escaped}"]`);
    el?.focus({ preventScroll: true });
    return Boolean(el);
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      restoreFocusRef.current = id;
      onFocusNode(id);
      onToggle(id);
    },
    [onToggle, onFocusNode],
  );

  const handleToggleDeep = useCallback(
    (id: string) => {
      restoreFocusRef.current = id;
      onFocusNode(id);
      onToggleDeep?.(id);
    },
    [onToggleDeep, onFocusNode],
  );

  const handlers = useMemo(
    () => ({
      onToggle: handleToggle,
      onSelect,
      onToggleDeep: onToggleDeep ? handleToggleDeep : undefined,
    }),
    [handleToggle, onSelect, onToggleDeep, handleToggleDeep],
  );

  useEffect(() => {
    if (!nodes.length) return;
    const key = `${depth}:${depth === "all" ? rootId : layoutFocus}:${panelOpen ? 1 : 0}:${nodes.length}`;
    if (fitKey.current === key) return;
    fitKey.current = key;
    // Depth 2 spreads siblings across a wide canvas. Frame the focus person with
    // their own children/spouses — parents can sit far left/right of that cluster.
    const frameIds =
      depth === "all" || !layoutFocus
        ? null
        : (() => {
            const ids = new Set<string>([layoutFocus]);
            for (const c of graph.childrenOf.get(layoutFocus) ?? []) if (placedIds.has(c)) ids.add(c);
            for (const s of graph.spousesOf.get(layoutFocus) ?? []) if (placedIds.has(s)) ids.add(s);
            if (depth === 1) {
              for (const p of graph.parentsOf.get(layoutFocus) ?? []) if (placedIds.has(p)) ids.add(p);
            }
            return [...ids].map((id) => ({ id }));
          })();
    const opts = {
      padding: panelOpen ? 0.2 : 0.14,
      maxZoom: depth === "all" ? 1.15 : 1.4,
      minZoom: depth === "all" ? 0.32 : 0.55,
      duration: 320,
    };
    // Wait one paint so React Flow has the new node positions before fitting.
    const timer = setTimeout(() => {
      if (frameIds && frameIds.length > 0) void flow.fitView({ ...opts, nodes: frameIds });
      else void flow.fitView(opts);
    }, 40);
    return () => clearTimeout(timer);
  }, [rootId, depth, layoutFocus, nodes.length, flow, panelOpen, graph, placedIds]);

  const [settling, setSettling] = useState(false);
  const prevExpanded = useRef<Set<string>>(expanded);
  const didInitialExpand = useRef(false);
  useEffect(() => {
    if (depth !== "all") return;
    const prev = prevExpanded.current;
    prevExpanded.current = expanded;
    if (prev === expanded) return;
    if (!didInitialExpand.current) {
      didInitialExpand.current = true;
      return;
    }
    let changedId: string | null = null;
    for (const id of expanded) if (!prev.has(id)) changedId = id;
    if (!changedId) for (const id of prev) if (!expanded.has(id)) changedId = id;
    if (!changedId) return;
    const kids = graph.childrenOf.get(changedId) ?? [];
    const ids = [changedId, ...kids].map((id) => ({ id }));
    const wide = kids.length > 6;
    if (wide) setSettling(true);
    const timer = setTimeout(() => {
      void flow.fitView({
        nodes: ids,
        padding: panelOpen ? 0.2 : 0.16,
        minZoom: 0.32,
        maxZoom: wide ? 0.95 : 1.2,
        duration: 400,
      });
    }, 80);
    const done = setTimeout(() => setSettling(false), 560);
    return () => {
      clearTimeout(timer);
      clearTimeout(done);
    };
  }, [expanded, depth, flow, graph, panelOpen]);

  useEffect(() => {
    const id = restoreFocusRef.current;
    if (!id) return;
    const frame = requestAnimationFrame(() => focusNodeButton(id));
    const after = setTimeout(() => {
      restoreFocusRef.current = null;
    }, 620);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(after);
    };
  }, [nodes, focusNodeButton]);

  useEffect(() => {
    if (!selectedId) return;
    if (depth !== "all") return;
    const node = flow.getNode(selectedId);
    if (node) {
      flow.setCenter(node.position.x + TREE_NODE_W / 2, node.position.y + TREE_PORTRAIT / 2, {
        zoom: Math.max(flow.getZoom(), 0.85),
        duration: 400,
      });
    }
  }, [selectedId, depth, flow, nodes.length]);

  const navigateFocus = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!nodes.length) return;
      const parentOf = new Map<string, string>();
      const childrenOf = new Map<string, string[]>();
      const spousesOf = new Map<string, string[]>();
      const xOf = new Map(nodes.map((n) => [n.id, n.position.x]));
      for (const edge of edges) {
        const kind = (edge.data as { kind?: string } | undefined)?.kind;
        if (kind === "spouse") {
          (spousesOf.get(edge.source) ?? spousesOf.set(edge.source, []).get(edge.source)!).push(edge.target);
          (spousesOf.get(edge.target) ?? spousesOf.set(edge.target, []).get(edge.target)!).push(edge.source);
          continue;
        }
        if (!parentOf.has(edge.target)) parentOf.set(edge.target, edge.source);
        const kids = childrenOf.get(edge.source) ?? [];
        kids.push(edge.target);
        childrenOf.set(edge.source, kids);
      }
      for (const kids of childrenOf.values()) {
        kids.sort((a, b) => (xOf.get(a) ?? 0) - (xOf.get(b) ?? 0));
      }
      const current = focusedNodeId ?? selectedId ?? rootId;
      if (!current) return;

      let next: string | null = null;
      if (direction === "up") next = parentOf.get(current) ?? null;
      else if (direction === "down") next = childrenOf.get(current)?.[0] ?? null;
      else {
        const parent = parentOf.get(current);
        const siblings = parent
          ? (childrenOf.get(parent) ?? [])
          : nodes.filter((n) => !parentOf.has(n.id)).sort((a, b) => a.position.x - b.position.x).map((n) => n.id);
        const row = [...new Set([...siblings, ...(spousesOf.get(current) ?? [])])].sort(
          (a, b) => (xOf.get(a) ?? 0) - (xOf.get(b) ?? 0),
        );
        const idx = row.indexOf(current);
        if (idx !== -1) {
          if (direction === "left" && idx > 0) next = row[idx - 1]!;
          if (direction === "right" && idx < row.length - 1) next = row[idx + 1]!;
        }
      }

      if (!next) return;
      onFocusNode(next);
      const node = flow.getNode(next);
      if (node) {
        flow.setCenter(node.position.x + TREE_NODE_W / 2, node.position.y + TREE_PORTRAIT / 2, {
          zoom: flow.getZoom(),
          duration: 200,
        });
      }
    },
    [nodes, edges, focusedNodeId, selectedId, rootId, onFocusNode, flow],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if ((e.key === "Enter" || e.key === " ") && target?.closest("button")) return;
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
      } else if (e.key === " " && depth === "all" && (focusedNodeId ?? selectedId)) {
        e.preventDefault();
        handleToggle(focusedNodeId ?? selectedId!);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClosePanel?.();
      }
    },
    [navigateFocus, focusedNodeId, selectedId, onSelect, handleToggle, onClosePanel, depth],
  );

  return (
    <div
      ref={containerRef}
      className="tree-graph relative h-full w-full outline-none"
      tabIndex={0}
      role="tree"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      <div
        aria-live="polite"
        className={cn("tree-settling", settling ? "tree-settling-on" : "tree-settling-off")}
      >
        Arranging branch…
      </div>
      <TreeHandlersContext.Provider value={handlers}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          minZoom={0.28}
          maxZoom={1.75}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          className="bg-transparent"
        >
          <Background color="oklch(0.34 0.012 70)" gap={26} size={1.2} />
          <Controls showInteractive={false} className="tree-controls" />
          {nodes.length > 40 && (
            <MiniMap
              className="tree-minimap"
              nodeColor={(node) => (node.data as TreeNodeData)?.color ?? "oklch(0.7 0.04 80)"}
              maskColor="oklch(0.12 0.01 70 / 0.55)"
              pannable
              zoomable
            />
          )}
        </ReactFlow>
      </TreeHandlersContext.Provider>
      <div className="tree-vignette pointer-events-none absolute inset-0 z-10" aria-hidden />
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
