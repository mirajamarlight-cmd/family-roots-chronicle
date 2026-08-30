import {
  collectSubtreeIds,
  descendantCount,
  effectiveDisplayName,
  maxGeneration,
  personIsDeceased,
  type FamilyGraph,
} from "./family.ts";
import { personAgeYears } from "./utils.ts";

export type GenerationStat = {
  depth: number;
  count: number;
  living: number;
  deceased: number;
};

export type BranchStat = {
  id: string;
  name: string;
  size: number;
  living: number;
  deceased: number;
};

export type ParentStat = {
  id: string;
  name: string;
  childCount: number;
};

export type DecadeStat = {
  label: string;
  count: number;
};

export type AgeHighlight = {
  id: string;
  name: string;
  age: number;
};

export type FamilyStatistics = {
  total: number;
  living: number;
  deceased: number;
  generations: number;
  maxDepth: number;
  branchCount: number;
  linkCount: number;
  separateRoots: number;
  gender: { male: number; female: number; unknown: number };
  records: {
    birthDate: number;
    photo: number;
    notes: number;
    genderSet: number;
  };
  byGeneration: GenerationStat[];
  branches: BranchStat[];
  topParents: ParentStat[];
  birthDecades: DecadeStat[];
  oldestLiving: AgeHighlight | null;
  youngestLiving: AgeHighlight | null;
};

function genderBucket(g: string | null): keyof FamilyStatistics["gender"] {
  const v = (g ?? "").trim().toLowerCase();
  if (v === "male") return "male";
  if (v === "female") return "female";
  return "unknown";
}

function countLivingDeceased(graph: FamilyGraph, ids: Iterable<string>) {
  let living = 0;
  let deceased = 0;
  for (const id of ids) {
    const p = graph.byId.get(id);
    if (!p) continue;
    if (personIsDeceased(p)) deceased++;
    else living++;
  }
  return { living, deceased };
}

export function computeFamilyStatistics(graph: FamilyGraph): FamilyStatistics {
  const gender = { male: 0, female: 0, unknown: 0 };
  const records = { birthDate: 0, photo: 0, notes: 0, genderSet: 0 };
  const byGen = new Map<number, GenerationStat>();
  const decadeCounts = new Map<number, number>();
  const livingAges: AgeHighlight[] = [];

  for (const p of graph.people) {
    gender[genderBucket(p.gender)]++;
    if (p.birth_date) records.birthDate++;
    if (p.photo_url) records.photo++;
    if (p.notes?.trim()) records.notes++;
    if (p.gender?.trim()) records.genderSet++;

    const depth = graph.depthOf.get(p.id) ?? 0;
    const row = byGen.get(depth) ?? { depth, count: 0, living: 0, deceased: 0 };
    row.count++;
    if (personIsDeceased(p)) row.deceased++;
    else row.living++;
    byGen.set(depth, row);

    if (p.birth_date) {
      const year = Number(/^(\d{4})/.exec(p.birth_date)?.[1]);
      if (year >= 1800 && year <= 2100) {
        const decade = Math.floor(year / 10) * 10;
        decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
      }
    }

    if (!personIsDeceased(p) && p.birth_date) {
      const age = personAgeYears(p.birth_date, null);
      if (age !== null) {
        livingAges.push({ id: p.id, name: effectiveDisplayName(graph, p.id), age });
      }
    }
  }

  const branchIds = new Set<string>();
  for (const b of graph.branchOf.values()) if (b) branchIds.add(b);

  const branches: BranchStat[] = [...branchIds]
    .map((id) => {
      const ids = collectSubtreeIds(graph, id);
      const { living, deceased } = countLivingDeceased(graph, ids);
      return {
        id,
        name: effectiveDisplayName(graph, id),
        size: ids.size,
        living,
        deceased,
      };
    })
    .sort((a, b) => b.size - a.size);

  const topParents: ParentStat[] = graph.people
    .map((p) => ({
      id: p.id,
      name: effectiveDisplayName(graph, p.id),
      childCount: graph.childrenOf.get(p.id)?.length ?? 0,
    }))
    .filter((p) => p.childCount > 0)
    .sort((a, b) => b.childCount - a.childCount || a.name.localeCompare(b.name))
    .slice(0, 8);

  const mainRoot = graph.roots.find((id) => graph.byId.get(id)?.display_name === "Yonis") ?? graph.roots[0];
  const mainTree = mainRoot ? collectSubtreeIds(graph, mainRoot) : new Set<string>();
  const separateRoots = graph.roots.filter((id) => !mainTree.has(id)).length;

  livingAges.sort((a, b) => b.age - a.age);

  let living = 0;
  let deceased = 0;
  for (const p of graph.people) {
    if (personIsDeceased(p)) deceased++;
    else living++;
  }

  return {
    total: graph.people.length,
    living,
    deceased,
    generations: maxGeneration(graph),
    maxDepth: maxGeneration(graph),
    branchCount: branchIds.size,
    linkCount: graph.links.length,
    separateRoots,
    gender,
    records,
    byGeneration: [...byGen.values()].sort((a, b) => a.depth - b.depth),
    branches,
    topParents,
    birthDecades: [...decadeCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, count]) => ({ label: `${decade}s`, count })),
    oldestLiving: livingAges[0] ?? null,
    youngestLiving: livingAges.at(-1) ?? null,
  };
}
