import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";

import { ContentCard } from "@/components/ContentCard";
import { PersonAvatarBadge } from "@/components/person-identity";
import { RelationshipTreeView } from "@/components/RelationshipTreeView";
import { Button } from "@/components/ui/button";
import type { FamilyGraph } from "@/lib/family";
import {
  formatRelationshipSentence,
  getRelationshipBridge,
  type RelationshipResult,
} from "@/lib/relationship-finder";

export function RelationshipResultCard({
  graph,
  result,
}: {
  graph: FamilyGraph;
  result: RelationshipResult;
}) {
  const sentence = formatRelationshipSentence(graph, result);
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
            <span className="font-medium">{personA.display_name}</span>
          </div>
          <span className="text-sm text-muted-foreground" aria-hidden>
            ↔
          </span>
          <div className="flex flex-col items-center gap-2 text-center">
            <PersonAvatarBadge graph={graph} personId={personB.id} size="lg" showBadge={false} />
            <span className="font-medium">{personB.display_name}</span>
          </div>
        </div>
      )}

      <p className="text-center font-display text-lg font-semibold leading-snug sm:text-xl">{sentence}</p>

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
              {personA.display_name}&apos;s branch
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/tree" search={{ person: personB.id, root: graph.branchOf.get(personB.id) ?? undefined }}>
              <GitBranch className="size-4" aria-hidden />
              {personB.display_name}&apos;s branch
            </Link>
          </Button>
        </div>
      )}
    </ContentCard>
  );
}
