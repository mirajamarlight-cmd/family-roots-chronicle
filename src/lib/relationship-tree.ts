import { collectSubtreeIds, type FamilyGraph } from "@/lib/family";
import {
  findRelationship,
  getRelationshipBridge,
  type RelationshipResult,
} from "@/lib/relationship-finder";

/** ponytail: whole-branch cap — above this, show a message instead of the canvas. */
export const RELATIONSHIP_TREE_MAX_NODES = 250;

export type RelationshipTreeScope = {
  rootId: string;
  lcaId: string;
  aId: string;
  bId: string;
  included: Set<string>;
  pathIds: Set<string>;
  tooLarge: boolean;
};

export function buildRelationshipTreeScope(
  graph: FamilyGraph,
  result: RelationshipResult,
): RelationshipTreeScope | null {
  if (result.kind !== "related") return null;

  const bridge = getRelationshipBridge(result);
  if (!bridge) return null;

  const included = new Set<string>();
  const pathIds = new Set<string>();
  const addPath = (path: string[]) => {
    for (const id of path) pathIds.add(id);
  };

  const absorbSubtree = (rootId: string) => {
    for (const id of collectSubtreeIds(graph, rootId)) included.add(id);
  };

  if (bridge.shape === "line") {
    addPath(bridge.ids);
    const rootId = bridge.ids[0]!;
    absorbSubtree(rootId);
    return finalize(graph, rootId, result.lcaId, result.aId, result.bId, included, pathIds);
  }

  addPath(bridge.legA);
  addPath(bridge.legB);
  included.add(bridge.lcaId);

  const childA = bridge.legA[1];
  const childB = bridge.legB[1];
  const directSiblings =
    bridge.legA.length === 2 &&
    bridge.legB.length === 2 &&
    childA &&
    childB &&
    childA !== childB;

  if (directSiblings) {
    for (const child of graph.childrenOf.get(bridge.lcaId) ?? []) absorbSubtree(child);
  } else {
    if (childA) absorbSubtree(childA);
    if (childB && childB !== childA) absorbSubtree(childB);
  }

  return finalize(graph, bridge.lcaId, result.lcaId, result.aId, result.bId, included, pathIds);
}

function finalize(
  graph: FamilyGraph,
  rootId: string,
  lcaId: string,
  aId: string,
  bId: string,
  included: Set<string>,
  pathIds: Set<string>,
): RelationshipTreeScope {
  if (!graph.byId.has(rootId)) {
    for (const id of pathIds) included.add(id);
  }
  return {
    rootId,
    lcaId,
    aId,
    bId,
    included,
    pathIds,
    tooLarge: included.size > RELATIONSHIP_TREE_MAX_NODES,
  };
}

/** Expand every branch node that has included descendants (whole branch visible). */
export function expandedForRelationshipScope(
  graph: FamilyGraph,
  included: Set<string>,
): Set<string> {
  const expanded = new Set<string>();
  for (const id of included) {
    const kids = graph.childrenOf.get(id) ?? [];
    if (kids.some((c) => included.has(c))) expanded.add(id);
  }
  return expanded;
}

export function relationshipTreeScopeFromPair(
  graph: FamilyGraph,
  aId: string,
  bId: string,
): RelationshipTreeScope | null {
  return buildRelationshipTreeScope(graph, findRelationship(graph, aId, bId));
}
