import { supabase } from "@/integrations/supabase/client";

export type Person = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  display_name: string;
  gender: string | null;
  birth_date: string | null;
  death_date: string | null;
  photo_url: string | null;
  notes: string | null;
};

export type Link = { id: string; parent_id: string; child_id: string; relationship_type: string };
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

const PERSON_COLUMNS =
  "id, first_name, middle_name, last_name, display_name, gender, birth_date, death_date, photo_url, notes";

export async function fetchFamilyGraph(): Promise<FamilyGraph> {
  const [peopleRes, linkRes, marriageRes] = await Promise.all([
    supabase.from("people").select(PERSON_COLUMNS).order("display_name"),
    supabase.from("parent_child").select("id, parent_id, child_id, relationship_type"),
    supabase.from("marriages").select("id, person1_id, person2_id, marriage_date, notes"),
  ]);
  if (peopleRes.error) throw peopleRes.error;
  if (linkRes.error) throw linkRes.error;
  if (marriageRes.error) throw marriageRes.error;

  return buildGraph(
    (peopleRes.data ?? []) as Person[],
    (linkRes.data ?? []) as Link[],
    (marriageRes.data ?? []) as Marriage[],
  );
}

export function buildGraph(people: Person[], links: Link[], marriages: Marriage[]): FamilyGraph {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const l of links) {
    if (!byId.has(l.parent_id) || !byId.has(l.child_id)) continue;
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

  const sortByName = (ids: string[]) =>
    ids.sort((a, b) =>
      (byId.get(a)?.display_name ?? "").localeCompare(byId.get(b)?.display_name ?? ""),
    );
  childrenOf.forEach(sortByName);

  const roots = people.filter((p) => !parentsOf.has(p.id)).map((p) => p.id);

  const depthOf = new Map<string, number>();
  const branchOf = new Map<string, string | null>();
  const queue: Array<{ id: string; depth: number; branch: string | null }> = roots.map((id) => ({
    id,
    depth: 0,
    branch: null,
  }));
  const seen = new Set<string>();
  while (queue.length) {
    const { id, depth, branch } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    depthOf.set(id, depth);
    branchOf.set(id, branch);
    for (const child of childrenOf.get(id) ?? []) {
      // branch = the third generation (children of the root's child), e.g. Ahmed's children
      queue.push({ id: child, depth: depth + 1, branch: depth + 1 === 2 ? child : branch });
    }
  }
  // people not reachable from a root (shouldn't happen, but be safe)
  for (const p of people) if (!depthOf.has(p.id)) depthOf.set(p.id, 0);

  return {
    people,
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

/** Ancestor chain from the root down to (and excluding) the person. */
export function ancestryPath(graph: FamilyGraph, id: string): Person[] {
  const path: Person[] = [];
  const seen = new Set<string>([id]);
  let current = graph.parentsOf.get(id)?.[0];
  while (current && !seen.has(current)) {
    seen.add(current);
    const person = graph.byId.get(current);
    if (person) path.unshift(person);
    current = graph.parentsOf.get(current)?.[0];
  }
  return path;
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
    const name = [p.first_name, p.middle_name, p.last_name, p.display_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const idx = name.indexOf(q);
    if (idx === -1) continue;
    scored.push({ p, score: idx === 0 ? 0 : 1 });
  }
  scored.sort((a, b) => a.score - b.score || a.p.display_name.localeCompare(b.p.display_name));
  return scored.slice(0, limit).map((s) => s.p);
}
