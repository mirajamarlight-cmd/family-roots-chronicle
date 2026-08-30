import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Baby,
  BarChart3,
  Camera,
  GitBranch,
  Heart,
  HeartOff,
  Layers,
  Link2,
  TreeDeciduous,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { PersonAvatarBadge } from "@/components/person-identity";
import { useFamilyGraph } from "@/hooks/useFamily";
import { SITE_NAME } from "@/lib/brand";
import { computeFamilyStatistics } from "@/lib/family-statistics";
import { cn } from "@/lib/utils";

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
          "Living and deceased counts, generations, branches, and record completeness across the Feqi Yonis family tree.",
      },
      { property: "og:title", content: `Statistics — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "See how the family is distributed across generations, branches, and life records.",
      },
    ],
  }),
  component: StatisticsPage,
});

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "destructive" | "muted";
}) {
  const accentClass =
    accent === "destructive"
      ? "bg-destructive/10 text-destructive"
      : accent === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-secondary text-muted-foreground";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", accentClass)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function RecordBar({ label, count, total, icon: Icon }: { label: string; count: number; total: number; icon: LucideIcon }) {
  const percent = pct(count, total);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {label}
        </span>
        <span className="tabular-nums text-foreground">
          {count} <span className="text-muted-foreground">({percent}%)</span>
        </span>
      </div>
      <div className="stat-bar">
        <div
          className="h-full rounded-full bg-primary/75 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SplitBar({ living, deceased }: { living: number; deceased: number }) {
  const total = living + deceased;
  const livingPct = pct(living, total);
  const deceasedPct = total > 0 ? 100 - livingPct : 0;
  return (
    <div className="space-y-2">
      <div className="stat-bar flex h-3">
        {livingPct > 0 && (
          <div className="h-full bg-primary/80 transition-all" style={{ width: `${livingPct}%` }} />
        )}
        {deceasedPct > 0 && (
          <div className="h-full bg-destructive/75 transition-all" style={{ width: `${deceasedPct}%` }} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/80" aria-hidden />
          Living — {living} ({livingPct}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-destructive/75" aria-hidden />
          Deceased — {deceased} ({deceasedPct}%)
        </span>
      </div>
    </div>
  );
}

function StatisticsPage() {
  const { data: graph, isLoading, error, refetch } = useFamilyGraph();

  const stats = useMemo(() => (graph ? computeFamilyStatistics(graph) : null), [graph]);

  return (
    <AppShell>
      <PageHeader
        title="Statistics"
        description="A snapshot of everyone recorded in the tree — living and deceased, generations, branches, and how complete each profile is."
      />

      <div className="mt-6">
        {isLoading && <PageState variant="loading" />}
        {error && <PageState variant="error" onRetry={() => refetch()} />}
      </div>

      {stats && graph && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="People recorded" value={stats.total} icon={Users} accent="primary" />
            <StatTile label="Living" value={stats.living} hint="No death date or deceased flag" icon={Heart} accent="primary" />
            <StatTile label="Deceased" value={stats.deceased} icon={HeartOff} accent="destructive" />
            <StatTile
              label="Generations"
              value={stats.generations}
              hint={`Deepest level: ${stats.maxDepth}`}
              icon={Layers}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Branches" value={stats.branchCount} icon={GitBranch} />
            <StatTile label="Parent–child links" value={stats.linkCount} icon={Link2} />
            <StatTile
              label="Separate trees"
              value={stats.separateRoots}
              hint="Roots not under Yonis"
              icon={TreeDeciduous}
            />
            <StatTile
              label="Largest branch"
              value={stats.branches[0]?.size ?? 0}
              hint={stats.branches[0]?.name ?? "—"}
              icon={BarChart3}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ContentCard>
              <h2 className="font-display text-base font-semibold">Living and deceased</h2>
              <p className="mt-1 text-xs text-muted-foreground">Based on death dates and admin deceased flags.</p>
              <div className="mt-4">
                <SplitBar living={stats.living} deceased={stats.deceased} />
              </div>
            </ContentCard>

            <ContentCard>
              <h2 className="font-display text-base font-semibold">Gender</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(
                  [
                    ["Male", stats.gender.male],
                    ["Female", stats.gender.female],
                    ["Not set", stats.gender.unknown],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label} className="rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-center">
                    <p className="text-xl font-semibold tabular-nums">{count}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </ContentCard>
          </div>

          {(stats.oldestLiving || stats.youngestLiving) && (
            <ContentCard>
              <h2 className="font-display text-base font-semibold">Age among the living</h2>
              <p className="mt-1 text-xs text-muted-foreground">Only relatives with a recorded birth date.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {stats.oldestLiving && (
                  <Link
                    to="/tree"
                    search={{ person: stats.oldestLiving.id }}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  >
                    <PersonAvatarBadge graph={graph} personId={stats.oldestLiving.id} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{stats.oldestLiving.name}</p>
                      <p className="text-xs text-muted-foreground">Oldest — {stats.oldestLiving.age} years</p>
                    </div>
                  </Link>
                )}
                {stats.youngestLiving && (
                  <Link
                    to="/tree"
                    search={{ person: stats.youngestLiving.id }}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  >
                    <PersonAvatarBadge graph={graph} personId={stats.youngestLiving.id} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{stats.youngestLiving.name}</p>
                      <p className="text-xs text-muted-foreground">Youngest — {stats.youngestLiving.age} years</p>
                    </div>
                  </Link>
                )}
              </div>
            </ContentCard>
          )}

          <ContentCard>
            <h2 className="font-display text-base font-semibold">Record completeness</h2>
            <p className="mt-1 text-xs text-muted-foreground">How much detail has been captured so far.</p>
            <div className="mt-4 space-y-4">
              <RecordBar label="Birth date" count={stats.records.birthDate} total={stats.total} icon={Baby} />
              <RecordBar label="Gender" count={stats.records.genderSet} total={stats.total} icon={Users} />
              <RecordBar label="Photo" count={stats.records.photo} total={stats.total} icon={Camera} />
              <RecordBar label="Notes" count={stats.records.notes} total={stats.total} icon={BarChart3} />
            </div>
          </ContentCard>

          <ContentCard>
            <h2 className="font-display text-base font-semibold">People per generation</h2>
            <div className="mt-4 space-y-3">
              {stats.byGeneration.map((gen) => {
                const max = Math.max(...stats.byGeneration.map((g) => g.count), 1);
                return (
                  <div key={gen.depth} className="flex items-center gap-2 text-sm sm:gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground sm:w-24 sm:text-sm">
                      Gen {gen.depth + 1}
                    </span>
                    <div className="stat-bar flex-1">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(gen.count / max) * 100}%`,
                          backgroundColor: genColor(gen.depth),
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums sm:text-sm">
                      {gen.count}
                      <span className="text-muted-foreground">
                        {" "}
                        ({gen.living}L/{gen.deceased}D)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </ContentCard>

          {stats.birthDecades.length > 0 && (
            <ContentCard>
              <h2 className="font-display text-base font-semibold">Birth decades</h2>
              <p className="mt-1 text-xs text-muted-foreground">Where birth years are recorded.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.birthDecades.map((d) => (
                  <span
                    key={d.label}
                    className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs tabular-nums"
                  >
                    {d.label} · {d.count}
                  </span>
                ))}
              </div>
            </ContentCard>
          )}

          {stats.topParents.length > 0 && (
            <ContentCard>
              <h2 className="font-display text-base font-semibold">Largest families</h2>
              <p className="mt-1 text-xs text-muted-foreground">Parents with the most recorded children.</p>
              <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {stats.topParents.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/tree"
                      search={{ person: p.id }}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-secondary/50"
                    >
                      <PersonAvatarBadge graph={graph} personId={p.id} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                        {p.childCount} {p.childCount === 1 ? "child" : "children"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ContentCard>
          )}

          <ContentCard>
            <h2 className="font-display text-base font-semibold">Branches</h2>
            <p className="mt-1 text-xs text-muted-foreground">Each branch starts from a child of the second generation.</p>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stats.branches.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/tree"
                    search={{ person: b.id }}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  >
                    <PersonAvatarBadge graph={graph} personId={b.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.living} living · {b.deceased} deceased
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-xs font-semibold text-muted-foreground">{b.size}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </ContentCard>

          <p className="pb-2 text-center text-xs text-muted-foreground">
            All figures come from documented records only.{" "}
            <Link to="/tree" className="font-medium text-primary underline-offset-2 hover:underline">
              Open the tree
            </Link>{" "}
            to explore anyone listed here.
          </p>
        </div>
      )}
    </AppShell>
  );
}
