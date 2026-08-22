import type { FamilyGraph, Person } from "./family";

export type RelationshipResult =
  | { kind: "same"; aId: string; bId: string }
  | { kind: "unrelated"; aId: string; bId: string }
  | {
      kind: "related";
      aId: string;
      bId: string;
      /** e.g. "aunt", "first cousin once removed" — used in "A is the {relation} of B" */
      relation: string;
      lcaId: string;
      pathFromLcaToA: string[];
      pathFromLcaToB: string[];
    };

type AncestorMap = Map<string, number>;

function personName(graph: FamilyGraph, id: string): string {
  return graph.byId.get(id)?.display_name ?? "Unknown";
}

/** Shortest upward distances from `personId` (self = 0). */
export function ancestorsWithDistance(graph: FamilyGraph, personId: string): AncestorMap {
  const distances = new Map<string, number>();
  if (!graph.byId.has(personId)) return distances;

  distances.set(personId, 0);
  const queue = [personId];

  while (queue.length) {
    const cur = queue.shift()!;
    const d = distances.get(cur)!;
    for (const parent of graph.parentsOf.get(cur) ?? []) {
      if (distances.has(parent)) continue;
      distances.set(parent, d + 1);
      queue.push(parent);
    }
  }
  return distances;
}

/** Walk upward from `fromId` toward `ancestorId` using shortest-distance steps. */
export function pathUpTo(
  graph: FamilyGraph,
  fromId: string,
  ancestorId: string,
  distances: AncestorMap,
): string[] {
  const path: string[] = [];
  let cur = fromId;
  const seen = new Set<string>();

  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.push(cur);
    if (cur === ancestorId) break;
    const parents = graph.parentsOf.get(cur) ?? [];
    const next = parents
      .filter((p) => distances.has(p) && distances.get(p)! < distances.get(cur)!)
      .sort((x, y) => distances.get(x)! - distances.get(y)!)[0];
    if (!next) break;
    cur = next;
  }

  return path.reverse();
}

function sharedParentCount(graph: FamilyGraph, aId: string, bId: string): number {
  const parentsA = new Set(graph.parentsOf.get(aId) ?? []);
  let count = 0;
  for (const p of graph.parentsOf.get(bId) ?? []) {
    if (parentsA.has(p)) count++;
  }
  return count;
}

function ancestorTitle(person: Person, generations: number): string {
  if (generations === 1) {
    if (person.gender === "male") return "father";
    if (person.gender === "female") return "mother";
    return "parent";
  }
  const prefix =
    generations === 2 ? "grand" : `${"great-".repeat(generations - 2)}grand`;
  if (person.gender === "male") return `${prefix}father`;
  if (person.gender === "female") return `${prefix}mother`;
  return `${prefix}parent`;
}

function descendantTitle(person: Person, generations: number): string {
  if (generations === 1) {
    if (person.gender === "male") return "son";
    if (person.gender === "female") return "daughter";
    return "child";
  }
  if (generations === 2) {
    if (person.gender === "male") return "grandson";
    if (person.gender === "female") return "granddaughter";
    return "grandchild";
  }
  const prefix =
    generations === 3 ? "great-" : `${"great-".repeat(generations - 2)}`;
  if (person.gender === "male") return `${prefix}grandson`;
  if (person.gender === "female") return `${prefix}granddaughter`;
  return `${prefix}grandchild`;
}

function siblingTitle(person: Person, half: boolean): string {
  const halfPrefix = half ? "half-" : "";
  if (person.gender === "male") return `${halfPrefix}brother`;
  if (person.gender === "female") return `${halfPrefix}sister`;
  return `${halfPrefix}sibling`;
}

function auntUncleTitle(person: Person): string {
  if (person.gender === "male") return "uncle";
  if (person.gender === "female") return "aunt";
  return "aunt or uncle";
}

function nieceNephewTitle(person: Person): string {
  if (person.gender === "male") return "nephew";
  if (person.gender === "female") return "niece";
  return "niece or nephew";
}

const ORDINAL_COUSIN = ["", "first", "second", "third", "fourth", "fifth"] as const;

