import type { FamilyGraph } from "@/lib/family";

const PREFIX = "family-tree:v1";

export type PersistedTreeState = {
  expanded: string[];
  selected: string | null;
};

export function defaultExpanded(graph: FamilyGraph, rootId: string): Set<string> {
  return new Set([rootId]);
}

function storageKey(rootId: string) {
  return `${PREFIX}:${rootId}`;
}

function isInSubtree(graph: FamilyGraph, rootId: string, id: string): boolean {
  if (id === rootId) return true;
  let current = graph.parentsOf.get(id)?.[0];
  while (current) {
    if (current === rootId) return true;
    current = graph.parentsOf.get(current)?.[0];
  }
  return false;
}

export function loadTreeState(graph: FamilyGraph, rootId: string): PersistedTreeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(rootId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTreeState;
    const expanded = [...new Set(parsed.expanded)].filter(
      (id) => graph.byId.has(id) && isInSubtree(graph, rootId, id),
    );
    if (!expanded.includes(rootId)) expanded.unshift(rootId);
    const selected =
      parsed.selected &&
      graph.byId.has(parsed.selected) &&
      isInSubtree(graph, rootId, parsed.selected)
        ? parsed.selected
        : null;
    return { expanded, selected };
  } catch {
    return null;
  }
}

export function saveTreeState(
  rootId: string,
  expanded: Set<string>,
  selected: string | null,
  graph: FamilyGraph,
) {
  if (typeof window === "undefined") return;
  const payload: PersistedTreeState = {
    expanded: [...expanded].filter((id) => graph.byId.has(id) && isInSubtree(graph, rootId, id)),
    selected:
      selected && graph.byId.has(selected) && isInSubtree(graph, rootId, selected)
        ? selected
        : null,
  };
  if (!payload.expanded.includes(rootId)) payload.expanded.unshift(rootId);
  localStorage.setItem(storageKey(rootId), JSON.stringify(payload));
}
