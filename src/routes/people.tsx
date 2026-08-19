import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useFamilyGraph } from "@/hooks/useFamily";
import { descendantCount } from "@/lib/family";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "All People — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content:
          "A complete alphabetical directory of every documented member of the Yonis and Ahmed family.",
      },
      { property: "og:title", content: "All People — Yonis & Ahmed Family Record" },
      {
        property: "og:description",
        content: "Browse every documented relative, with generation and descendant counts.",
      },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { data: graph, isLoading } = useFamilyGraph();
  const [filter, setFilter] = useState("");

  const people = useMemo(() => {
    if (!graph) return [];
    const q = filter.trim().toLowerCase();
    return graph.people
      .filter((p) => !q || p.display_name.toLowerCase().includes(q))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [graph, filter]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">People</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {graph ? `${graph.people.length} documented family members` : "Loading…"}
          </p>
        </div>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name"
          className="max-w-xs"
        />
      </div>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      )}

      <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {graph &&
          people.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/70 px-4 py-3"
            >
              <Link to="/" search={{ person: p.id }} className="min-w-0 flex-1">
                <span className="font-medium">{p.display_name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Generation {(graph.depthOf.get(p.id) ?? 0) + 1} · {descendantCount(graph, p.id)}{" "}
                  descendants
                </span>
              </Link>
              {(graph.childrenOf.get(p.id)?.length ?? 0) > 0 && (
                <Link
                  to="/"
                  search={{ root: p.id }}
                  className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60"
                >
                  View branch
                </Link>
              )}
            </li>
          ))}

      </ul>
    </AppShell>
  );
}