function cousinTitle(degree: number, removal: number): string {
  const degreeStr = ORDINAL_COUSIN[degree] ?? `${degree}th`;
  let label = `${degreeStr} cousin`;
  if (removal === 1) label += " once removed";
  else if (removal === 2) label += " twice removed";
  else if (removal > 2) label += ` ${removal} times removed`;
  return label;
}

function findLowestCommonAncestor(
  ancA: AncestorMap,
  ancB: AncestorMap,
  exclude: Set<string>,
): { lcaId: string; dA: number; dB: number } | null {
  let best: { lcaId: string; dA: number; dB: number; score: number } | null = null;

  for (const [id, dA] of ancA) {
    if (exclude.has(id)) continue;
    const dB = ancB.get(id);
    if (dB === undefined) continue;
    const score = dA + dB;
    if (!best || score < best.score) best = { lcaId: id, dA, dB, score };
  }
  return best ? { lcaId: best.lcaId, dA: best.dA, dB: best.dB } : null;
}

function relationLabel(
  graph: FamilyGraph,
  aId: string,
  bId: string,
  ancA: AncestorMap,
  ancB: AncestorMap,
): Omit<Extract<RelationshipResult, { kind: "related" }>, "kind" | "aId" | "bId"> | null {
  const personA = graph.byId.get(aId)!;
  const personB = graph.byId.get(bId)!;

  const bToA = ancB.get(aId);
  if (bToA !== undefined && bToA > 0) {
    const lcaId = aId;
    return {
      relation: ancestorTitle(personA, bToA),
      lcaId,
      pathFromLcaToA: [aId],
      pathFromLcaToB: pathUpTo(graph, bId, lcaId, ancB),
    };
  }

  const aToB = ancA.get(bId);
  if (aToB !== undefined && aToB > 0) {
    const lcaId = bId;
    return {
      relation: descendantTitle(personA, aToB),
      lcaId,
      pathFromLcaToA: pathUpTo(graph, aId, lcaId, ancA),
      pathFromLcaToB: [bId],
    };
  }

  const lca = findLowestCommonAncestor(ancA, ancB, new Set());
  if (!lca) return null;

  const { lcaId, dA, dB } = lca;
  const pathFromLcaToA = pathUpTo(graph, aId, lcaId, ancA);
  const pathFromLcaToB = pathUpTo(graph, bId, lcaId, ancB);

  if (dA === 1 && dB === 1) {
    const half = sharedParentCount(graph, aId, bId) === 1;
    return { relation: siblingTitle(personA, half), lcaId, pathFromLcaToA, pathFromLcaToB };
  }
  if (dA === 1 && dB === 2) {
    return { relation: auntUncleTitle(personA), lcaId, pathFromLcaToA, pathFromLcaToB };
  }
  if (dA === 2 && dB === 1) {
    return { relation: nieceNephewTitle(personA), lcaId, pathFromLcaToA, pathFromLcaToB };
  }
  if (dA >= 2 && dB >= 2) {
    const degree = Math.min(dA, dB) - 1;
    const removal = Math.abs(dA - dB);
    return { relation: cousinTitle(degree, removal), lcaId, pathFromLcaToA, pathFromLcaToB };
  }

  // ponytail: rare collateral types (e.g. grand-aunt) fall back to cousin wording
  const degree = Math.max(Math.min(dA, dB) - 1, 1);
  const removal = Math.abs(dA - dB);
  return { relation: cousinTitle(degree, removal), lcaId, pathFromLcaToA, pathFromLcaToB };
}

/** Blood-only relationship from person A toward person B. */
export function findRelationship(
  graph: FamilyGraph,
  aId: string,
  bId: string,
): RelationshipResult {
  if (!graph.byId.has(aId) || !graph.byId.has(bId)) {
    return { kind: "unrelated", aId, bId };
  }
  if (aId === bId) return { kind: "same", aId, bId };

  const ancA = ancestorsWithDistance(graph, aId);
  const ancB = ancestorsWithDistance(graph, bId);

  const related = relationLabel(graph, aId, bId, ancA, ancB);
  if (!related) return { kind: "unrelated", aId, bId };

  return { kind: "related", aId, bId, ...related };
}

