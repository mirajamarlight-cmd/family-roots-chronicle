import { buildGraph, type Link, type Person } from "./family.ts";
import { computeFamilyStatistics } from "./family-statistics.ts";

function person(id: string, opts: Partial<Person> = {}): Person {
  return {
    id,
    first_name: id,
    middle_name: null,
    last_name: null,
    display_name: id,
    gender: null,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    photo_url: null,
    notes: null,
    ...opts,
  };
}

function link(parent_id: string, child_id: string): Link {
  return { id: `${parent_id}-${child_id}`, parent_id, child_id, relationship_type: "biological", child_order: null };
}

const graph = buildGraph(
  [
    person("y", { display_name: "Yonis", gender: "male", birth_date: "1920-01-01" }),
    person("a", { gender: "male", birth_date: "1950-03-01" }),
    person("b", { gender: "female", death_date: "2020-01-01", is_deceased: true }),
    person("c", { gender: "male", birth_date: "1980-06-15" }),
  ],
  [link("y", "a"), link("a", "b"), link("a", "c")],
  [],
);

const stats = computeFamilyStatistics(graph);
if (stats.total !== 4) throw new Error(`expected 4 people, got ${stats.total}`);
if (stats.living !== 3) throw new Error(`expected 3 living, got ${stats.living}`);
if (stats.deceased !== 1) throw new Error(`expected 1 deceased, got ${stats.deceased}`);
if (stats.topParents[0]?.childCount !== 2) throw new Error("expected parent with 2 children");
if (stats.byGeneration.length !== 3) throw new Error(`expected 3 generations, got ${stats.byGeneration.length}`);

console.log("family-statistics.self-check: ok");
