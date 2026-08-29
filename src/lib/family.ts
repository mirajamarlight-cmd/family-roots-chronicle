import { supabase } from "@/integrations/supabase/client";

import { effectiveDisplayName } from "./patronymic-name.ts";

export type Person = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  display_name: string;
  gender: string | null;
  birth_date: string | null;
  death_date: string | null;
  is_deceased: boolean;
  photo_url: string | null;
  notes: string | null;
};

export type Link = {
  id: string;
  parent_id: string;
  child_id: string;
  relationship_type: string;
  child_order: number | null;
};
export type Marriage = {
  id: string;
  person1_id: string;
  person2_id: string;
  marriage_date: string | null;
  notes: string | null;
};

export type FamilyGraph = {
  people: Person[];
  byId: Map<string, Person>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  spousesOf: Map<string, string[]>;
  links: Link[];
  marriages: Marriage[];
  roots: string[];
  /** depth from the root of its tree (root = 0) */
  depthOf: Map<string, number>;
  /** the top-level branch ancestor (a child of the "Ahmed" generation) */
  branchOf: Map<string, string | null>;
};

export function personIsDeceased(p: Pick<Person, "is_deceased" | "death_date">): boolean {
  return p.is_deceased || !!p.death_date;
}

export const DECEASED_PHRASE = "إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ";
export const DECEASED_LABEL = "رَحِمَهُ اللَّه";

const PERSON_BASE_COLUMNS =
  "id, first_name, middle_name, last_name, display_name, gender, birth_date, death_date, photo_url, notes";

async function fetchPeople() {
  const withFlag = await supabase
    .from("people")
    .select(`${PERSON_BASE_COLUMNS}, is_deceased`)
    .order("display_name");
  if (!withFlag.error) return (withFlag.data ?? []) as Person[];

  const msg = withFlag.error.message ?? "";
  if (!msg.includes("is_deceased")) throw withFlag.error;

  const base = await supabase.from("people").select(PERSON_BASE_COLUMNS).order("display_name");
  if (base.error) throw base.error;
  return ((base.data ?? []) as Omit<Person, "is_deceased">[]).map((p) => ({
    ...p,
    is_deceased: false,
  }));
}

export async function updatePersonDeceased(
  id: string,
  isDeceased: boolean,
  deathDate: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const death_date = isDeceased ? deathDate : null;
  const withFlag = await supabase.from("people").update({ is_deceased: isDeceased, death_date }).eq("id", id);
  if (!withFlag.error) return { ok: true };

  const msg = withFlag.error.message ?? "";
  if (!msg.includes("is_deceased")) return { ok: false, message: msg };

  if (isDeceased && !death_date) {
    return {
      ok: false,
      message: "Add a death date, or run the is_deceased migration in Supabase SQL editor.",
    };
  }

  const base = await supabase.from("people").update({ death_date }).eq("id", id);
  if (base.error) return { ok: false, message: base.error.message };
  return { ok: true };
}

export async function fetchFamilyGraph(): Promise<FamilyGraph> {
  const [people, linkRes] = await Promise.all([
    fetchPeople(),
    supabase.from("parent_child").select("id, parent_id, child_id, relationship_type, child_order"),
  ]);
  if (linkRes.error) throw linkRes.error;

  return buildGraph(people, (linkRes.data ?? []) as Link[], []);
}

