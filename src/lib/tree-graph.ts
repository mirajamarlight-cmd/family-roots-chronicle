import { siblingsOf, type FamilyGraph } from "./family.ts";

/** Slot reserved per person: portrait + name under it. */
export const TREE_NODE_W = 108;
export const TREE_NODE_H = 118;
export const TREE_PORTRAIT = 72;
const UNIT_GAP = 22;
const SIB_GAP = 40;
const ROW_GAP = 168;

export type TreeDepth = 1 | 2 | "all";

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
};

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: "down" | "right";
  targetHandle: "up" | "left";
  kind: "child" | "spouse";
};

/**
 * People within `hops` family steps: parents, children, spouses, and siblings
 * count as one step. A sibling's spouse is two steps.
 */
export function neighborhood(graph: FamilyGraph, id: string, hops: number): Set<string> {
  const seen = new Set<string>();
  if (!graph.byId.has(id) || hops < 0) return seen;
  let wave = [id];
  for (let d = 0; d <= hops; d++) {
    const next: string[] = [];
    for (const cur of wave) {
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (d === hops) continue;
      const push = (n: string) => {
        if (graph.byId.has(n)) next.push(n);
      };
      for (const p of graph.parentsOf.get(cur) ?? []) push(p);
      for (const c of graph.childrenOf.get(cur) ?? []) push(c);
      for (const s of graph.spousesOf.get(cur) ?? []) push(s);
      for (const s of siblingsOf(graph, cur)) push(s);
    }
    wave = next;
  }
  return seen;
}

/**
 * Top-down layout. Generations stay on fixed rows. Spouses who are not
 * themselves in the bloodline sit on the anchor's row, to the right.
 *
 * ponytail: a spouse recorded on both sides of a cousin marriage is drawn
 * with a straight line that can cross other branches. A family-unit
 * Sugiyama pass is the upgrade if those lines get hard to read.
 */
export function layoutFamilyCanvas(input: {
  graph: FamilyGraph;
  rootId: string;
  expanded: Set<string>;
  depth: TreeDepth;
  focusId: string | null;
  visibleIds?: Set<string> | undefined;
}): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const { graph, rootId, expanded, depth, focusId, visibleIds } = input;
  const shown = collectShown(graph, rootId, expanded, depth, focusId, visibleIds);
  if (!shown.size) return { nodes: [], edges: [] };

  const { blood, seeds, attachedTo } = bloodline(graph, shown, rootId);
  const nodes: Array<LayoutNode & { gen: number }> = [];
  const widths = new Map<string, number>();
  const measuring = new Set<string>();
  const placed = new Set<string>();

  const unitWidth = (id: string) => {
    const n = 1 + (attachedTo.get(id)?.length ?? 0);
    return n * TREE_NODE_W + (n - 1) * UNIT_GAP;
  };

  const kidsOf = (id: string) =>
    (graph.childrenOf.get(id) ?? []).filter(
      (c) => blood.has(c) && preferredParent(graph, c, shown) === id,
    );

  const measure = (id: string): number => {
    const hit = widths.get(id);
    if (hit != null) return hit;
    if (measuring.has(id)) return unitWidth(id);
    measuring.add(id);
    const kids = kidsOf(id);
    let kidsW = 0;
    kids.forEach((k, i) => {
      kidsW += measure(k) + (i ? SIB_GAP : 0);
    });
    const w = Math.max(unitWidth(id), kidsW);
    widths.set(id, w);
    measuring.delete(id);
    return w;
  };

  const place = (id: string, left: number) => {
    if (placed.has(id)) return;
    placed.add(id);
    const w = measure(id);
    const spouses = attachedTo.get(id) ?? [];
    const own = unitWidth(id);
    const unitLeft = left + (w - own) / 2;
    const gen = graph.depthOf.get(id) ?? 0;
    nodes.push({ id, x: unitLeft, y: 0, gen });
    spouses.forEach((s, i) => {
      placed.add(s);
      nodes.push({
        id: s,
        x: unitLeft + (i + 1) * (TREE_NODE_W + UNIT_GAP),
        y: 0,
        gen,
      });
    });
    const kids = kidsOf(id);
    if (!kids.length) return;
    let kidsW = 0;
    kids.forEach((k, i) => {
      kidsW += measure(k) + (i ? SIB_GAP : 0);
    });
    let x = left + (w - kidsW) / 2;
    for (const k of kids) {
      place(k, x);
      x += measure(k) + SIB_GAP;
    }
  };

  let cursor = 0;
  for (const seed of seeds) {
    if (!blood.has(seed) || placed.has(seed)) continue;
    place(seed, cursor);
    cursor += measure(seed) + SIB_GAP * 2;
  }

  const minGen = nodes.reduce((m, n) => Math.min(m, n.gen), Infinity);
  const laid: LayoutNode[] = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: (n.gen - minGen) * ROW_GAP,
  }));

  const xOf = new Map(laid.map((n) => [n.id, n.x]));
  const edges: LayoutEdge[] = [];
  const childIds = new Set<string>();
  for (const n of laid) {
    for (const c of graph.childrenOf.get(n.id) ?? []) {
      if (!xOf.has(c)) continue;
      const id = `${n.id}-${c}`;
      if (childIds.has(id)) continue;
      childIds.add(id);
      edges.push({
        id,
        source: n.id,
        target: c,
        sourceHandle: "down",
        targetHandle: "up",
        kind: "child",
      });
    }
  }

  const spouseSeen = new Set<string>();
  for (const n of laid) {
    for (const s of graph.spousesOf.get(n.id) ?? []) {
      if (!xOf.has(s)) continue;
      const key = [n.id, s].sort().join(":");
      if (spouseSeen.has(key)) continue;
      spouseSeen.add(key);
      const left = (xOf.get(n.id) ?? 0) <= (xOf.get(s) ?? 0) ? n.id : s;
      const right = left === n.id ? s : n.id;
      edges.push({
        id: `spouse:${key}`,
        source: left,
        target: right,
        sourceHandle: "right",
        targetHandle: "left",
        kind: "spouse",
      });
    }
  }

  return { nodes: laid, edges };
}

