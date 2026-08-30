import { Maximize2, Minimize2, Plus, Search, SlidersHorizontal, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccessibleFamilyTree } from "@/components/AccessibleFamilyTree";
import { BranchPicker } from "@/components/BranchPicker";
import { GenerationPills } from "@/components/GenerationPills";
import { TreePersonSearch } from "@/components/TreePersonSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  canonicalRootId,
  collectSubtreeIds,
  effectiveDisplayName,
  listBranches,
  maxGeneration,
  type FamilyGraph,
} from "@/lib/family";
import { ancestorsOnlyToExpand, computeVisibility } from "@/lib/tree-filters";
import { cn } from "@/lib/utils";

const chip =
  "shrink-0 rounded-full border border-border bg-card/90 backdrop-blur transition-colors";

function adminDefaultExpanded(graph: FamilyGraph, rootId: string): Set<string> {
  const next = new Set([rootId]);
  for (const id of graph.childrenOf.get(rootId) ?? []) next.add(id);
  return next;
}

type Props = {
  graph: FamilyGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddPerson: () => void;
  addPersonLabel: string;
};

export function AdminPeopleTree({
  graph,
  selectedId,
  onSelect,
  onAddChild,
  onAddPerson,
  addPersonLabel,
}: Props) {
  const isMobile = useIsMobile();
  const rootId = canonicalRootId(graph);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    rootId ? adminDefaultExpanded(graph, rootId) : new Set(),
  );
  const [focusedId, setFocusedId] = useState<string | null>(selectedId ?? rootId);
  const [gen, setGen] = useState<number | null>(null);
  const [branchId, setBranchId] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);

  const maxGen = maxGeneration(graph);
  const branches = useMemo(() => listBranches(graph), [graph]);

  const extraRoots = useMemo(() => {
    if (!rootId) return graph.roots;
    const main = collectSubtreeIds(graph, rootId);
    return graph.roots.filter((id) => !main.has(id));
  }, [graph, rootId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(listQuery), 200);
    return () => clearTimeout(t);
  }, [listQuery]);

  const filterVisibility = useMemo(
    () => computeVisibility(graph, { query: debouncedQuery, branchId, gen }),
    [graph, debouncedQuery, branchId, gen],
  );

  const matchKey = useMemo(
    () => [...filterVisibility.selfMatch].sort().join(","),
    [filterVisibility.selfMatch],
  );

  useEffect(() => {
    if (!filterVisibility.active) return;
    const next: string[] = [];
    for (const r of [rootId, ...extraRoots]) {
      if (r) next.push(...ancestorsOnlyToExpand(graph, r, filterVisibility.selfMatch));
    }
    setExpanded((prev) => {
      const merged = new Set([...prev, ...next]);
      for (const id of filterVisibility.selfMatch) merged.delete(id);
      return merged;
    });
  }, [graph, rootId, extraRoots, filterVisibility.active, filterVisibility.selfMatch, matchKey]);

  useEffect(() => {
    if (!selectedId) return;
    const roots = [rootId, ...extraRoots].filter((id): id is string => !!id);
    const next: string[] = [];
    for (const r of roots) next.push(...ancestorsOnlyToExpand(graph, r, [selectedId]));
    setExpanded((prev) => new Set([...prev, ...next]));
  }, [graph, rootId, extraRoots, selectedId]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    for (const r of [rootId, ...extraRoots]) {
      if (r) for (const id of collectSubtreeIds(graph, r)) all.add(id);
    }
    setExpanded(all);
  }, [graph, rootId, extraRoots]);

  const collapse = useCallback(() => {
    if (!rootId) return;
    setExpanded(adminDefaultExpanded(graph, rootId));
  }, [graph, rootId]);

  const clearFilters = useCallback(() => {
    setGen(null);
    setBranchId("");
    setListQuery("");
    setDebouncedQuery("");
  }, []);

  const focusPerson = useCallback(
    (id: string) => {
      const roots = [rootId, ...extraRoots].filter((id): id is string => !!id);
      const next: string[] = [];
      for (const r of roots) next.push(...ancestorsOnlyToExpand(graph, r, [id]));
      setExpanded((prev) => new Set([...prev, ...next]));
      setFocusedId(id);
      onSelect(id);
    },
    [graph, rootId, extraRoots, onSelect],
  );

  const listVisible = useMemo(() => {
    if (!filterVisibility.active) return new Set(graph.people.map((p) => p.id));
    return filterVisibility.visible;
  }, [graph, filterVisibility]);

  const rowActions = useCallback(
    (id: string) => (
      <Button
        size="icon"
        variant="outline"
        className="size-7 rounded-full opacity-70 hover:opacity-100"
        aria-label="Add child"
        onClick={() => onAddChild(id)}
      >
        <UserPlus className="size-3.5" />
      </Button>
    ),
    [onAddChild],
  );

  const treeProps = {
    graph,
    expanded,
    onToggle: toggle,
    visible: listVisible,
    selfMatch: filterVisibility.selfMatch,
    selectedId,
    focusedId: focusedId ?? rootId,
    query: debouncedQuery,
    onSelect,
    onFocusId: setFocusedId,
    showMeta: true as const,
    renderEnd: rowActions,
  };

  const extraVisible = extraRoots.filter((id) => listVisible.has(id));
  const isEmpty = filterVisibility.active && filterVisibility.matchCount === 0;
  const filtersActive = filterVisibility.active;

  const expandCollapseButtons = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className={cn(chip, "text-xs")} onClick={expandAll}>
        <Maximize2 className="size-3.5" /> Expand all
      </Button>
      <Button size="sm" variant="outline" className={cn(chip, "text-xs")} onClick={collapse}>
        <Minimize2 className="size-3.5" /> Collapse
      </Button>
    </div>
  );

  const filterMeta = filtersActive && (
    <>
      <span className="shrink-0 text-xs text-muted-foreground">
        {filterVisibility.matchCount}{" "}
        {filterVisibility.matchCount === 1 ? "match" : "matches"}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={clearFilters}
      >
        Clear filters
      </Button>
    </>
  );

  const optionsBody = (
    <div className="space-y-4">
      {expandCollapseButtons}
      {branches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Branch</p>
          <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
        </div>
      )}
      {filtersActive && (
        <Button size="sm" variant="outline" className="w-full rounded-full text-xs" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );

  if (!rootId) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="font-display text-base font-semibold">No people yet</p>
        <p className="mt-2 text-sm text-muted-foreground">Use the + button in the toolbar to add someone.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-2 p-2 sm:p-3">
      <div className={cn("sticky top-0 z-20 space-y-2 bg-muted/10 pb-2 pt-1 backdrop-blur sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card/80 sm:p-3 sm:shadow-sm")}>
      <div className="flex items-center gap-2 sm:hidden">
        <TreePersonSearch graph={graph} onSelectPerson={focusPerson} placeholder="Find someone…" />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={addPersonLabel}
          className="size-9 shrink-0 rounded-full"
          onClick={onAddPerson}
        >
          <Plus className="size-4" />
        </Button>
        <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Tree options"
              className="size-9 shrink-0 rounded-full"
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Tree options</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{optionsBody}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <TreePersonSearch
          graph={graph}
          onSelectPerson={focusPerson}
          className="max-w-xs"
          placeholder="Find someone…"
        />
        {branches.length > 0 && (
          <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
        )}
        {filterMeta}
        <Button size="sm" className={cn(chip, "text-xs")} onClick={onAddPerson}>
          <Plus className="size-3.5" aria-hidden />
          {addPersonLabel}
        </Button>
        <div className="ml-auto">{expandCollapseButtons}</div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
        <GenerationPills maxGen={maxGen} gen={gen} onGenChange={setGen} />
        {isMobile && filterMeta}
      </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 leaf-shadow sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          <div className="relative min-w-[140px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Filter names in this list…"
              aria-label="Filter list by name"
              className="rounded-full pl-9"
            />
          </div>
        </div>

        {isEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No one matches your filters. Try clearing them, choosing a different generation, or
            picking another branch.
          </p>
        ) : (
          <>
            <AccessibleFamilyTree
              {...treeProps}
              rootId={rootId}
              ariaLabel="Family list for editing"
            />
            {extraVisible.length > 0 && (
              <div className="mt-6 border-t border-border/60 pt-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Not in the main tree
                </p>
                {extraVisible.map((id) => (
                  <AccessibleFamilyTree
                    key={id}
                    {...treeProps}
                    rootId={id}
                    ariaLabel={`Unlinked family starting at ${effectiveDisplayName(graph, id)}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