export function buildGraph(people: Person[], links: Link[], marriages: Marriage[]): FamilyGraph {
  const normalized = people.map((p) => ({ ...p, is_deceased: personIsDeceased(p) }));
  const byId = new Map(normalized.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  const linkKey = (parentId: string, childId: string) => `${parentId}:${childId}`;
  const linkByParentChild = new Map<string, Link>();

  for (const l of links) {
    if (!byId.has(l.parent_id) || !byId.has(l.child_id)) continue;
    linkByParentChild.set(linkKey(l.parent_id, l.child_id), l);
    (childrenOf.get(l.parent_id) ?? childrenOf.set(l.parent_id, []).get(l.parent_id)!).push(
      l.child_id,
    );
    (parentsOf.get(l.child_id) ?? parentsOf.set(l.child_id, []).get(l.child_id)!).push(l.parent_id);
  }
  for (const m of marriages) {
    (spousesOf.get(m.person1_id) ?? spousesOf.set(m.person1_id, []).get(m.person1_id)!).push(
      m.person2_id,
    );
    (spousesOf.get(m.person2_id) ?? spousesOf.set(m.person2_id, []).get(m.person2_id)!).push(
      m.person1_id,
    );
  }

  const compareChildren = (parentId: string, a: string, b: string, g: FamilyGraph) => {
    const personA = g.byId.get(a);
    const personB = g.byId.get(b);
    const birthA = personA?.birth_date;
    const birthB = personB?.birth_date;
    if (birthA && birthB) {
      const byBirth = birthA.localeCompare(birthB);
      if (byBirth !== 0) return byBirth;
    } else if (birthA && !birthB) return -1;
    else if (!birthA && birthB) return 1;

    const orderA = linkByParentChild.get(linkKey(parentId, a))?.child_order;
    const orderB = linkByParentChild.get(linkKey(parentId, b))?.child_order;
    if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
    if (orderA != null && orderB == null) return -1;
    if (orderA == null && orderB != null) return 1;

    return effectiveDisplayName(g, a).localeCompare(effectiveDisplayName(g, b));
  };

  const sortChildren = (parentId: string, ids: string[], g: FamilyGraph) =>
    ids.sort((a, b) => compareChildren(parentId, a, b, g));

  const roots = normalized.filter((p) => !parentsOf.has(p.id)).map((p) => p.id);

  const canonicalRoot =
    roots.find((id) => byId.get(id)?.display_name === "Yonis") ?? roots[0] ?? null;

  const depthOf = new Map<string, number>();
  const branchOf = new Map<string, string | null>();
  if (canonicalRoot) {
    const queue: Array<{ id: string; depth: number; branch: string | null }> = [
      { id: canonicalRoot, depth: 0, branch: null },
    ];
    while (queue.length) {
      const { id, depth, branch } = queue.shift()!;
      const prev = depthOf.get(id);
      if (prev !== undefined && prev <= depth) continue;
      depthOf.set(id, depth);
      branchOf.set(id, branch);
      for (const child of childrenOf.get(id) ?? []) {
        queue.push({ id: child, depth: depth + 1, branch: depth + 1 === 2 ? child : branch });
      }
    }
  }
  // people not reachable from canonical root (shouldn't happen, but be safe)
  for (const p of normalized) if (!depthOf.has(p.id)) depthOf.set(p.id, 0);

  const graph: FamilyGraph = {
    people: normalized,
    byId,
    childrenOf,
    parentsOf,
    spousesOf,
    links,
    marriages,
    roots,
    depthOf,
    branchOf,
  };
  childrenOf.forEach((ids, parentId) => sortChildren(parentId, ids, graph));

  return graph;
}

export function descendantCount(graph: FamilyGraph, id: string): number {
  let count = 0;
  const stack = [...(graph.childrenOf.get(id) ?? [])];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    count++;
    stack.push(...(graph.childrenOf.get(cur) ?? []));
  }
  return count;
}

function canReachAncestor(graph: FamilyGraph, fromId: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  const stack = [fromId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === ancestorId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(graph.parentsOf.get(cur) ?? []));
  }
  return false;
}


/** Parent that leads toward the canonical root, else the first recorded parent. */
function parentTowardRoot(graph: FamilyGraph, id: string): string | undefined {
  const parents = graph.parentsOf.get(id) ?? [];
  if (parents.length <= 1) return parents[0];
  const rootId =
    graph.roots.find((r) => graph.byId.get(r)?.display_name === "Yonis") ?? graph.roots[0];
  if (!rootId) return parents[0];
  return parents.find((pid) => pid === rootId || canReachAncestor(graph, pid, rootId)) ?? parents[0];
}

export function recordedParents(graph: FamilyGraph, id: string) {
  return (graph.parentsOf.get(id) ?? []).map((pid) => {
    const person = graph.byId.get(pid);
    const gender = (person?.gender ?? "").toLowerCase();
    const role = gender === "male" ? "Father" : gender === "female" ? "Mother" : "Parent";
    return { id: pid, name: effectiveDisplayName(graph, pid), role };
  });
}

/** Ancestor chain from the root down to (and excluding) the person. */
export function ancestryPath(graph: FamilyGraph, id: string): Person[] {
  const path: Person[] = [];
  const seen = new Set<string>([id]);
  let current = parentTowardRoot(graph, id);
  while (current && !seen.has(current)) {
    seen.add(current);
    const person = graph.byId.get(current);
    if (person) path.unshift(person);
    current = parentTowardRoot(graph, current);
  }
  return path;
}

