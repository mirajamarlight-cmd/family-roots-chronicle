import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { RelationshipPersonPicker } from "@/components/RelationshipPersonPicker";
import { RelationshipResultCard } from "@/components/RelationshipResult";
import { Button } from "@/components/ui/button";
import { useFamilyGraph } from "@/hooks/useFamily";
import { SITE_NAME } from "@/lib/brand";
import { findRelationship } from "@/lib/relationship-finder";

export const Route = createFileRoute("/relationship")({
  head: () => ({
    meta: [
      { title: `Relationship — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Find how any two relatives in the Feqi Yonis family tree are connected by blood.",
      },
      { property: "og:title", content: `Relationship — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "Pick two family members and see their documented blood relationship.",
      },
    ],
  }),
  component: RelationshipPage,
});

function RelationshipPage() {
  const { data: graph, isLoading, error, refetch } = useFamilyGraph();
  const [personAId, setPersonAId] = useState<string | null>(null);
  const [personBId, setPersonBId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    if (!graph || !personAId || !personBId || !submitted) return null;
    return findRelationship(graph, personAId, personBId);
  }, [graph, personAId, personBId, submitted]);

  const canSubmit = Boolean(personAId && personBId);

  const swapPeople = () => {
    setPersonAId(personBId);
    setPersonBId(personAId);
    if (submitted) setSubmitted(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="Relationship"
        description="Choose two relatives to see how they are connected through documented parent–child links."
      />

      {isLoading && <PageState variant="loading" className="mt-6" />}
      {error && <PageState variant="error" className="mt-6" onRetry={() => refetch()} />}

      {graph && !isLoading && (
        <div className="mt-6 space-y-6">
          <ContentCard className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <RelationshipPersonPicker
                graph={graph}
                label="Person A"
                personId={personAId}
                excludeId={personBId}
                onSelect={(id) => {
                  setPersonAId(id);
                  setSubmitted(false);
                }}
                onClear={() => {
                  setPersonAId(null);
                  setSubmitted(false);
                }}
              />
              <RelationshipPersonPicker
                graph={graph}
                label="Person B"
                personId={personBId}
                excludeId={personAId}
                onSelect={(id) => {
                  setPersonBId(id);
                  setSubmitted(false);
                }}
                onClear={() => {
                  setPersonBId(null);
                  setSubmitted(false);
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={() => setSubmitted(true)}
              >
                Find relationship
              </Button>
              {canSubmit && (
                <Button type="button" variant="outline" className="gap-2" onClick={swapPeople}>
                  <ArrowLeftRight className="size-4" aria-hidden />
                  Swap A and B
                </Button>
              )}
            </div>
          </ContentCard>

          <div aria-live="polite" aria-atomic="true">
            {!submitted && (
              <PageState
                variant="empty"
                message="Select two people, then find their relationship."
                hint="Use the name search and lineage path to pick the right person when names repeat."
              />
            )}

            {submitted && result && <RelationshipResultCard graph={graph} result={result} />}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Blood relationships only — spouse and in-law links are not included in this version.
          </p>
        </div>
      )}
    </AppShell>
  );
}
