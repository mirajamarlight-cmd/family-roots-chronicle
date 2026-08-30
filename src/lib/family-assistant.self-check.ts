import { buildGraph, type Link, type Person } from "./family.ts";
import { runAssistantTool } from "./family-assistant-tools.ts";

function person(id: string, first: string, display_name?: string): Person {
  return {
    id,
    first_name: first,
    middle_name: null,
    last_name: null,
    display_name: display_name ?? first,
    gender: null,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    photo_url: null,
    notes: null,
  };
}

function link(parent_id: string, child_id: string): Link {
  return {
    id: `${parent_id}-${child_id}`,
    parent_id,
    child_id,
    relationship_type: "biological",
    child_order: null,
  };
}

const graph = buildGraph(
  [person("y", "Yonis"), person("a", "Ahmed"), person("k", "Khedra"), person("h", "Hamdi")],
  [link("y", "a"), link("a", "k"), link("k", "h")],
  [],
);

const search = runAssistantTool(graph, "search_people", { query: "Hamdi" }) as {
  count: number;
  results: Array<{ name: string }>;
};
if (search.count < 1 || !search.results[0]?.name.includes("Hamdi")) {
  throw new Error("search_people failed");
}

const rel = runAssistantTool(graph, "find_relationship", {
  person_a: "Yonis",
  person_b: "Hamdi",
}) as { sentence: string };
if (!rel.sentence.includes("grandparent")) throw new Error("find_relationship failed");

const stats = runAssistantTool(graph, "get_tree_stats", {}) as { total_people: number };
if (stats.total_people !== 4) throw new Error("get_tree_stats failed");

const history = runAssistantTool(graph, "get_family_history", {}) as { sections: unknown[] };
if (!history.sections?.length) throw new Error("get_family_history failed");

console.log("family-assistant self-check passed");
