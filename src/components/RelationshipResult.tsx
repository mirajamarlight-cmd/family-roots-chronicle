import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";

import { ContentCard } from "@/components/ContentCard";
import { PersonAvatarBadge } from "@/components/person-identity";
import { RelationshipTreeView } from "@/components/RelationshipTreeView";
import { Button } from "@/components/ui/button";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";
import {
  formatRelationshipStory,
  getRelationshipBridge,
  type RelationshipResult,
  type StorySpan,
} from "@/lib/relationship-finder";

function StoryLine({ graph, spans }: { graph: FamilyGraph; spans: StorySpan[] }) {
  return (
    <p className="text-sm leading-relaxed">
      {spans.map((span, i) => {
        if ("t" in span) return <span key={i}>{span.t}</span>;
        const name = effectiveDisplayName(graph, span.id);
        return (
          <Link
            key={`${span.id}-${i}`}
            to="/tree"
            search={{ person: span.id }}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {name}
          </Link>
        );
      })}
    </p>
  );
}

export function RelationshipResultCard({
  graph,
  result,
}: {
  graph: FamilyGraph;
  result: RelationshipResult;
}) {
  const story = formatRelationshipStory(graph, result);
  const bridge = getRelationshipBridge(result);
  const personA = graph.byId.get(result.aId);
  const personB = graph.byId.get(result.bId);
  const meetId = bridge?.shape === "fork" ? bridge.lcaId : bridge?.shape === "line" ? bridge.ids[0] : null;

  return (
    <ContentCard className="space-y-5">
      {personA && personB && result.kind !== "same" && (
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <PersonAvatarBadge graph={graph} personId={personA.id} size="lg" showBadge={false} />
            <span className="font-medium">{effectiveDisplayName(graph, personA.id)}</span>
          </div>
          <span className="text-sm text-muted-foreground" aria-hidden>
            ↔
          </span>
          <div className="flex flex-col items-center gap-2 text-center">
            <PersonAvatarBadge graph={graph} personId={personB.id} size="lg" showBadge={false} />
            <span className="font-medium">{effectiveDisplayName(graph, personB.id)}</span>
          </div>
        </div>
      )}

      {story.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 px-4 py-3">
          {story.map((spans, i) => (
            <StoryLine key={i} graph={graph} spans={spans} />
          ))}
        </div>
      )}

      {result.kind === "unrelated" && (
        <p className="text-center text-sm text-muted-foreground">
          Based on documented parent–child links only. Spouse relationships are not included yet.
        </p>
      )}

      {result.kind === "related" && <RelationshipTreeView graph={graph} result={result} />}

      {result.kind !== "same" && personA && personB && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {meetId && (
            <Button variant="default" asChild className="gap-2">
              <Link to="/tree" search={{ person: meetId }}>
                <GitBranch className="size-4" aria-hidden />
                Open common ancestor in tree
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild className="gap-2">
            <Link to="/tree" search={{ person: personA.id, root: graph.branchOf.get(personA.id) ?? undefined }}>
              <GitBranch className="size-4" aria-hidden />
              {effectiveDisplayName(graph, personA.id)}&apos;s branch
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/tree" search={{ person: personB.id, root: graph.branchOf.get(personB.id) ?? undefined }}>
              <GitBranch className="size-4" aria-hidden />
              {effectiveDisplayName(graph, personB.id)}&apos;s branch
            </Link>
          </Button>
        </div>
      )}
    </ContentCard>
  );
}
