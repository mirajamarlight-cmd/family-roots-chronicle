import { createFileRoute, Link } from "@tanstack/react-router";
import { GitBranch, Users } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { PersonAvatarBadge } from "@/components/person-identity";
import { useFamilyGraph } from "@/hooks/useFamily";
import { descendantCount } from "@/lib/family";
import { SITE_NAME } from "@/lib/brand";

const GEN_COLORS = [
  "var(--gen-1)",
  "var(--gen-2)",
  "var(--gen-3)",
  "var(--gen-4)",
  "var(--gen-5)",
] as const;

function genColor(depth: number): string {
  return GEN_COLORS[Math.min(depth, GEN_COLORS.length - 1)]!;
}

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: `Statistics — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Generation counts, branch sizes and totals across the Feqi Yonis family tree.",
      },
      { property: "og:title", content: `Statistics — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "See how the family is distributed across generations and branches.",
      },
    ],
  }),
  component: StatisticsPage,
});

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function StatisticsPage() {
  const { data: graph, isLoading, error, refetch } = useFamilyGraph();

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
      <PageHeader
        title="Statistics"
        description="Counts derived only from documented records."
      />

      <div className="mt-6">
        {isLoading && <PageState variant="loading" />}
        {error && <PageState variant="error" onRetry={() => refetch()} />}
      </div>

      {stats && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="People recorded" value={stats.total} icon={Users} />
            <StatTile label="Generations" value={stats.generations.length} icon={Users} />
            <StatTile label="Parent–child links" value={stats.relationships} icon={GitBranch} />
          </div>

          <ContentCard>
            <h2 className="font-display text-base font-semibold">People per generation</h2>
            <div className="mt-4 space-y-3">
              {stats.generations.map(([depth, count]) => (
                <div key={depth} className="flex items-center gap-2 text-sm sm:gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground sm:w-24 sm:text-sm">
                    Generation {depth + 1}
                  </span>
                  <div className="stat-bar flex-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(count / stats.total) * 100}%`,
                        backgroundColor: genColor(depth),
                      }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </ContentCard>

          <ContentCard>
            <h2 className="font-display text-base font-semibold">Branches</h2>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stats.branches.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/tree"
                    search={{ person: b.id }}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  >
                    {graph && <PersonAvatarBadge graph={graph} personId={b.id} size="sm" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {b.size}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </ContentCard>
        </div>
      )}
    </AppShell>
  );
}
