import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { FamilyTreeListView } from "@/components/FamilyTreeListView";
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
import { Button } from "@/components/ui/button";
import { useFamilyGraph } from "@/hooks/useFamily";
import { ancestryPath, canonicalRootId, collectSubtreeIds, listBranches, maxGeneration, pathWithinRoot } from "@/lib/family";
import { ancestorsToExpand, computeVisibility } from "@/lib/tree-filters";
import { defaultExpanded, loadTreeState, saveTreeState } from "@/lib/tree-state";

const searchSchema = z.object({
  person: z.string().optional(),
  root: z.string().optional(),
  view: z.enum(["canvas", "list"]).optional(),
});

const EXPAND_ALL_THRESHOLD = 150;

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
  const { person: personParam, root: rootParam, view: viewParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data: graph, isLoading, error, refetch } = useFamilyGraph();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [gen, setGen] = useState<number | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [expandConfirmOpen, setExpandConfirmOpen] = useState(false);
  const [pendingExpandCount, setPendingExpandCount] = useState(0);
  const view = viewParam ?? "canvas";
  const hydratedRoot = useRef<string | null>(null);

  const rootId = useMemo(() => {
    if (!graph) return null;
    if (rootParam && graph.byId.has(rootParam)) return rootParam;
    return canonicalRootId(graph);
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

  const branches = useMemo(() => (graph ? listBranches(graph) : []), [graph]);

  const maxGen = useMemo(() => (graph ? maxGeneration(graph) : 0), [graph]);

  const rootLabel = useMemo(() => {
    if (!graph || !rootId) return "Unknown";
    return graph.byId.get(rootId)?.display_name ?? "Unknown";
  }, [graph, rootId]);

  const filterVisibility = useMemo(
    () =>
      graph
        ? computeVisibility(graph, { query: view === "list" ? listQuery : "", branchId: "", gen })
        : {
            active: false,
            visible: new Set<string>(),
            selfMatch: new Set<string>(),
            matchCount: 0,
          },
    [graph, gen, listQuery, view],
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

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        const wasExpanded = next.has(id);
        if (wasExpanded) next.delete(id);
        else next.add(id);
        if (graph) {
          const name = graph.byId.get(id)?.display_name ?? "person";
          const childCount = graph.childrenOf.get(id)?.length ?? 0;
          setLiveMessage(
            wasExpanded ? `Branch collapsed for ${name}` : `Showing ${childCount} children of ${name}`,
          );
        }
        return next;
      });
    },
    [graph],
  );

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setFocusedNodeId(id);
      if (graph) {
        const name = graph.byId.get(id)?.display_name ?? "person";
        setLiveMessage(`${name}'s profile opened`);
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

  const collectSubtree = useCallback(() => {
    if (!graph || !rootId) return new Set<string>();
    return collectSubtreeIds(graph, rootId);
  }, [graph, rootId]);

  const listVisible = useMemo(() => {
    if (!graph || !rootId) return new Set<string>();
    const subtree = collectSubtree();
    if (!filterVisibility.active) return subtree;
    return new Set([...filterVisibility.visible].filter((id) => subtree.has(id)));
  }, [graph, rootId, filterVisibility.active, filterVisibility.visible, collectSubtree]);

  const setView = useCallback(
    (next: "canvas" | "list") => {
      if (next === "canvas") setListQuery("");
      navigate({
        search: (prev) => ({ ...prev, view: next === "canvas" ? undefined : next }),
        replace: true,
      });
    },
    [navigate],
  );

  const applyExpandAll = useCallback(() => {
    setExpanded(collectSubtree());
    setExpandConfirmOpen(false);
  }, [collectSubtree]);

  const requestExpandAll = useCallback(() => {
    const all = collectSubtree();
    if (all.size > EXPAND_ALL_THRESHOLD) {
      setPendingExpandCount(all.size);
      setExpandConfirmOpen(true);
      return;
    }
    setExpanded(all);
  }, [collectSubtree]);

  const collapseToDefault = useCallback(() => {
    if (!graph || !rootId) return;
    setExpanded(defaultExpanded(graph, rootId));
  }, [graph, rootId]);

  const goHome = useCallback(() => {
    setSelected(null);
    setFocusedNodeId(null);
    if (graph && rootId) {
      const canon = canonicalRootId(graph);
      if (canon) setExpanded(defaultExpanded(graph, canon));
    }
    navigate({
      search: (prev) => ({ ...prev, root: undefined, person: undefined }),
      replace: true,
    });
  }, [navigate, graph, rootId]);

  const clearFilters = useCallback(() => {
    setGen(null);
    setListQuery("");
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
      <div className="tree-page flex flex-col overflow-hidden">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>

        {isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading the family record…
          </div>
        )}
        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-destructive">
            <p>Could not load the family data.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}
        {graph && rootId && breadcrumbFocusId && (
          <>
            <TreeToolbar
              graph={graph}
              rootLabel={rootLabel}
              branches={branches}
              branchPickerValue={branchPickerValue}
              onBranchChange={(branchId) =>
                navigate({
                  search: (prev) =>
                    branchId
                      ? { ...prev, root: branchId, person: undefined }
                      : { ...prev, root: undefined, person: undefined },
                  replace: true,
                })
              }
              onSelectPerson={focusInTree}
              onHome={goHome}
              gen={gen}
              onGenChange={setGen}
              maxGen={maxGen}
              matchCount={filterVisibility.matchCount}
              filtersActive={filterVisibility.active}
              onClearFilters={clearFilters}
              onExpandAll={requestExpandAll}
              onCollapse={collapseToDefault}
              view={view}
              onViewChange={setView}
            />

            <div className="relative flex min-h-0 flex-1">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                {breadcrumbPath.length > 1 && (
                  <div className="shrink-0 px-3 pb-2 sm:px-4">
                    <div className="rounded-full border border-border bg-card/90 px-3 py-1.5 backdrop-blur sm:max-w-[min(100%,42rem)]">
                      <TreeBreadcrumbs
                        graph={graph}
                        rootId={rootId}
                        focusId={breadcrumbFocusId}
                        onFocus={focusInTree}
                      />
                    </div>
                  </div>
                )}

                <div className="relative min-h-0 flex-1">
                  {view === "canvas" ? (
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
                  ) : (
                    <FamilyTreeListView
                      graph={graph}
                      rootId={rootId}
                      expanded={expanded}
                      onToggle={toggle}
                      onSelect={select}
                      selectedId={selected}
                      focusedId={focusedNodeId ?? selected ?? rootId}
                      onFocusId={setFocusedNodeId}
                      listQuery={listQuery}
                      onListQueryChange={setListQuery}
                      visible={listVisible}
                      selfMatch={filterVisibility.selfMatch}
                      matchCount={filterVisibility.matchCount}
                      filtersActive={filterVisibility.active}
                      onClearFilters={clearFilters}
                    />
                  )}
                </div>
              </div>

              <PersonPanel
                graph={graph}
                personId={selected}
                onClose={closePanel}
                onNavigatePerson={focusInTree}
              />
            </div>

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
