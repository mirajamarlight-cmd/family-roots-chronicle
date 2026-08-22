import {
  findRelationship,
  formatRelationshipSentence,
} from "./relationship-finder.ts";
import type { FamilyGraph, Link, Person } from "./family.ts";

function person(id: string, display_name: string, gender: string | null = null): Person {
  return {
    id,
    first_name: display_name,
    middle_name: null,
    last_name: null,
    display_name,
    gender,
    birth_date: null,
    death_date: null,
    photo_url: null,
    notes: null,
  };
}

function link(parent_id: string, child_id: string): Link {
  return { id: `${parent_id}-${child_id}`, parent_id, child_id, relationship_type: "biological" };
}

/** ponytail: minimal graph builder for self-check only — avoids pulling supabase via family.ts */
function testGraph(people: Person[], links: Link[]): FamilyGraph {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const l of links) {
    (childrenOf.get(l.parent_id) ?? childrenOf.set(l.parent_id, []).get(l.parent_id)!).push(
      l.child_id,
    );
    (parentsOf.get(l.child_id) ?? parentsOf.set(l.child_id, []).get(l.child_id)!).push(l.parent_id);
  }

  const roots = people.filter((p) => !parentsOf.has(p.id)).map((p) => p.id);
  const depthOf = new Map<string, number>();
  const branchOf = new Map<string, string | null>();
  const root = roots[0];
  if (root) {
    const queue: Array<{ id: string; depth: number; branch: string | null }> = [
      { id: root, depth: 0, branch: null },
    ];
    while (queue.length) {
      const { id, depth, branch } = queue.shift()!;
      if (depthOf.has(id) && depthOf.get(id)! <= depth) continue;
      depthOf.set(id, depth);
      branchOf.set(id, branch);
      for (const child of childrenOf.get(id) ?? []) {
        queue.push({ id: child, depth: depth + 1, branch: depth + 1 === 2 ? child : branch });
      }
    }
  }

  return {
    people,
    byId,
    childrenOf,
    parentsOf,
    spousesOf,
    links,
    marriages: [],
    roots,
    depthOf,
    branchOf,
  };
}

const fixture = testGraph(
  [
    person("yonis", "Yonis", "male"),
    person("ahmed", "Ahmed", "male"),
    person("khedra", "Khedra", "female"),
    person("abdosh", "Abdosh", "male"),
    person("fatuma", "Fatuma", "female"),
    person("hamdi", "Hamdi", "male"),
    person("ali", "Ali", "male"),
  ],
  [
    link("yonis", "ahmed"),
    link("ahmed", "khedra"),
    link("ahmed", "abdosh"),
    link("ahmed", "fatuma"),
    link("abdosh", "hamdi"),
    link("fatuma", "ali"),
  ],
);

function expectSentence(aId: string, bId: string, includes: string): void {
  const sentence = formatRelationshipSentence(fixture, findRelationship(fixture, aId, bId));
  if (!sentence.toLowerCase().includes(includes)) {
    throw new Error(`Expected "${includes}" in: ${sentence}`);
  }
}

expectSentence("khedra", "hamdi", "aunt");
expectSentence("khedra", "abdosh", "sister");
expectSentence("hamdi", "ali", "cousin");
expectSentence("yonis", "hamdi", "grand");
expectSentence("hamdi", "hamdi", "same person");

console.log("relationship-finder self-check passed");
