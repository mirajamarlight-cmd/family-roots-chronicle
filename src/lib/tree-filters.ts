import { personSearchHaystack, type FamilyGraph } from "@/lib/family";

export type TreeFilters = {
  query: string;
  branchId: string;
  gen: number | null;
};

export type FilterVisibility = {
  active: boolean;
  visible: Set<string>;
  selfMatch: Set<string>;
  matchCount: number;
};

export function personMatches(graph: FamilyGraph, id: string, filters: TreeFilters): boolean {
  const person = graph.byId.get(id);
  if (!person) return false;

  const q = filters.query.trim().toLowerCase();
  if (q && !personSearchHaystack(graph, id).includes(q)) return false;

  if (filters.branchId) {
    const branch = graph.branchOf.get(id);
    if (id !== filters.branchId && branch !== filters.branchId) return false;
  }

  if (filters.gen !== null) {
    const gen = (graph.depthOf.get(id) ?? 0) + 1;
    if (gen !== filters.gen) return false;
  }

  return true;
}

export function computeVisibility(graph: FamilyGraph, filters: TreeFilters): FilterVisibility {
  const active = !!filters.query.trim() || !!filters.branchId || filters.gen !== null;
  if (!active) {
    return {
      active: false,
      visible: new Set(graph.people.map((p) => p.id)),
      selfMatch: new Set<string>(),
      matchCount: 0,
    };
  }

  const selfMatch = new Set<string>();
  let matchCount = 0;
  for (const person of graph.people) {
    if (personMatches(graph, person.id, filters)) {
      selfMatch.add(person.id);
      matchCount++;
    }
  }

  const visible = new Set<string>();
  const markVisible = (id: string): boolean => {
    const children = graph.childrenOf.get(id) ?? [];
    let childVisible = false;
    for (const child of children) {
      if (markVisible(child)) childVisible = true;
    }
    const show = selfMatch.has(id) || childVisible;
    if (show) visible.add(id);
    return show;
  };
  for (const root of graph.roots) markVisible(root);

  return { active: true, visible, selfMatch, matchCount };
}

/** IDs on the path from root down to each match (inclusive). */
export function ancestorsToExpand(
  graph: FamilyGraph,
  rootId: string,
  matchIds: Iterable<string>,
): string[] {
  const ids = new Set<string>();
  for (const matchId of matchIds) {
    let current: string | undefined = matchId;
    while (current) {
      ids.add(current);
      if (current === rootId) break;
      current = graph.parentsOf.get(current)?.[0];
    }
  }
  return [...ids];
}

/** Ancestors of each match only — keeps matches themselves collapsed. */
export function ancestorsOnlyToExpand(
  graph: FamilyGraph,
  rootId: string,
  matchIds: Iterable<string>,
): string[] {
  const ids = new Set<string>();
  for (const matchId of matchIds) {
    let current: string | undefined = graph.parentsOf.get(matchId)?.[0];
    while (current) {
      ids.add(current);
      if (current === rootId) break;
      current = graph.parentsOf.get(current)?.[0];
    }
  }
  return [...ids];
}
