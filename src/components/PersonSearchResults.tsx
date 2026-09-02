import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";

import { FamilyPlace } from "@/components/family-place";
import { PersonAvatarBadge } from "@/components/person-identity";
import type { FamilyGraph, Person } from "@/lib/family";
import { duplicateEffectiveNames, effectiveDisplayName } from "@/lib/family";
import { cn } from "@/lib/utils";

export function duplicateNamesForResults(graph: FamilyGraph, results: Person[]) {
  const global = duplicateEffectiveNames(graph);
  const counts = new Map<string, number>();
  for (const person of results) {
    const name = effectiveDisplayName(graph, person.id);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const inResults = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  );
  return new Set([...global, ...inResults]);
}

type RowProps = {
  graph: FamilyGraph;
  person: Person;
  mode: "button" | "link";
  showBranchLink?: boolean | undefined;
  onSelect?: ((id: string) => void) | undefined;
  compact?: boolean | undefined;
  claimedByPerson?: ReadonlyMap<string, string> | undefined;
  currentUserId?: string | null | undefined;
};

function ResultRow({
  graph,
  person,
  mode,
  showBranchLink,
  onSelect,
  compact,
  claimedByPerson,
  currentUserId,
}: RowProps) {
  const branchId = graph.branchOf.get(person.id);
  const claimedByOther =
    !!claimedByPerson?.get(person.id) && claimedByPerson.get(person.id) !== currentUserId;

  const inner = (
    <>
      <PersonAvatarBadge graph={graph} personId={person.id} size={compact ? "sm" : "md"} />
      <FamilyPlace graph={graph} personId={person.id} compact={compact} className="flex-1" />
      {claimedByOther && (
        <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
          Linked
        </span>
      )}
      {showBranchLink && branchId && mode === "link" && (
        <Link
          to="/tree"
          search={{ root: branchId }}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/60"
        >
          <GitBranch className="mr-1 inline size-3" aria-hidden />
          Branch
        </Link>
      )}
    </>
  );

  const rowClass = cn(
    "flex w-full items-start gap-3 text-left transition-colors",
    compact ? "px-3 py-2" : "px-4 py-3",
    claimedByOther
      ? "cursor-not-allowed opacity-60"
      : mode === "button"
        ? "hover:bg-secondary/60"
        : "hover:bg-secondary/60",
  );

  if (claimedByOther) {
    return (
      <div className={rowClass} aria-disabled title="Already linked to another account">
        {inner}
      </div>
    );
  }

  if (mode === "link") {
    return (
      <Link to="/tree" search={{ person: person.id }} className={rowClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onSelect?.(person.id)} className={rowClass}>
      {inner}
    </button>
  );
}

type Props = {
  graph: FamilyGraph;
  results: Person[];
  duplicateNames: Set<string>;
  onSelect?: (id: string) => void;
  mode?: "button" | "link";
  showBranchLink?: boolean;
  compact?: boolean;
  className?: string;
  emptyMessage?: string;
  claimedByPerson?: ReadonlyMap<string, string> | undefined;
  currentUserId?: string | null | undefined;
};

export function PersonSearchResults({
  graph,
  results,
  duplicateNames,
  onSelect,
  mode = "button",
  showBranchLink = false,
  compact = false,
  className,
  emptyMessage = "No relative matches that name.",
  claimedByPerson,
  currentUserId = null,
}: Props) {
  if (!results.length) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className={cn("overflow-y-auto py-1", compact ? "max-h-64" : "", className)} role="listbox">
      {duplicateNames.size > 0 && (
        <li className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {results.length} match{results.length === 1 ? "" : "es"} — use the path to pick the right
          person.
        </li>
      )}
      {results.map((p) => (
        <li key={p.id} role="option">
          <ResultRow
            graph={graph}
            person={p}
            mode={mode}
            showBranchLink={showBranchLink}
            onSelect={onSelect}
            compact={compact}
            claimedByPerson={claimedByPerson}
            currentUserId={currentUserId}
          />
        </li>
      ))}
    </ul>
  );
}
