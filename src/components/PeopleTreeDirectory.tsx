import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { descendantCount, type FamilyGraph } from "@/lib/family";
import { cn } from "@/lib/utils";

const BRANCH_COLORS = [
  "oklch(0.68 0.09 68)",
  "oklch(0.44 0.062 148)",
  "oklch(0.52 0.17 27)",
  "oklch(0.58 0.06 250)",
  "oklch(0.53 0.075 128)",
  "oklch(0.6 0.08 40)",
  "oklch(0.5 0.05 300)",
  "oklch(0.62 0.11 32)",
];

function branchColor(branchKey: string): string {
  let h = 0;
  for (let i = 0; i < branchKey.length; i++) h = (h * 31 + branchKey.charCodeAt(i)) >>> 0;
  return BRANCH_COLORS[h % BRANCH_COLORS.length]!;
}

type Filters = {
  query: string;
  branchId: string;
  gen: number | null;
};

function personMatches(graph: FamilyGraph, id: string, filters: Filters): boolean {
  const person = graph.byId.get(id);
  if (!person) return false;

  const q = filters.query.trim().toLowerCase();
  if (q && !person.display_name.toLowerCase().includes(q)) return false;

  if (filters.branchId) {
    const branch = graph.branchOf.get(id);
    if (id !== filters.branchId && branch !== filters.branchId) return false;
  }

  if (filters.gen !== null) {
    const gen = (graph.depthOf.get(id) ?? 0) + 1;
    if (gen !== filters.gen) return false;
  }

  return true;
}

function computeVisibility(graph: FamilyGraph, filters: Filters) {
  const active = !!filters.query.trim() || !!filters.branchId || filters.gen !== null;
  if (!active) {
    return {
      active: false,
      visible: new Set(graph.people.map((p) => p.id)),
      selfMatch: new Set<string>(),
      matchCount: 0,
    };
  }

  const selfMatch = new Set<string>();
  let matchCount = 0;
  for (const person of graph.people) {
    if (personMatches(graph, person.id, filters)) {
      selfMatch.add(person.id);
      matchCount++;
    }
  }

  const visible = new Set<string>();
  const markVisible = (id: string): boolean => {
    const children = graph.childrenOf.get(id) ?? [];
    let childVisible = false;
    for (const child of children) {
      if (markVisible(child)) childVisible = true;
    }
    const show = selfMatch.has(id) || childVisible;
    if (show) visible.add(id);
    return show;
  };
  for (const root of graph.roots) markVisible(root);

  return { active: true, visible, selfMatch, matchCount };
}

function highlightName(name: string, query: string) {
  const q = query.trim();
  if (!q) return name;
  const lower = name.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded-sm bg-destructive/20 px-0.5 text-destructive">
        {name.slice(idx, idx + q.length)}
      </mark>
      {name.slice(idx + q.length)}
    </>
  );
}

