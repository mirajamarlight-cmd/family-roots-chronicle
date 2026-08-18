import {
  Background,
  Controls,
  Handle,
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
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { FamilyGraph } from "@/lib/family";

const NODE_WIDTH = 176;
const H_GAP = 26;
const V_GAP = 132;

export type TreeNodeData = {
  label: string;
  childCount: number;
  hiddenChildren: boolean;
  expanded: boolean;
  selected: boolean;
  depth: number;
  onToggle: () => void;
  onSelect: () => void;
};

function PersonNode({ data }: NodeProps) {
  const d = data as unknown as TreeNodeData;
  const genColor = ["var(--gen-1)", "var(--gen-2)", "var(--gen-3)", "var(--gen-4)", "var(--gen-5)"][
    d.depth % 5
  ];
  return (
    <div className="relative" style={{ width: NODE_WIDTH }}>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        onClick={d.onSelect}
        className={cn(
          "w-full rounded-xl border bg-card px-3 py-2.5 text-left leaf-shadow transition-all",
          d.selected
            ? "border-primary ring-2 ring-primary/35"
            : "border-border hover:border-primary/45",
        )}
      >
        <span className="block h-1 w-8 rounded-full" style={{ backgroundColor: genColor }} />
        <span className="mt-2 block truncate font-display text-base font-semibold leading-tight">
          {d.label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {d.childCount === 0 ? "No children recorded" : `${d.childCount} children`}
        </span>
      </button>
      {d.childCount > 0 && (
        <button
          type="button"
          onClick={d.onToggle}
          aria-label={d.expanded ? "Collapse branch" : "Expand branch"}
          className="absolute -bottom-3 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-primary"
        >
          {d.expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { person: PersonNode };

type Props = {
  graph: FamilyGraph;
  rootId: string;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

function buildFlow(props: Props): { nodes: Node[]; edges: Edge[] } {
  const { graph, rootId, expanded, selectedId, onToggle, onSelect } = props;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let cursor = 0;

  const layout = (id: string, depth: number): number => {
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
        depth,
        onToggle: () => onToggle(id),
        onSelect: () => onSelect(id),
      } satisfies TreeNodeData as unknown as Record<string, unknown>,
      draggable: false,
    });
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

function Canvas(props: Props) {
  const { nodes, edges } = useMemo(() => buildFlow(props), [props]);
  const flow = useReactFlow();
  const { selectedId } = props;

  useEffect(() => {
    if (!selectedId) return;
    const node = flow.getNode(selectedId);
    if (node) flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + 40, { zoom: 0.9, duration: 500 });
  }, [selectedId, flow, nodes.length]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      minZoom={0.15}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
    >
      <Background color="var(--border)" gap={28} size={1.5} />
      <Controls showInteractive={false} className="!rounded-lg !border !border-border !bg-card" />
    </ReactFlow>
  );
}

export function FamilyTreeCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