function collectShown(
  graph: FamilyGraph,
  rootId: string,
  expanded: Set<string>,
  depth: TreeDepth,
  focusId: string | null,
  visibleIds: Set<string> | undefined,
): Set<string> {
  if (!graph.byId.has(rootId) && !(focusId && graph.byId.has(focusId))) return new Set();

  if (depth !== "all") {
    const focus = focusId && graph.byId.has(focusId) ? focusId : rootId;
    const near = neighborhood(graph, focus, depth);
    if (!visibleIds) return near;
    const filtered = new Set([...near].filter((id) => visibleIds.has(id)));
    if (graph.byId.has(focus)) filtered.add(focus);
    return filtered;
  }

  const shown = new Set<string>();
  if (!graph.byId.has(rootId)) return shown;
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (shown.has(id) || !graph.byId.has(id)) continue;
    if (visibleIds && id !== rootId && !visibleIds.has(id)) continue;
    shown.add(id);
    if (!expanded.has(id)) continue;
    for (const c of graph.childrenOf.get(id) ?? []) {
      if (!visibleIds || visibleIds.has(c)) stack.push(c);
    }
  }
  // Spouses of people already on the branch. Their own exclusive children
  // stay hidden until that spouse is expanded or you use depth 1/2.
  if (!visibleIds) {
    for (const id of [...shown]) {
      for (const s of graph.spousesOf.get(id) ?? []) {
        if (graph.byId.has(s)) shown.add(s);
      }
    }
  }
  return shown;
}

/** Prefer the parent who sits further down the recorded tree (external spouses are depth 0). */
function preferredParent(graph: FamilyGraph, child: string, shown: Set<string>): string | undefined {
  const parents = (graph.parentsOf.get(child) ?? []).filter((p) => shown.has(p));
  if (!parents.length) return undefined;
  return [...parents].sort(
    (a, b) => (graph.depthOf.get(b) ?? 0) - (graph.depthOf.get(a) ?? 0) || a.localeCompare(b),
  )[0];
}

function bloodline(graph: FamilyGraph, shown: Set<string>, rootId: string) {
  const noParent = [...shown].filter(
    (id) => !(graph.parentsOf.get(id) ?? []).some((p) => shown.has(p)),
  );
  noParent.sort((a, b) => {
    if (a === rootId) return -1;
    if (b === rootId) return 1;
    return (graph.depthOf.get(b) ?? 0) - (graph.depthOf.get(a) ?? 0) || a.localeCompare(b);
  });

  const side = new Set<string>();
  const seeds: string[] = [];
  for (const id of noParent) {
    const spouses = (graph.spousesOf.get(id) ?? []).filter((s) => shown.has(s));
    const exclusive = (graph.childrenOf.get(id) ?? [])
      .filter((c) => shown.has(c))
      .some((c) => (graph.parentsOf.get(c) ?? []).filter((p) => shown.has(p)).length === 1);
    const spouseIsBloodline = spouses.some(
      (s) => s === rootId || (graph.parentsOf.get(s) ?? []).some((p) => shown.has(p)),
    );
    const spouseAlreadySeed = spouses.some((s) => seeds.includes(s));
    if (!exclusive && spouses.length > 0 && (spouseIsBloodline || spouseAlreadySeed)) side.add(id);
    else seeds.push(id);
  }

  if (!seeds.length) {
    if (shown.has(rootId)) seeds.push(rootId);
    else if (shown.size) seeds.push([...shown][0]!);
  }

  const blood = new Set<string>();
  const stack = [...seeds];
  while (stack.length) {
    const id = stack.pop()!;
    if (blood.has(id) || !shown.has(id) || side.has(id)) continue;
    blood.add(id);
    for (const c of graph.childrenOf.get(id) ?? []) {
      if (!shown.has(c) || side.has(c)) continue;
      if (preferredParent(graph, c, shown) !== id) continue;
      stack.push(c);
    }
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const id of shown) {
      if (blood.has(id) || side.has(id)) continue;
      const parent = preferredParent(graph, id, shown);
      if (parent && blood.has(parent)) {
        blood.add(id);
        grew = true;
      }
    }
  }

  const rank = new Map<string, number>();
  graph.marriages.forEach((m, i) => {
    rank.set(`${m.person1_id}:${m.person2_id}`, i);
    rank.set(`${m.person2_id}:${m.person1_id}`, i);
  });

  const claimed = new Set<string>();
  const attachedTo = new Map<string, string[]>();
  const bloodOrdered = [...blood].sort(
    (a, b) => (graph.depthOf.get(a) ?? 0) - (graph.depthOf.get(b) ?? 0) || a.localeCompare(b),
  );
  for (const id of bloodOrdered) {
    const list = (graph.spousesOf.get(id) ?? []).filter(
      (s) => shown.has(s) && !blood.has(s) && !claimed.has(s),
    );
    list.sort(
      (a, b) =>
        (rank.get(`${id}:${a}`) ?? 999) - (rank.get(`${id}:${b}`) ?? 999) || a.localeCompare(b),
    );
    for (const s of list) claimed.add(s);
    if (list.length) attachedTo.set(id, list);
  }

  for (const id of shown) {
    if (blood.has(id) || claimed.has(id)) continue;
    blood.add(id);
    seeds.push(id);
  }

  return { blood, seeds, attachedTo };
}