/** Root-to-person chain including the person, e.g. Yonis › Ahmed › Khedra. */
export function lineageChain(graph: FamilyGraph, id: string): Person[] {
  const person = graph.byId.get(id);
  if (!person) return [];
  return [...ancestryPath(graph, id), person];
}

/** Short ancestor chain for disambiguation (given names only, e.g. Yonis › Ahmed › Abdosh). */
export function lineagePathLabel(graph: FamilyGraph, id: string): string {
  return ancestryPath(graph, id)
    .map((p) => p.first_name)
    .join(" › ");
}

/** Effective display names shared by more than one person on the tree. */
export function duplicateEffectiveNames(graph: FamilyGraph): Set<string> {
  const counts = new Map<string, number>();
  for (const p of graph.people) {
    const name = effectiveDisplayName(graph, p.id);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
}

/** Extra lineage hint when the full name alone is not unique. */
export function personContextLabel(graph: FamilyGraph, id: string, duplicates: Set<string>): string | null {
  if (!duplicates.has(effectiveDisplayName(graph, id))) return null;
  const path = lineagePathLabel(graph, id);
  return path || null;
}

export { effectiveDisplayName, hasPatronymicFatherChain, personHasPatronymicChain, previewPatronymicName } from "./patronymic-name.ts";

/** Human-readable lineage for search results and duplicate-name disambiguation. */
export function lineageLabel(graph: FamilyGraph, id: string): string {
  const chain = lineageChain(graph, id);
  return chain.length ? chain.map((p) => p.first_name).join(" › ") : "Unknown";
}

/** Root id to focus when viewing a person's branch in the tree. */
export function branchFocusId(graph: FamilyGraph, personId: string): string | null {
  const branch = graph.branchOf.get(personId);
  if (branch) return branch;
  if ((graph.childrenOf.get(personId)?.length ?? 0) > 0) return personId;
  return null;
}

/** Lineage from a subtree root down to a target person (inclusive). */
export function pathWithinRoot(graph: FamilyGraph, rootId: string, targetId: string): Person[] {
  const chain = lineageChain(graph, targetId);
  const start = chain.findIndex((p) => p.id === rootId);
  if (start === -1) {
    const root = graph.byId.get(rootId);
    return root ? [root] : chain;
  }
  return chain.slice(start);
}

export function siblingsOf(graph: FamilyGraph, id: string): string[] {
  const result = new Set<string>();
  for (const parent of graph.parentsOf.get(id) ?? []) {
    for (const child of graph.childrenOf.get(parent) ?? []) if (child !== id) result.add(child);
  }
  return [...result];
}

export function searchPeople(graph: FamilyGraph, query: string, limit = 50): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ p: Person; score: number }> = [];
  for (const p of graph.people) {
    const label = effectiveDisplayName(graph, p.id);
    const name = [p.first_name, p.middle_name, p.last_name, label, p.display_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const idx = name.indexOf(q);
    if (idx === -1) continue;
    scored.push({ p, score: idx === 0 ? 0 : 1 });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      effectiveDisplayName(graph, a.p.id).localeCompare(effectiveDisplayName(graph, b.p.id)) ||
      lineageLabel(graph, a.p.id).localeCompare(lineageLabel(graph, b.p.id)),
  );
  return scored.slice(0, limit).map((s) => s.p);
}

/** Default tree root: parentless person named Yonis, else first root. */
export function canonicalRootId(graph: FamilyGraph): string | null {
  const yonis = graph.roots.find((id) => graph.byId.get(id)?.display_name === "Yonis");
  return yonis ?? graph.roots[0] ?? null;
}

/** Branch roots for pickers (third-generation ancestors). */
export function listBranches(graph: FamilyGraph): { id: string; name: string }[] {
  const ids = new Set<string>();
  for (const b of graph.branchOf.values()) if (b) ids.add(b);
  return [...ids]
    .map((id) => ({ id, name: effectiveDisplayName(graph, id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** All person ids reachable from a subtree root. */
export function collectSubtreeIds(graph: FamilyGraph, rootId: string): Set<string> {
  const all = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    all.add(cur);
    stack.push(...(graph.childrenOf.get(cur) ?? []));
  }
  return all;
}

export function maxGeneration(graph: FamilyGraph): number {
  if (!graph.people.length) return 0;
  return Math.max(...graph.people.map((p) => (graph.depthOf.get(p.id) ?? 0) + 1));
}
