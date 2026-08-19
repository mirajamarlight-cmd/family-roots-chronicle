import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useFamilyGraph } from "@/hooks/useFamily";
import { ancestryPath, searchPeople } from "@/lib/family";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Relatives — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content: "Search the Yonis and Ahmed family record by name and jump straight to a relative's place in the tree.",
      },
      { property: "og:title", content: "Search Relatives — Yonis & Ahmed Family Record" },
      {
        property: "og:description",
        content: "Find any documented relative by name and open their branch of the family tree.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { data: graph, isLoading } = useFamilyGraph();
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => (graph ? searchPeople(graph, query) : []),
    [graph, query],
  );

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search by any part of a name across the documented family record.
      </p>

      <div className="relative mt-6 max-w-lg">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Fatuma"
          className="pl-9"
          autoFocus
        />
      </div>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading the family record…
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {graph &&
          results.map((p) => (
            <li key={p.id}>
              <Link
                to="/"
                search={{ person: p.id }}
                className="block rounded-lg border border-border bg-card/70 px-4 py-3 transition-colors hover:bg-secondary/60"
              >
                <span className="font-medium">{p.display_name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {ancestryPath(graph, p.id)
                    .map((a) => a.display_name)
                    .join(" › ") || "Root of the family"}
                </span>
              </Link>
            </li>
          ))}
      </ul>

      {graph && query.trim() && results.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No relative matches that name.</p>
      )}
    </AppShell>
  );
}