function TreeNode({
  graph,
  id,
  expanded,
  onToggle,
  visible,
  selfMatch,
  query,
}: {
  graph: FamilyGraph;
  id: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  visible: Set<string>;
  selfMatch: Set<string>;
  query: string;
}) {
  if (!visible.has(id)) return null;

  const person = graph.byId.get(id);
  if (!person) return null;

  const children = graph.childrenOf.get(id) ?? [];
  const hasKids = children.length > 0;
  const isExpanded = expanded.has(id);
  const gen = (graph.depthOf.get(id) ?? 0) + 1;
  const branchKey = graph.branchOf.get(id) ?? person.display_name;
  const desc = descendantCount(graph, id);

  return (
    <li className={cn(!hasKids && "list-none")}>
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg py-1.5 pl-1 pr-2",
          hasKids && "cursor-pointer hover:bg-accent/40",
          selfMatch.has(id) && "bg-secondary/50",
        )}
        onClick={hasKids ? () => onToggle(id) : undefined}
      >
        <button
          type="button"
          aria-label={hasKids ? (isExpanded ? "Collapse branch" : "Expand branch") : undefined}
          onClick={hasKids ? () => onToggle(id) : undefined}
          className={cn(
            "flex size-[18px] shrink-0 items-center justify-center rounded-md border border-border text-[10px] text-muted-foreground transition-colors",
            !hasKids && "size-1.5 rounded-full border-transparent bg-border",
            hasKids && isExpanded && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {hasKids && (
            <ChevronRight
              className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
            />
          )}
        </button>

        <Link
          to="/"
          search={{ person: id }}
          className="font-display text-base font-medium leading-tight hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {selfMatch.has(id) ? highlightName(person.display_name, query) : person.display_name}
        </Link>

        <span
          className="rounded-full px-1.5 py-px text-[10px] font-bold tracking-wide text-white"
          style={{ backgroundColor: branchColor(branchKey) }}
        >
          G{gen}
        </span>

        {hasKids && (
          <span className="rounded-full bg-secondary px-2 py-px text-[11px] font-semibold text-muted-foreground">
            {desc} {desc === 1 ? "descendant" : "descendants"}
          </span>
        )}

        {person.notes && (
          <span className="text-[11px] italic text-muted-foreground">{person.notes}</span>
        )}
      </div>

      {hasKids && isExpanded && (
        <ul className="ml-[17px] list-none border-l-[1.5px] border-border pl-[17px]">
          {children.map((childId) => (
            <TreeNode
              key={childId}
              graph={graph}
              id={childId}
              expanded={expanded}
              onToggle={onToggle}
              visible={visible}
              selfMatch={selfMatch}
              query={query}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PeopleTreeDirectory({
  graph,
  isLoading,
}: {
  graph?: FamilyGraph | undefined;
  isLoading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("");
  const [gen, setGen] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const branches = useMemo(() => {
    if (!graph) return [];
    const ids = new Set<string>();
    for (const b of graph.branchOf.values()) if (b) ids.add(b);
    return [...ids]
      .map((id) => ({ id, name: graph.byId.get(id)?.display_name ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [graph]);

  const maxGen = useMemo(() => {
    if (!graph?.people.length) return 0;
    return Math.max(...graph.people.map((p) => (graph.depthOf.get(p.id) ?? 0) + 1));
  }, [graph]);

  const { active, visible, selfMatch, matchCount } = useMemo(
    () =>
      graph
        ? computeVisibility(graph, { query, branchId, gen })
        : {
            active: false,
            visible: new Set<string>(),
            selfMatch: new Set<string>(),
            matchCount: 0,
          },
    [graph, query, branchId, gen],
  );

  const rootId = graph?.roots[0] ?? null;

  useEffect(() => {
    if (!graph || !rootId) return;
    setExpanded(new Set([rootId, ...(graph.childrenOf.get(rootId) ?? [])]));
  }, [graph, rootId]);

  useEffect(() => {
    if (!active || !graph) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of visible) next.add(id);
      return next;
    });
  }, [active, visible, graph]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!graph) return;
    const all = new Set<string>();
    for (const person of graph.people) {
      if ((graph.childrenOf.get(person.id)?.length ?? 0) > 0) all.add(person.id);
    }
    setExpanded(all);
  };

  const collapseAll = () => {
    if (!graph || !rootId) return;
    setExpanded(new Set([rootId, ...(graph.childrenOf.get(rootId) ?? [])]));
  };

  const clearFilters = () => {
    setQuery("");
    setBranchId("");
    setGen(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">People</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the family as an expandable directory — click a name to open their profile in the
            tree.
          </p>
        </div>
        {graph && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <strong className="text-foreground">{graph.people.length}</strong> people
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <strong className="text-foreground">{maxGen}</strong> generations
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <strong className="text-foreground">{branches.length}</strong> branches
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a name…"
            className="pl-9"
          />
        </div>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto",
            branchId && "border-primary bg-secondary/40",
          )}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}&apos;s branch
            </option>
          ))}
        </select>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          {active && (
            <span className="shrink-0 text-xs text-muted-foreground sm:min-w-[5rem] sm:text-right">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={expandAll}
          >
            Expand all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={collapseAll}
          >
            Collapse
          </Button>
          {(query || branchId || gen !== null) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button
          type="button"
          onClick={() => setGen(null)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            gen === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/50",
          )}
        >
          All generations
        </button>
        {Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGen(g)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              gen === g
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50",
            )}
          >
            G{g}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading the family record…
        </p>
      )}

      {graph && rootId && (
        <div className="mt-5 rounded-2xl border border-border bg-card/80 p-4 leaf-shadow sm:p-5">
          <ul className="list-none p-0">
            <TreeNode
              graph={graph}
              id={rootId}
              expanded={expanded}
              onToggle={toggle}
              visible={visible}
              selfMatch={selfMatch}
              query={query}
            />
          </ul>
        </div>
      )}
    </>
  );
}
