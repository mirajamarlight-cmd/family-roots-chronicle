import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";

import { PersonAvatarBadge } from "@/components/person-identity";
import type { FamilyGraph, Person } from "@/lib/family";
import { lineageLabel } from "@/lib/family";
import { cn } from "@/lib/utils";

export function useDuplicateNames(results: Person[]) {
  const counts = new Map<string, number>();
  for (const person of results) {
    counts.set(person.display_name, (counts.get(person.display_name) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
}

type RowProps = {
  graph: FamilyGraph;
  person: Person;
  duplicateNames: Set<string>;
  mode: "button" | "link";
  showBranchLink?: boolean | undefined;
  onSelect?: ((id: string) => void) | undefined;
  compact?: boolean | undefined;
};

function ResultRow({ graph, person, duplicateNames, mode, showBranchLink, onSelect, compact }: RowProps) {
  const path = lineageLabel(graph, person.id);
  const parentId = graph.parentsOf.get(person.id)?.[0];
  const parentName = parentId ? graph.byId.get(parentId)?.display_name : null;
  const branchId = graph.branchOf.get(person.id);
  const branchName = branchId ? graph.byId.get(branchId)?.display_name : null;
  const isDuplicate = duplicateNames.has(person.display_name);

  const inner = (
    <>
      <PersonAvatarBadge graph={graph} personId={person.id} size={compact ? "sm" : "md"} />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{person.display_name}</span>
        <span
          className={cn(
            "mt-0.5 block text-sm leading-snug",
            isDuplicate ? "font-medium text-foreground/85" : "text-muted-foreground",
          )}
        >
          {path}
        </span>
        {isDuplicate && (parentName || branchName) && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {[parentName && `Parent: ${parentName}`, branchName && `Branch: ${branchName}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </span>
      {showBranchLink && branchId && mode === "link" && (
        <Link
          to="/tree"
          search={{ root: branchId }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/60"
        >
          <GitBranch className="mr-1 inline size-3" aria-hidden />
          Branch
        </Link>
      )}
    </>
  );

  const rowClass = cn(
    "flex w-full items-center gap-3 text-left transition-colors hover:bg-secondary/60",
    compact ? "px-3 py-2" : "px-4 py-3",
  );

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
            duplicateNames={duplicateNames}
            mode={mode}
            showBranchLink={showBranchLink}
            onSelect={onSelect}
            compact={compact}
          />
        </li>
      ))}
    </ul>
  );
}
