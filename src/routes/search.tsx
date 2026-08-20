import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useFamilyGraph } from "@/hooks/useFamily";
import { cn } from "@/lib/utils";
import { lineageLabel, searchPeople } from "@/lib/family";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Relatives — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content:
          "Search the Yonis and Ahmed family record by name and jump straight to a relative's place in the tree.",
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

  const results = useMemo(() => (graph ? searchPeople(graph, query) : []), [graph, query]);

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of results) {
      counts.set(person.display_name, (counts.get(person.display_name) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [results]);

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search by any part of a name across the documented family record.
      </p>

      <div className="relative mt-6 w-full max-w-lg">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Ahmed, Hamdi, Humeyda"
          className="pl-9"
          autoFocus
        />
      </div>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading the family record…
        </p>
      )}

      {duplicateNames.size > 0 && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          {results.length} relatives match, including {duplicateNames.size} shared name
          {duplicateNames.size === 1 ? "" : "s"}. Use the full path below to choose the right
          person.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {graph &&
          results.map((p) => {
            const path = lineageLabel(graph, p.id);
            const parentId = graph.parentsOf.get(p.id)?.[0];
            const parentName = parentId ? graph.byId.get(parentId)?.display_name : null;
            const branchId = graph.branchOf.get(p.id);
            const branchName = branchId ? graph.byId.get(branchId)?.display_name : null;
            const isDuplicate = duplicateNames.has(p.display_name);

            return (
              <li key={p.id}>
                <Link
                  to="/"
                  search={{ person: p.id }}
                  className="block rounded-lg border border-border bg-card/70 px-4 py-3 transition-colors hover:bg-secondary/60"
                >
                  <span className="font-medium">{p.display_name}</span>
                  <span
                    className={cn(
                      "mt-1 block text-sm leading-snug",
                      isDuplicate ? "font-medium text-foreground/85" : "text-muted-foreground",
                    )}
                  >
                    {path}
                  </span>
                  {isDuplicate && (parentName || branchName) && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {[
                        parentName && `Parent: ${parentName}`,
                        branchName && `Branch: ${branchName}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
      </ul>

      {graph && query.trim() && results.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No relative matches that name.</p>
      )}
    </AppShell>
  );
}
