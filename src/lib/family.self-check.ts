import { effectiveDisplayName } from "./patronymic-name.ts";
import type { FamilyGraph, Link, Person } from "./family.ts";

function person(
  id: string,
  first: string,
  opts: {
    gender?: string | null;
    middle?: string | null;
    last?: string | null;
    display_name?: string;
  } = {},
): Person {
  const display_name =
    opts.display_name ?? [first, opts.middle, opts.last].filter(Boolean).join(" ");
  return {
    id,
    first_name: first,
    middle_name: opts.middle ?? null,
    last_name: opts.last ?? null,
    display_name,
    gender: opts.gender ?? null,
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

/** ponytail: minimal graph builder — avoids pulling supabase via family.ts */
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
  const canonicalRoot = roots.find((id) => byId.get(id)?.display_name === "Yonis") ?? roots[0] ?? null;
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
  for (const p of people) if (!depthOf.has(p.id)) depthOf.set(p.id, 0);

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

function expectName(label: string, graph: FamilyGraph, id: string, expected: string) {
  const got = effectiveDisplayName(graph, id);
  if (got !== expected) {
    throw new Error(`[${label}] expected "${expected}", got "${got}"`);
  }
}

// --- Scenario 1: classic 3-part patronymic (Abdulhamid Teweleda Abdosh) ---
const abdulhamidLine = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed", "Ahmed", { gender: "male" }),
    person("abdosh", "Abdosh", { gender: "male" }),
    person("teweleda", "Teweleda", { gender: "male" }),
    person("abdulhamid", "Abdulhamid", { gender: "male" }),
  ],
  [
    link("yonis", "ahmed"),
    link("ahmed", "abdosh"),
    link("abdosh", "teweleda"),
    link("teweleda", "abdulhamid"),
  ],
);
expectName("male with father + grandfather in root tree", abdulhamidLine, "abdulhamid", "Abdulhamid Teweleda Abdosh");
expectName("father also gets patronymic", abdulhamidLine, "teweleda", "Teweleda Abdosh Ahmed");
expectName("root ancestor keeps given name only", abdulhamidLine, "yonis", "Yonis");

// --- Scenario 2: male with only father (no grandfather) → stored name ---
const ahmedOnly = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed", "Ahmed", { gender: "male", display_name: "Ahmed Yonis" }),
  ],
  [link("yonis", "ahmed")],
);
expectName("male missing grandfather falls back to stored", ahmedOnly, "ahmed", "Ahmed Yonis");

// --- Scenario 3: female takes her father's and grandfather's names ---
const fatuma = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed", "Ahmed", { gender: "male" }),
    person("abdosh", "Abdosh", { gender: "male" }),
    person("fatuma", "Fatuma", {
      gender: "female",
    }),
    person("daughter", "Hana", { gender: "female", display_name: "Hana Musa Ali" }),
  ],
  [
    link("yonis", "ahmed"),
    link("ahmed", "abdosh"),
    link("abdosh", "fatuma"),
    link("fatuma", "daughter"),
  ],
);
expectName("female uses her paternal chain", fatuma, "fatuma", "Fatuma Abdosh Ahmed");
expectName("child does not inherit through mother", fatuma, "daughter", "Hana Musa Ali");

// --- Scenario 4: father not in root tree → manual name ---
const marriedIn = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed", "Ahmed", { gender: "male" }),
    person("abdosh", "Abdosh", { gender: "male" }),
    person("wife", "Muna", { gender: "female" }),
    person("outsider-father", "Khalid", { gender: "male" }),
    person("son", "Yusuf", {
      gender: "male",
      display_name: "Yusuf Khalid Ibrahim",
      middle: "Khalid",
      last: "Ibrahim",
    }),
  ],
  [
    link("yonis", "ahmed"),
    link("ahmed", "abdosh"),
    link("abdosh", "wife"),
    link("outsider-father", "son"),
    link("wife", "son"),
  ],
);
expectName("male with father outside root tree keeps manual name", marriedIn, "son", "Yusuf Khalid Ibrahim");

// --- Scenario 5: duplicate given names disambiguated by patronymic ---
const twoAhmeds = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed1", "Ahmed", { gender: "male" }),
    person("khedra", "Khedra", { gender: "male" }),
    person("ahmed2", "Ahmed", { gender: "male" }),
    person("fatuma", "Fatuma", { gender: "male" }),
    person("abdulrahman", "Abdulrahman", { gender: "male" }),
    person("tofik", "Tofik", { gender: "male" }),
    person("ahmed3", "Ahmed", { gender: "male" }),
  ],
  [
    link("yonis", "ahmed1"),
    link("ahmed1", "khedra"),
    link("khedra", "ahmed2"),
    link("ahmed1", "fatuma"),
    link("fatuma", "abdulrahman"),
    link("khedra", "tofik"),
    link("tofik", "ahmed3"),
  ],
);
expectName("Ahmed under Khedra", twoAhmeds, "ahmed2", "Ahmed Khedra Ahmed");
expectName("Ahmed under Tofik", twoAhmeds, "ahmed3", "Ahmed Tofik Khedra");

// --- Scenario 6: no father recorded (mother-only link) → manual ---
const motherOnly = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed", "Ahmed", { gender: "male" }),
    person("abdosh", "Abdosh", { gender: "male" }),
    person("mother", "Rewda", { gender: "female" }),
    person("child", "Hamdi", {
      gender: "male",
      display_name: "Hamdi Musa Ali",
      middle: "Musa",
      last: "Ali",
    }),
  ],
  [link("yonis", "ahmed"), link("ahmed", "abdosh"), link("abdosh", "mother"), link("mother", "child")],
);
expectName("male with no father recorded keeps manual name", motherOnly, "child", "Hamdi Musa Ali");

// --- Scenario 7: two parents — paternal line toward root wins ---
const twoParents = testGraph(
  [
    person("yonis", "Yonis", { gender: "male" }),
    person("ahmed", "Ahmed", { gender: "male" }),
    person("abdosh", "Abdosh", { gender: "male" }),
    person("teweleda", "Teweleda", { gender: "male" }),
    person("mother", "Rewda", { gender: "female" }),
    person("child", "Amar", { gender: "male" }),
  ],
  [
    link("yonis", "ahmed"),
    link("ahmed", "abdosh"),
    link("abdosh", "teweleda"),
    link("abdosh", "mother"),
    link("teweleda", "child"),
    link("mother", "child"),
  ],
);
expectName("two parents uses father toward root", twoParents, "child", "Amar Teweleda Abdosh");

const orderGraph = testGraph(
  [person("p", "Parent"), person("a", "A"), person("b", "B"), person("c", "C")],
  [link("p", "a"), link("p", "b"), link("p", "c")],
);
// ponytail: mirror birthOrderAmongSiblings — keep self-check free of supabase import
function birthOrderLocal(g: FamilyGraph, id: string): number | null {
  const parentId = g.parentsOf.get(id)?.[0];
  if (!parentId) return null;
  const idx = (g.childrenOf.get(parentId) ?? []).indexOf(id);
  return idx >= 0 ? idx + 1 : null;
}
console.assert(birthOrderLocal(orderGraph, "a") === 1, "first sibling order");
console.assert(birthOrderLocal(orderGraph, "c") === 3, "third sibling order");
console.assert(birthOrderLocal(orderGraph, "p") === null, "root has no sibling order");

console.log("family.self-check: all patronymic scenarios passed");
