import { Search } from "lucide-react";

import { AccessibleFamilyTree } from "@/components/AccessibleFamilyTree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FamilyGraph } from "@/lib/family";
import { cn } from "@/lib/utils";

type Props = {
  graph: FamilyGraph;
  rootId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId?: string | null;
  focusedId?: string | null;
  onFocusId?: (id: string) => void;
  listQuery: string;
  onListQueryChange: (query: string) => void;
  visible: Set<string>;
  selfMatch: Set<string>;
  matchCount: number;
  filtersActive: boolean;
  onClearFilters: () => void;
  className?: string;
};

export function FamilyTreeListView({
  graph,
  rootId,
  expanded,
  onToggle,
  onSelect,
  selectedId = null,
  focusedId = null,
  onFocusId,
  listQuery,
  onListQueryChange,
  visible,
  selfMatch,
  matchCount,
  filtersActive,
  onClearFilters,
  className,
}: Props) {
  const rootName = graph.byId.get(rootId)?.display_name ?? "Unknown";
  const isEmpty = filtersActive && matchCount === 0;

  return (
    <div className="h-full overflow-y-auto px-3 pb-4 sm:px-4">
      <div
        className={cn(
          "mx-auto max-w-3xl rounded-2xl border border-border bg-card/80 p-4 leaf-shadow sm:p-5",
          className,
        )}
      >
        <div className="pointer-events-auto mb-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          <div className="relative min-w-[140px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={listQuery}
              onChange={(e) => onListQueryChange(e.target.value)}
              placeholder="Filter names in this list…"
              aria-label="Filter list by name"
              className="rounded-full pl-9"
            />
          </div>
          {filtersActive && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          )}
          {filtersActive && (
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {isEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No one matches your filters in {rootName}&apos;s branch. Try clearing filters or choosing a
            different generation.
          </p>
        ) : (
          <AccessibleFamilyTree
            graph={graph}
            rootId={rootId}
            expanded={expanded}
            onToggle={onToggle}
            visible={visible}
            selfMatch={selfMatch}
            selectedId={selectedId}
            focusedId={focusedId}
            query={listQuery}
            onSelect={onSelect}
            onFocusId={onFocusId}
            showMeta
            ariaLabel={`Family list rooted at ${rootName}`}
          />
        )}
      </div>
    </div>
  );
}
