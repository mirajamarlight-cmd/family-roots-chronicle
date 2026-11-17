import { buildGraph, type Link, type Marriage, type Person } from "./family.ts";
import { layoutFamilyCanvas, neighborhood, TREE_NODE_W } from "./tree-graph.ts";

function person(id: string, first: string, gender: string | null = "male"): Person {
  return {
    id,
    first_name: first,
    middle_name: null,
    last_name: null,
    display_name: first,
    gender,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    photo_url: null,
    notes: null,
  };
}

function link(parent_id: string, child_id: string, child_order: number): Link {
  return {
    id: `${parent_id}-${child_id}`,
    parent_id,
    child_id,
    relationship_type: "biological",
    child_order,
  };
}

function marriage(a: string, b: string): Marriage {
  return { id: `${a}-${b}`, person1_id: a, person2_id: b, marriage_date: null, notes: null };
}

function assert(label: string, ok: boolean) {
  if (!ok) throw new Error(label);
}

const graph = buildGraph(
  [
    person("yonis", "Yonis"),
    person("ahmed", "Ahmed"),
    person("bekri", "Bekri"),
    person("abdosh", "Abdosh"),
    person("sara", "Sara", "female"),
    person("melika", "Melika", "female"),
    person("muna", "Muna", "female"),
    person("khadra", "Khadra", "female"),
    person("musa", "Musa"),
  ],
  [
    link("yonis", "ahmed", 1),
    link("ahmed", "bekri", 1),
    link("ahmed", "abdosh", 2),
    link("abdosh", "khadra", 1),
    link("melika", "khadra", 1),
    link("abdosh", "musa", 2),
    link("melika", "musa", 2),
  ],
  [marriage("abdosh", "melika"), marriage("abdosh", "muna"), marriage("bekri", "sara")],
);

const near = neighborhood(graph, "abdosh", 1);
for (const id of ["abdosh", "ahmed", "bekri", "melika", "muna", "khadra", "musa"]) {
  assert(`hop 1 includes ${id}`, near.has(id));
}
assert("hop 1 stops before the grandparent", !near.has("yonis"));
assert("hop 1 stops before a sibling's spouse", !near.has("sara"));
assert("hop 2 reaches the grandparent", neighborhood(graph, "abdosh", 2).has("yonis"));
assert("hop 2 reaches a sibling's spouse", neighborhood(graph, "abdosh", 2).has("sara"));

const all = new Set(["yonis", "ahmed", "bekri", "abdosh"]);
const laid = layoutFamilyCanvas({
  graph,
  rootId: "yonis",
  expanded: all,
  depth: "all",
  focusId: null,
});
const at = new Map(laid.nodes.map((n) => [n.id, n]));
const abdosh = at.get("abdosh")!;
const melika = at.get("melika")!;
const muna = at.get("muna")!;
const bekri = at.get("bekri")!;
const khadra = at.get("khadra")!;
const musa = at.get("musa")!;

assert("wives sit on Abdosh's row", melika.y === abdosh.y && muna.y === abdosh.y);
assert("wives sit to the right, in marriage order", abdosh.x < melika.x && melika.x < muna.x);
assert("older brother stays left", bekri.x + TREE_NODE_W <= abdosh.x);
assert("children sit below", khadra.y > abdosh.y && musa.y === khadra.y && khadra.x < musa.x);

const coupleLeft = abdosh.x;
const coupleRight = muna.x + TREE_NODE_W;
const kidsMid = (khadra.x + musa.x + TREE_NODE_W) / 2;
const coupleMid = (coupleLeft + coupleRight) / 2;
assert("children center under the couple", Math.abs(kidsMid - coupleMid) < 1.5);

for (let i = 0; i < laid.nodes.length; i++) {
  for (let j = i + 1; j < laid.nodes.length; j++) {
    const a = laid.nodes[i]!;
    const b = laid.nodes[j]!;
    if (a.y !== b.y) continue;
    const hit = a.x < b.x + TREE_NODE_W && b.x < a.x + TREE_NODE_W;
    assert(`overlap ${a.id} ${b.id}`, !hit);
  }
}

const local = layoutFamilyCanvas({
  graph,
  rootId: "yonis",
  expanded: all,
  depth: 1,
  focusId: "abdosh",
});
const localIds = new Set(local.nodes.map((n) => n.id));
assert("depth 1 drops Yonis", !localIds.has("yonis"));
assert("depth 1 keeps the wives", localIds.has("melika") && localIds.has("muna"));
assert(
  "spouse line exists",
  laid.edges.some((e) => e.kind === "spouse" && e.source === "abdosh" && e.target === "melika"),
);

const collapsed = layoutFamilyCanvas({
  graph,
  rootId: "yonis",
  expanded: new Set(["yonis", "ahmed"]),
  depth: "all",
  focusId: null,
});
assert(
  "collapsed branch hides children but keeps the wife",
  !collapsed.nodes.some((n) => n.id === "khadra") && collapsed.nodes.some((n) => n.id === "melika"),
);

console.log("tree-graph self-check ok");
