import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFamilyGraph } from "@/hooks/useFamily";
import { descendantCount } from "@/lib/family";

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: "Family Statistics — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content:
          "Generation counts, branch sizes and totals across the documented Yonis and Ahmed family record.",
      },
      { property: "og:title", content: "Family Statistics — Yonis & Ahmed Family Record" },
      {
        property: "og:description",
        content: "See how the family is distributed across generations and branches.",
      },
    ],
  }),
  component: StatisticsPage,
});

function StatisticsPage() {
  const { data: graph, isLoading } = useFamilyGraph();

  const stats = useMemo(() => {
    if (!graph) return null;
    const byGeneration = new Map<number, number>();
    for (const p of graph.people) {
      const d = graph.depthOf.get(p.id) ?? 0;
      byGeneration.set(d, (byGeneration.get(d) ?? 0) + 1);
    }
    const branchIds = new Set<string>();
    for (const b of graph.branchOf.values()) if (b) branchIds.add(b);
    const branches = [...branchIds]
      .map((id) => ({
        id,
        name: graph.byId.get(id)?.display_name ?? "Unknown",
        size: descendantCount(graph, id) + 1,
      }))
      .sort((a, b) => b.size - a.size);
    return {
      total: graph.people.length,
      generations: [...byGeneration.entries()].sort((a, b) => a[0] - b[0]),
      branches,
      relationships: graph.links.length,
    };
  }, [graph]);

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Statistics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Counts derived only from documented records.
      </p>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{stats.total} people recorded</p>
              <p>{stats.relationships} parent–child links</p>
              <p>{stats.generations.length} generations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">People per generation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.generations.map(([depth, count]) => (
                <div key={depth} className="flex items-center gap-2 text-sm sm:gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground sm:w-24 sm:text-sm">
                    Generation {depth + 1}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Branches</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stats.branches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Link to="/" search={{ person: b.id }} className="hover:underline">
                    {b.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/"
                      search={{ root: b.id }}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60"
                    >
                      View branch
                    </Link>
                    <span className="text-muted-foreground tabular-nums">{b.size}</span>
                  </div>
                </div>
              ))}
            </CardContent>

          </Card>
        </div>
      )}
    </AppShell>
  );
}
