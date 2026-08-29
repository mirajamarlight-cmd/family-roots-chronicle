import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import {
  duplicateNamesForResults,
  PersonSearchResults,
} from "@/components/PersonSearchResults";
import { Input } from "@/components/ui/input";
import { useFamilyGraph } from "@/hooks/useFamily";
import { searchPeople } from "@/lib/family";
import { SITE_NAME } from "@/lib/brand";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: `Search — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Search the Feqi Yonis family tree by name and jump straight to a relative's place in the tree.",
      },
      { property: "og:title", content: `Search — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "Find any documented relative by name and open their branch of the family tree.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { data: graph, isLoading, error, refetch } = useFamilyGraph();
  const [query, setQuery] = useState("");

  const results = useMemo(() => (graph ? searchPeople(graph, query) : []), [graph, query]);
  const duplicateNames = useMemo(
    () => (graph ? duplicateNamesForResults(graph, results) : new Set<string>()),
    [graph, results],
  );
  const trimmed = query.trim();

  return (
    <AppShell>
      <PageHeader
        title="Search"
        description="Search by any part of a name across the Feqi Yonis family tree."
      />

      <div className="relative mt-6 w-full max-w-lg">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Ahmed, Hamdi, Humeyda"
          aria-label="Search relatives by name"
          className="rounded-full pl-9"
          autoFocus
        />
      </div>

      <div className="mt-6" aria-live="polite" aria-atomic="true">
        {isLoading && <PageState variant="loading" />}
        {error && <PageState variant="error" onRetry={() => refetch()} />}

        {graph && !trimmed && !isLoading && (
          <PageState
            variant="empty"
            message="Start typing a name to search the family tree."
            hint="Try a first name, surname, or part of either."
          />
        )}

        {graph && trimmed && results.length === 0 && !isLoading && (
          <PageState
            variant="empty"
            message={`No relative matches “${trimmed}”.`}
            hint="Check spelling or try a shorter part of the name."
          />
        )}

        {graph && trimmed && results.length > 0 && (
          <ContentCard padding="sm" className="overflow-hidden p-0">
            <PersonSearchResults
              graph={graph}
              results={results}
              duplicateNames={duplicateNames}
              mode="link"
              showBranchLink
              className="max-h-none py-0"
            />
          </ContentCard>
        )}
      </div>
    </AppShell>
  );
}
