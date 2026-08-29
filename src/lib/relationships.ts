import { supabase } from "@/integrations/supabase/client";
import type { FamilyGraph } from "@/lib/family";

export type LinkValidation = { ok: true } | { ok: false; reason: string };

/** Validate a prospective parent -> child link against the current graph. */
export function validateParentChild(
  graph: FamilyGraph,
  parentId: string,
  childId: string,
): LinkValidation {
  if (!parentId || !childId) return { ok: false, reason: "Select both people first." };
  // orphan link guard: both endpoints must exist in the record
  if (!graph.byId.has(parentId))
    return { ok: false, reason: "That parent is no longer in the record." };
  if (!graph.byId.has(childId))
    return { ok: false, reason: "That child is no longer in the record." };
  if (parentId === childId) return { ok: false, reason: "A person cannot be their own parent." };

  const duplicate = graph.links.some((l) => l.parent_id === parentId && l.child_id === childId);
  if (duplicate) return { ok: false, reason: "That parent–child link already exists." };

  const reversed = graph.links.some((l) => l.parent_id === childId && l.child_id === parentId);
  if (reversed) return { ok: false, reason: "Those two are already linked the other way round." };

  if (isDescendant(graph, childId, parentId)) {
    return { ok: false, reason: "That would create a loop in the tree." };
  }

  const parents = graph.parentsOf.get(childId) ?? [];
  if (parents.length >= 2) {
    return { ok: false, reason: "That person already has two recorded parents." };
  }
  return { ok: true };
}

/** true when `maybeDescendant` sits below `ancestorId` in the tree. */
export function isDescendant(
  graph: FamilyGraph,
  ancestorId: string,
  maybeDescendant: string,
): boolean {
  const stack = [...(graph.childrenOf.get(ancestorId) ?? [])];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === maybeDescendant) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(graph.childrenOf.get(cur) ?? []));
  }
  return false;
}

/** Validate making `siblingId` a sibling of `personId` (shares every recorded parent). */
export function validateSibling(
  graph: FamilyGraph,
  personId: string,
  siblingId: string,
): LinkValidation {
  if (!personId || !siblingId) return { ok: false, reason: "Select both people first." };
  if (!graph.byId.has(personId) || !graph.byId.has(siblingId)) {
    return { ok: false, reason: "One of those people is no longer in the record." };
  }
  if (personId === siblingId) return { ok: false, reason: "A person cannot be their own sibling." };

  const parents = graph.parentsOf.get(personId) ?? [];
  if (parents.length === 0) {
    return {
      ok: false,
      reason:
        "This person has no recorded parent, so a sibling link would be an orphan. Add a parent first.",
    };
  }
  const missing = parents.filter(
    (parentId) => !graph.links.some((l) => l.parent_id === parentId && l.child_id === siblingId),
  );
  if (missing.length === 0) return { ok: false, reason: "They are already recorded as siblings." };

  for (const parentId of missing) {
    const check = validateParentChild(graph, parentId, siblingId);
    if (!check.ok) return check;
  }
  return { ok: true };
}

export async function addParentChild(
  parentId: string,
  childId: string,
  relationshipType = "biological",
) {
  const { error } = await supabase
    .from("parent_child")
    .insert({ parent_id: parentId, child_id: childId, relationship_type: relationshipType });
  if (error) throw error;
}

export async function removeParentChild(parentId: string, childId: string) {
  const { error } = await supabase
    .from("parent_child")
    .delete()
    .eq("parent_id", parentId)
    .eq("child_id", childId);
  if (error) throw error;
}

export async function setChildOrder(parentId: string, orderedChildIds: string[]) {
  const updates = orderedChildIds.map((childId, index) =>
    supabase
      .from("parent_child")
      .update({ child_order: index })
      .eq("parent_id", parentId)
      .eq("child_id", childId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function addSibling(graph: FamilyGraph, personId: string, siblingId: string) {
  const parents = graph.parentsOf.get(personId) ?? [];
  for (const parentId of parents) {
    const exists = graph.links.some((l) => l.parent_id === parentId && l.child_id === siblingId);
    if (!exists) await addParentChild(parentId, siblingId);
  }
}
