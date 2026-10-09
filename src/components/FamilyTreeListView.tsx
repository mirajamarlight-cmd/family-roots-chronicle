import { AccessibleFamilyTree } from "@/components/AccessibleFamilyTree";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";
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
  visible: Set<string>;
  selfMatch: Set<string>;
  filtersActive: boolean;
  matchCount: number;
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
  visible,
  selfMatch,
  filtersActive,
  matchCount,
  className,
}: Props) {
  const rootName = effectiveDisplayName(graph, rootId);
  const isEmpty = filtersActive && matchCount === 0;

  return (
    <div className="h-full overflow-y-auto px-3 pb-4 sm:px-4">
      <div
        className={cn(
          "mx-auto max-w-3xl rounded-2xl border border-border bg-card/80 p-4 leaf-shadow sm:p-5",
          className,
        )}
      >
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
