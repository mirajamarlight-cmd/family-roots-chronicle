import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { PersonPanel } from "@/components/PersonPanel";
import { FamilyTreeCanvas } from "@/components/FamilyTreeCanvas";
import { Button } from "@/components/ui/button";
import { useFamilyGraph } from "@/hooks/useFamily";
import { ancestryPath } from "@/lib/family";

const searchSchema = z.object({
  person: z.string().optional(),
  root: z.string().optional(),
});

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

  const rootId = useMemo(() => {
    if (!graph) return null;
    if (rootParam && graph.byId.has(rootParam)) return rootParam;
    return graph.roots[0] ?? null;
  }, [graph, rootParam]);

  // Default view: the root plus its direct children visible (grandchildren collapsed).
  useEffect(() => {
    if (!graph || !rootId) return;
    setExpanded(new Set([rootId]));
    setSelected(null);
  }, [graph, rootId]);

  // Branches available for quick focus (top-level branch ancestors).
  const branches = useMemo(() => {
    if (!graph) return [];
    const ids = new Set<string>();
    for (const b of graph.branchOf.values()) if (b) ids.add(b);
    return [...ids]
      .map((id) => ({ id, name: graph.byId.get(id)?.display_name ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [graph]);


  // Focus a person coming from search / profile links: expand their whole path.
  useEffect(() => {
    if (!graph || !personParam || !graph.byId.has(personParam)) return;
    const path = ancestryPath(graph, personParam).map((p) => p.id);
    setExpanded((prev) => new Set([...prev, ...path, personParam]));
    setSelected(personParam);
  }, [graph, personParam]);

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
      navigate({ search: (prev) => ({ ...prev, person: id }), replace: true });
    },
    [navigate],
  );

  const expandAllFrom = () => {
    if (!graph || !rootId) return;
    const all = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop()!;
      all.add(cur);
      stack.push(...(graph.childrenOf.get(cur) ?? []));
    }
    setExpanded(all);
  };

  return (
    <AppShell wide>
      <div className="relative h-[calc(100vh-8.5rem)] w-full">
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
        {graph && rootId && (
          <>
            <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap gap-2">
              <div className="pointer-events-auto rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
                Tap a name to open the profile · use the arrow to expand a branch
              </div>
              <Button
                size="sm"
                variant="outline"
                className="pointer-events-auto rounded-full bg-card/90"
                onClick={expandAllFrom}
              >
                <Maximize2 className="size-3.5" /> Expand all
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="pointer-events-auto rounded-full bg-card/90"
                onClick={() => setExpanded(new Set([rootId]))}
              >
                <Minimize2 className="size-3.5" /> Collapse
              </Button>
              {branches.length > 0 && (
                <select
                  value={rootParam && branches.some((b) => b.id === rootParam) ? rootParam : ""}
                  onChange={(e) =>
                    navigate({
                      search: () => (e.target.value ? { root: e.target.value } : {}),
                      replace: true,
                    })
                  }
                  aria-label="Focus a branch"
                  className="pointer-events-auto rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs backdrop-blur"
                >
                  <option value="">Whole family</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}&apos;s branch
                    </option>
                  ))}
                </select>
              )}
            </div>

            <FamilyTreeCanvas
              graph={graph}
              rootId={rootId}
              expanded={expanded}
              selectedId={selected}
              onToggle={toggle}
              onSelect={select}
            />
            <PersonPanel
              graph={graph}
              personId={selected}
              onClose={() => setSelected(null)}
              onNavigatePerson={select}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
