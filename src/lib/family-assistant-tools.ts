import { HOME_HERO, HOME_SECTIONS, SITE_PURPOSE } from "@/content/home";
import {
  descendantCount,
  duplicateEffectiveNames,
  effectiveDisplayName,
  lineageChain,
  lineageLabel,
  listBranches,
  maxGeneration,
  personContextLabel,
  recordedParents,
  searchPeople,
  siblingsOf,
  type FamilyGraph,
} from "@/lib/family";
import {
  findRelationship,
  formatRelationshipSentence,
} from "@/lib/relationship-finder";
import { formatRecordDate, personAgeYears } from "@/lib/utils";

export type AssistantToolName =
  | "search_people"
  | "get_person"
  | "find_relationship"
  | "get_lineage"
  | "get_tree_stats"
  | "get_family_history";

export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_people",
      description: "Search people by first name, full name, or display name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name or partial name to search for." },
          limit: { type: "number", description: "Max results (default 10)." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_person",
      description: "Get one person's profile, parents, children, and siblings.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Person name or id." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_relationship",
      description: "Find how two people are related through documented parent-child links.",
      parameters: {
        type: "object",
        properties: {
          person_a: { type: "string", description: "First person's name or id." },
          person_b: { type: "string", description: "Second person's name or id." },
        },
        required: ["person_a", "person_b"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_lineage",
      description: "Get the root-to-person lineage chain for someone.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Person name or id." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_tree_stats",
      description: "Get totals, generation depth, branch list, and duplicate names.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_family_history",
      description: "Get narrative history about Faqih Yonis and the site's purpose.",
      parameters: {
        type: "object",
        properties: {
          section_id: {
            type: "string",
            description: "Optional section id: harar, library, service, mediator, legacy.",
          },
        },
      },
    },
  },
];

type PersonMatch = { id: string; name: string; lineage: string };

function resolvePerson(
  graph: FamilyGraph,
  query: string,
): { ok: true; id: string } | { ok: false; error: string; matches?: PersonMatch[] } {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Empty person query." };
  if (graph.byId.has(trimmed)) return { ok: true, id: trimmed };

  const matches = searchPeople(graph, trimmed, 8);
  if (!matches.length) return { ok: false, error: `No person matched "${trimmed}".` };
  if (matches.length === 1) return { ok: true, id: matches[0]!.id };

  const exact = matches.filter(
    (p) =>
      effectiveDisplayName(graph, p.id).toLowerCase() === trimmed.toLowerCase() ||
      p.first_name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact.length === 1) return { ok: true, id: exact[0]!.id };

  return {
    ok: false,
    error: `Multiple people matched "${trimmed}". Ask the user which one they mean.`,
    matches: matches.map((p) => ({
      id: p.id,
      name: effectiveDisplayName(graph, p.id),
      lineage: lineageLabel(graph, p.id),
    })),
  };
}

function personSummary(graph: FamilyGraph, id: string) {
  const p = graph.byId.get(id);
  if (!p) return null;
  const duplicates = duplicateEffectiveNames(graph);
  return {
    id: p.id,
    name: effectiveDisplayName(graph, p.id),
    display_name: p.display_name,
    gender: p.gender,
    birth_date: p.birth_date,
    birth_date_label: p.birth_date ? formatRecordDate(p.birth_date) : null,
    death_date: p.death_date,
    death_date_label: p.death_date ? formatRecordDate(p.death_date) : null,
    is_deceased: p.is_deceased,
    age_years: personAgeYears(p.birth_date, p.death_date),
    notes: p.notes,
    generation: (graph.depthOf.get(p.id) ?? 0) + 1,
    lineage: lineageLabel(graph, p.id),
    context_label: personContextLabel(graph, p.id, duplicates),
    parents: recordedParents(graph, p.id),
    children: (graph.childrenOf.get(p.id) ?? []).map((cid) => ({
      id: cid,
      name: effectiveDisplayName(graph, cid),
    })),
    siblings: siblingsOf(graph, p.id).map((sid) => ({
      id: sid,
      name: effectiveDisplayName(graph, sid),
    })),
    descendant_count: descendantCount(graph, p.id),
  };
}

export function runAssistantTool(
  graph: FamilyGraph,
  name: AssistantToolName,
  args: Record<string, unknown>,
): unknown {
  switch (name) {
    case "search_people": {
      const query = String(args.query ?? "");
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const people = searchPeople(graph, query, limit);
      const duplicates = duplicateEffectiveNames(graph);
      return {
        query,
        count: people.length,
        results: people.map((p) => ({
          id: p.id,
          name: effectiveDisplayName(graph, p.id),
          lineage: lineageLabel(graph, p.id),
          context_label: personContextLabel(graph, p.id, duplicates),
        })),
      };
    }
    case "get_person": {
      const resolved = resolvePerson(graph, String(args.query ?? ""));
      if (!resolved.ok) return resolved;
      return personSummary(graph, resolved.id);
    }
    case "find_relationship": {
      const a = resolvePerson(graph, String(args.person_a ?? ""));
      if (!a.ok) return { person: "person_a", ...a };
      const b = resolvePerson(graph, String(args.person_b ?? ""));
      if (!b.ok) return { person: "person_b", ...b };
      const result = findRelationship(graph, a.id, b.id);
      return {
        sentence: formatRelationshipSentence(graph, result),
        result,
      };
    }
    case "get_lineage": {
      const resolved = resolvePerson(graph, String(args.query ?? ""));
      if (!resolved.ok) return resolved;
      const chain = lineageChain(graph, resolved.id);
      return {
        person: effectiveDisplayName(graph, resolved.id),
        chain: chain.map((p) => ({
          id: p.id,
          name: effectiveDisplayName(graph, p.id),
          first_name: p.first_name,
        })),
      };
    }
    case "get_tree_stats": {
      const duplicates = duplicateEffectiveNames(graph);
      return {
        total_people: graph.people.length,
        max_generation: maxGeneration(graph),
        roots: graph.roots.map((id) => ({
          id,
          name: effectiveDisplayName(graph, id),
        })),
        branches: listBranches(graph),
        duplicate_names: [...duplicates],
        living_count: graph.people.filter((p) => !p.is_deceased).length,
        deceased_count: graph.people.filter((p) => p.is_deceased).length,
      };
    }
    case "get_family_history": {
      const sectionId = args.section_id ? String(args.section_id) : null;
      if (sectionId) {
        const section = HOME_SECTIONS.find((s) => s.id === sectionId);
        if (!section) {
          return {
            error: `Unknown section "${sectionId}".`,
            available: HOME_SECTIONS.map((s) => s.id),
          };
        }
        return section;
      }
      return {
        hero: HOME_HERO,
        purpose: SITE_PURPOSE,
        sections: HOME_SECTIONS,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