/** Directional sentence: "Khedra is the aunt of Hamdi". */
export function formatRelationshipSentence(graph: FamilyGraph, result: RelationshipResult): string {
  if (result.kind === "same") {
    return `${personName(graph, result.aId)} is the same person.`;
  }
  if (result.kind === "unrelated") {
    return `${personName(graph, result.aId)} and ${personName(graph, result.bId)} have no documented blood relationship.`;
  }
  return `${personName(graph, result.aId)} is the ${result.relation} of ${personName(graph, result.bId)}.`;
}

export function formatRelationshipPath(graph: FamilyGraph, ids: string[]): string {
  return ids.map((id) => personName(graph, id)).join(" › ");
}

export type RelationshipBridge =
  | { shape: "line"; ids: string[]; aId: string; bId: string }
  | { shape: "fork"; lcaId: string; legA: string[]; legB: string[]; aId: string; bId: string };

/** Unified connection view — one line or a fork at the lowest common ancestor. */
export function getRelationshipBridge(
  result: RelationshipResult,
): RelationshipBridge | null {
  if (result.kind !== "related") return null;

  const { pathFromLcaToA, pathFromLcaToB, aId, bId, lcaId } = result;

  const aPrefixesB =
    pathFromLcaToB.length >= pathFromLcaToA.length &&
    pathFromLcaToA.every((id, i) => pathFromLcaToB[i] === id);
  if (aPrefixesB) return { shape: "line", ids: pathFromLcaToB, aId, bId };

  const bPrefixesA =
    pathFromLcaToA.length >= pathFromLcaToB.length &&
    pathFromLcaToB.every((id, i) => pathFromLcaToA[i] === id);
  if (bPrefixesA) return { shape: "line", ids: pathFromLcaToA, aId, bId };

  return { shape: "fork", lcaId, legA: pathFromLcaToA, legB: pathFromLcaToB, aId, bId };
}

export function formatRelationshipBridge(graph: FamilyGraph, bridge: RelationshipBridge): string {
  if (bridge.shape === "line") {
    return [...bridge.ids]
      .reverse()
      .map((id) => personName(graph, id))
      .join(" › ");
  }

  const lca = personName(graph, bridge.lcaId);
  const upA = [...bridge.legA]
    .reverse()
    .map((id) => personName(graph, id))
    .join(" › ");
  const upB = [...bridge.legB]
    .reverse()
    .map((id) => personName(graph, id))
    .join(" › ");
  return `${upA} and ${upB} meet at ${lca}`;
}

export type RelationshipTreeView = {
  rootId: string;
  /** Expanded through both paths — reveals full sibling groups at each level. */
  expanded: Set<string>;
  /** Every person on either connecting path (LCA → A and LCA → B). */
  pathIds: Set<string>;
  /** Parent→child edges along those paths. */
  pathEdgeIds: Set<string>;
};

function pathEdgeIdsFrom(paths: string[][]): Set<string> {
  const edges = new Set<string>();
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      edges.add(`${path[i]}-${path[i + 1]}`);
    }
  }
  return edges;
}

/** Tree rooted at the common ancestor, expanded along both paths (whole branch at each level). */
export function buildRelationshipTreeView(
  result: Extract<RelationshipResult, { kind: "related" }>,
): RelationshipTreeView {
  const { lcaId, pathFromLcaToA, pathFromLcaToB } = result;
  const expanded = new Set<string>();

  for (const path of [pathFromLcaToA, pathFromLcaToB]) {
    for (let i = 0; i < path.length - 1; i++) {
      expanded.add(path[i]!);
    }
  }

  const pathIds = new Set([...pathFromLcaToA, ...pathFromLcaToB]);
  const pathEdgeIds = pathEdgeIdsFrom([pathFromLcaToA, pathFromLcaToB]);

  return {
    rootId: lcaId,
    expanded,
    pathIds,
    pathEdgeIds,
  };
}