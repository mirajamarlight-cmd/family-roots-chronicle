import {
  findRelationship,
  formatRelationshipSentence,
  formatRelationshipStory,
  getRelationshipBridge,
  relationshipPathLinkIds,
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
    is_deceased: false,
    photo_url: null,
    notes: null,
  };
}

function link(parent_id: string, child_id: string): Link {
  return { id: `${parent_id}-${child_id}`, parent_id, child_id, relationship_type: "biological", child_order: null };
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

function storyText(aId: string, bId: string): string {
  const result = findRelationship(fixture, aId, bId);
  return formatRelationshipStory(fixture, result)
    .map((line) =>
      line
        .map((span) => ("t" in span ? span.t : (fixture.byId.get(span.id)?.display_name ?? "")))
        .join(""),
    )
    .join(" ");
}

function expectPath(aId: string, bId: string, pathA: string, pathB: string): void {
  const result = findRelationship(fixture, aId, bId);
  if (result.kind !== "related") {
    throw new Error(`Expected related for ${aId}/${bId}, got ${result.kind}`);
  }
  const gotA = result.pathFromLcaToA.join(">");
  const gotB = result.pathFromLcaToB.join(">");
  if (gotA !== pathA || gotB !== pathB) {
    throw new Error(`Path mismatch for ${aId}/${bId}: ${gotA} / ${gotB}`);
  }
}

expectPath("hamdi", "ali", "ahmed>abdosh>hamdi", "ahmed>fatuma>ali");
expectPath("khedra", "hamdi", "ahmed>khedra", "ahmed>abdosh>hamdi");
expectPath("yonis", "hamdi", "yonis", "yonis>ahmed>abdosh>hamdi");

const hamdiAli = storyText("hamdi", "ali");
if (!hamdiAli.includes("Hamdi is the son of Abdosh")) {
  throw new Error(`Hamdi lineage missing in: ${hamdiAli}`);
}
if (!hamdiAli.includes("Ali is the son of Fatuma")) {
  throw new Error(`Ali lineage missing in: ${hamdiAli}`);
}
if (!hamdiAli.includes("related through Ahmed")) {
  throw new Error(`Shared ancestor missing in: ${hamdiAli}`);
}

const khedraHamdi = storyText("khedra", "hamdi");
if (!khedraHamdi.includes("Khedra is the daughter of Ahmed")) {
  throw new Error(`Aunt lineage missing in: ${khedraHamdi}`);
}
if (!khedraHamdi.includes("Hamdi is the son of Abdosh")) {
  throw new Error(`Nephew lineage missing in: ${khedraHamdi}`);
}

const cousinBridge = getRelationshipBridge(findRelationship(fixture, "hamdi", "ali"));
if (!cousinBridge || cousinBridge.shape !== "fork") {
  throw new Error("Expected fork bridge for cousins");
}
const cousinPath = relationshipPathLinkIds(cousinBridge);
if (cousinPath.join(">") !== "hamdi>abdosh>ahmed>fatuma>ali") {
  throw new Error(`Cousin path link order wrong: ${cousinPath.join(">")}`);
}

console.log("relationship-finder self-check passed");
