import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { PersonPanel } from "@/components/PersonPanel";
import { FamilyTreeCanvas } from "@/components/FamilyTreeCanvas";
import { TreeBreadcrumbs } from "@/components/TreeBreadcrumbs";
import { TreeToolbar } from "@/components/TreeToolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFamilyGraph } from "@/hooks/useFamily";
import { ancestryPath, pathWithinRoot } from "@/lib/family";
import { ancestorsToExpand, computeVisibility } from "@/lib/tree-filters";
import { defaultExpanded, loadTreeState, saveTreeState } from "@/lib/tree-state";

const searchSchema = z.object({
  person: z.string().optional(),
  root: z.string().optional(),
});

const EXPAND_ALL_THRESHOLD = 200;

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Family Tree — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content:
          "Explore the documented family tree of Yonis and Ahmed: navigate generations, expand branches and open any relative's profile.",
      },
      { property: "og:title", content: "Family Tree — Yonis & Ahmed Family Record" },
      {
        property: "og:description",
        content: "An interactive, private record of the Yonis and Ahmed family across generations.",
      },
    ],
  }),
  component: TreePage,
});

function TreePage() {
  const { person: personParam, root: rootParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data: graph, isLoading, error } = useFamilyGraph();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [gen, setGen] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [expandConfirmOpen, setExpandConfirmOpen] = useState(false);
  const [pendingExpandCount, setPendingExpandCount] = useState(0);
  const hydratedRoot = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const rootId = useMemo(() => {
    if (!graph) return null;
    if (rootParam && graph.byId.has(rootParam)) return rootParam;
    return graph.roots[0] ?? null;
  }, [graph, rootParam]);

  // Single init: URL person wins over localStorage, else restore saved or default.
  useEffect(() => {
    if (!graph || !rootId) return;
    if (hydratedRoot.current === rootId) return;

    if (personParam && graph.byId.has(personParam)) {
      const path = ancestryPath(graph, personParam).map((p) => p.id);
      setExpanded(new Set([...defaultExpanded(graph, rootId), ...path, personParam]));
      setSelected(personParam);
      setFocusedNodeId(personParam);
    } else {
      const saved = loadTreeState(graph, rootId);
      if (saved) {
        setExpanded(new Set(saved.expanded));
        setSelected(saved.selected);
        setFocusedNodeId(saved.selected);
      } else {
        setExpanded(defaultExpanded(graph, rootId));
        setSelected(null);
        setFocusedNodeId(null);
      }
    }
    hydratedRoot.current = rootId;
  }, [graph, rootId, personParam]);

  useEffect(() => {
    hydratedRoot.current = null;
  }, [rootParam]);

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

  const filterVisibility = useMemo(
    () =>
      graph
        ? computeVisibility(graph, { query: debouncedQuery, branchId: "", gen })
        : {
            active: false,
            visible: new Set<string>(),
            selfMatch: new Set<string>(),
            matchCount: 0,
          },
    [graph, debouncedQuery, gen],
  );

  const matchKey = useMemo(
    () => [...filterVisibility.selfMatch].sort().join(","),
    [filterVisibility.selfMatch],
  );

  useEffect(() => {
    if (!graph || !rootId || !filterVisibility.active) return;
    const toExpand = ancestorsToExpand(graph, rootId, filterVisibility.selfMatch);
    setExpanded((prev) => new Set([...prev, ...toExpand]));
  }, [graph, rootId, filterVisibility.active, matchKey]);

  useEffect(() => {
    if (!graph || !rootId || hydratedRoot.current !== rootId) return;
    saveTreeState(rootId, expanded, selected, graph);
  }, [graph, rootId, expanded, selected]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setFocusedNodeId(id);
      if (graph) {
        const name = graph.byId.get(id)?.display_name ?? "person";
        setLiveMessage(`Opened profile for ${name}`);
      }
      navigate({ search: (prev) => ({ ...prev, person: id }), replace: true });
    },
    [navigate, graph],
  );

  const focusInTree = useCallback(
    (id: string) => {
      if (!graph) return;
      const path = ancestryPath(graph, id).map((p) => p.id);
      setExpanded((prev) => new Set([...prev, ...path, id]));
      select(id);
    },
    [graph, select],
  );

  const closePanel = useCallback(() => {
    setSelected(null);
    navigate({ search: (prev) => ({ ...prev, person: undefined }), replace: true });
  }, [navigate]);

  const collectSubtreeIds = useCallback(() => {
    if (!graph || !rootId) return new Set<string>();
    const all = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop()!;
      all.add(cur);
      stack.push(...(graph.childrenOf.get(cur) ?? []));
    }
    return all;
  }, [graph, rootId]);

  const applyExpandAll = useCallback(() => {
    setExpanded(collectSubtreeIds());
    setExpandConfirmOpen(false);
  }, [collectSubtreeIds]);

  const requestExpandAll = useCallback(() => {
    const all = collectSubtreeIds();
    if (all.size > EXPAND_ALL_THRESHOLD) {
      setPendingExpandCount(all.size);
      setExpandConfirmOpen(true);
      return;
    }
    setExpanded(all);
  }, [collectSubtreeIds]);

  const collapseToDefault = useCallback(() => {
    if (!graph || !rootId) return;
    setExpanded(defaultExpanded(graph, rootId));
  }, [graph, rootId]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setGen(null);
  }, []);

  const branchPickerValue = rootParam && branches.some((b) => b.id === rootParam) ? rootParam : "";
  const breadcrumbFocusId = selected ?? personParam ?? rootId;

  const breadcrumbPath = useMemo(() => {
    if (!graph || !breadcrumbFocusId || !rootId) return [];
    return pathWithinRoot(graph, rootId, breadcrumbFocusId);
  }, [graph, rootId, breadcrumbFocusId]);

  const canvasFilters = useMemo(
    () =>
      filterVisibility.active
        ? {
            active: true as const,
            visible: filterVisibility.visible,
            selfMatch: filterVisibility.selfMatch,
          }
        : undefined,
    [filterVisibility.active, filterVisibility.visible, filterVisibility.selfMatch],
  );

  return (
    <AppShell wide>
      <div className="relative h-[calc(100dvh-4.25rem-4rem-env(safe-area-inset-bottom))] w-full md:h-[calc(100dvh-8.5rem)]">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>

        {isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading the family record…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-destructive">
            Could not load the family data.
          </div>
        )}
        {graph && rootId && breadcrumbFocusId && (
          <>
            <TreeToolbar
              branches={branches}
              branchPickerValue={branchPickerValue}
              onBranchChange={(branchId) =>
                navigate({
                  search: () => (branchId ? { root: branchId } : {}),
                  replace: true,
                })
              }
              query={query}
              onQueryChange={setQuery}
              gen={gen}
              onGenChange={setGen}
              maxGen={maxGen}
              matchCount={filterVisibility.matchCount}
              filtersActive={filterVisibility.active}
              onClearFilters={clearFilters}
              onExpandAll={requestExpandAll}
              onCollapse={collapseToDefault}
            />

            {breadcrumbPath.length > 1 && (
              <div className="pointer-events-none absolute inset-x-3 top-[7.5rem] z-20 sm:inset-x-auto sm:left-4 sm:right-4 sm:top-[8.5rem]">
                <div className="pointer-events-none rounded-full border border-border bg-card/90 px-3 py-1.5 backdrop-blur sm:max-w-[min(100%,42rem)]">
                  <TreeBreadcrumbs
                    graph={graph}
                    rootId={rootId}
                    focusId={breadcrumbFocusId}
                    onFocus={focusInTree}
                  />
                </div>
              </div>
            )}

            <FamilyTreeCanvas
              graph={graph}
              rootId={rootId}
              expanded={expanded}
              selectedId={selected}
              focusedNodeId={focusedNodeId}
              filters={canvasFilters}
              onToggle={toggle}
              onSelect={select}
              onFocusNode={setFocusedNodeId}
              onClosePanel={selected ? closePanel : undefined}
            />
            <PersonPanel
              graph={graph}
              personId={selected}
              onClose={closePanel}
              onNavigatePerson={focusInTree}
            />

            <AlertDialog open={expandConfirmOpen} onOpenChange={setExpandConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Expand entire branch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This branch has {pendingExpandCount} people. Expanding all may slow down the
                    tree on smaller devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={applyExpandAll}>Expand all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </AppShell>
  );
}
