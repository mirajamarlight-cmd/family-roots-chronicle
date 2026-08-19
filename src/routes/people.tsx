import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PeopleTreeDirectory } from "@/components/PeopleTreeDirectory";
import { useFamilyGraph } from "@/hooks/useFamily";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "All People — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content:
          "Browse the documented Yonis and Ahmed family as an expandable directory with search and branch filters.",
      },
      { property: "og:title", content: "All People — Yonis & Ahmed Family Record" },
      {
        property: "og:description",
        content: "Explore every documented relative by generation and branch.",
      },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { data: graph, isLoading } = useFamilyGraph();

  return (
    <AppShell>
      <PeopleTreeDirectory graph={graph} isLoading={isLoading} />
    </AppShell>
  );
}
