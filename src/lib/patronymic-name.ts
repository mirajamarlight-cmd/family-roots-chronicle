import type { FamilyGraph, Person } from "./family.ts";

function storedDisplayName(person: Person): string {
  return (
    person.display_name ||
    [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")
  );
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

function canonicalRootId(graph: FamilyGraph): string | null {
  const yonis = graph.roots.find((id) => graph.byId.get(id)?.display_name === "Yonis");
  return yonis ?? graph.roots[0] ?? null;
}

function parentTowardRoot(graph: FamilyGraph, id: string): string | undefined {
  const parents = graph.parentsOf.get(id) ?? [];
  if (parents.length <= 1) return parents[0];
  const rootId = canonicalRootId(graph);
  if (!rootId) return parents[0];
  return parents.find((pid) => pid === rootId || canReachAncestor(graph, pid, rootId)) ?? parents[0];
}

/**
 * Male patronymic from paternal father + grandfather in the root tree
 * (e.g. Abdulhamid Teweleda Abdosh). Everyone else keeps stored display_name.
 */
export function effectiveDisplayName(graph: FamilyGraph, id: string): string {
  const person = graph.byId.get(id);
  if (!person) return "Unknown";

  const rootId = canonicalRootId(graph);
  if (id === rootId) return person.first_name;

  if ((person.gender ?? "").toLowerCase() === "female") return storedDisplayName(person);

  const fatherId = parentTowardRoot(graph, id);
  if (!fatherId) return storedDisplayName(person);
  const father = graph.byId.get(fatherId);
  if (!father || (father.gender ?? "").toLowerCase() === "female") return storedDisplayName(person);

  const grandfatherId = parentTowardRoot(graph, fatherId);
  if (!grandfatherId) return storedDisplayName(person);
  const grandfather = graph.byId.get(grandfatherId);
  if (!grandfather || (grandfather.gender ?? "").toLowerCase() === "female") {
    return storedDisplayName(person);
  }

  if (
    !rootId ||
    !canReachAncestor(graph, fatherId, rootId) ||
    !canReachAncestor(graph, grandfatherId, rootId)
  ) {
    return storedDisplayName(person);
  }

  return `${person.first_name} ${father.first_name} ${grandfather.first_name}`;
}

/** Father has a documented grandfather on the paternal line toward the root. */
export function hasPatronymicFatherChain(graph: FamilyGraph, fatherId: string): boolean {
  const father = graph.byId.get(fatherId);
  if (!father || (father.gender ?? "").toLowerCase() === "female") return false;

  const grandfatherId = parentTowardRoot(graph, fatherId);
  if (!grandfatherId) return false;
  const grandfather = graph.byId.get(grandfatherId);
  if (!grandfather || (grandfather.gender ?? "").toLowerCase() === "female") return false;

  const rootId = canonicalRootId(graph);
  return (
    !!rootId &&
    canReachAncestor(graph, fatherId, rootId) &&
    canReachAncestor(graph, grandfatherId, rootId)
  );
}

export function personHasPatronymicChain(graph: FamilyGraph, personId: string): boolean {
  const person = graph.byId.get(personId);
  if (!person || (person.gender ?? "").toLowerCase() === "female") return false;
  const fatherId = parentTowardRoot(graph, personId);
  return !!fatherId && hasPatronymicFatherChain(graph, fatherId);
}

/** Preview patronymic for a join draft before the person exists on the tree. */
export function previewPatronymicName(
  graph: FamilyGraph,
  firstName: string,
  fatherId: string,
): string | null {
  if (!firstName.trim() || !hasPatronymicFatherChain(graph, fatherId)) return null;
  const father = graph.byId.get(fatherId);
  const grandfatherId = father ? parentTowardRoot(graph, fatherId) : undefined;
  const grandfather = grandfatherId ? graph.byId.get(grandfatherId) : undefined;
  if (!father || !grandfather) return null;
  return `${firstName.trim()} ${father.first_name} ${grandfather.first_name}`;
}
