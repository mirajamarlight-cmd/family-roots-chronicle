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

type Props = {
  graph: FamilyGraph;
  results: Person[];
  duplicateNames: Set<string>;
  onSelect: (id: string) => void;
  className?: string;
};

export function PersonSearchResults({ graph, results, duplicateNames, onSelect, className }: Props) {
  if (!results.length) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">No relative matches that name.</p>;
  }

  return (
    <ul className={cn("max-h-64 overflow-y-auto py-1", className)}>
      {duplicateNames.size > 0 && (
        <li className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {results.length} match{results.length === 1 ? "" : "es"} — use the path to pick the right
          person.
        </li>
      )}
      {results.map((p) => {
        const path = lineageLabel(graph, p.id);
        const parentId = graph.parentsOf.get(p.id)?.[0];
        const parentName = parentId ? graph.byId.get(parentId)?.display_name : null;
        const branchId = graph.branchOf.get(p.id);
        const branchName = branchId ? graph.byId.get(branchId)?.display_name : null;
        const isDuplicate = duplicateNames.has(p.display_name);

        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
            >
              <span className="font-medium">{p.display_name}</span>
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
                  {[
                    parentName && `Parent: ${parentName}`,
                    branchName && `Branch: ${branchName}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
