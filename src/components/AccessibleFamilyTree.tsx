import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import { PersonAvatarBadge } from "@/components/person-identity";
import { descendantCount, type FamilyGraph } from "@/lib/family";
import { cn } from "@/lib/utils";

export function highlightName(name: string, query: string) {
  const q = query.trim();
  if (!q) return name;
  const lower = name.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded-sm bg-destructive/20 px-0.5 text-destructive">
        {name.slice(idx, idx + q.length)}
      </mark>
      {name.slice(idx + q.length)}
    </>
  );
}

type TreeItemProps = {
  graph: FamilyGraph;
  id: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  visible: Set<string>;
  selfMatch: Set<string>;
  selectedId: string | null;
  focusedId: string | null;
  query: string;
  onSelect: (id: string) => void;
  onFocusId: (id: string) => void;
  showMeta?: boolean;
  orderedIds: string[];
  itemRef: (id: string, el: HTMLLIElement | null) => void;
  renderEnd?: ((id: string) => ReactNode) | undefined;
};

function TreeItem({
  graph,
  id,
  expanded,
  onToggle,
  visible,
  selfMatch,
  selectedId,
  focusedId,
  query,
  onSelect,
  onFocusId,
  showMeta = true,
  orderedIds,
  itemRef,
  renderEnd,
}: TreeItemProps) {
  if (!visible.has(id)) return null;

  const person = graph.byId.get(id);
  if (!person) return null;

  const children = graph.childrenOf.get(id) ?? [];
  const hasKids = children.length > 0;
  const isExpanded = expanded.has(id);
  const gen = (graph.depthOf.get(id) ?? 0) + 1;
  const desc = descendantCount(graph, id);
  const isFocused = focusedId === id;
  const isSelected = selectedId === id;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const idx = orderedIds.indexOf(id);
    if (idx === -1) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < orderedIds.length - 1) onFocusId(orderedIds[idx + 1]!);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) onFocusId(orderedIds[idx - 1]!);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (hasKids && !isExpanded) onToggle(id);
      else if (hasKids && isExpanded && children[0]) onFocusId(children[0]!);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (hasKids && isExpanded) onToggle(id);
      else {
        const parent = graph.parentsOf.get(id)?.[0];
        if (parent && visible.has(parent)) onFocusId(parent);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <li
      ref={(el) => itemRef(id, el)}
      role="treeitem"
      aria-expanded={hasKids ? isExpanded : undefined}
      aria-level={gen}
      aria-selected={isSelected}
      className="list-none"
    >
      <div
        tabIndex={isFocused ? 0 : -1}
        data-tree-item-id={id}
        onFocus={() => onFocusId(id)}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (hasKids && target.closest("[data-toggle-zone]")) onToggle(id);
          else onSelect(id);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 outline-none",
          "cursor-pointer hover:bg-accent/40 focus-visible:ring-1 focus-visible:ring-ring",
          selfMatch.has(id) && "bg-secondary/50",
          isSelected && "ring-1 ring-primary/40",
        )}
      >
        <span
          data-toggle-zone
          aria-hidden
          className={cn(
            "flex size-[18px] shrink-0 items-center justify-center rounded-md border border-border text-[10px] text-muted-foreground",
            !hasKids && "size-1.5 rounded-full border-transparent bg-border",
            hasKids && isExpanded && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {hasKids && (
            <ChevronRight
              className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
            />
          )}
        </span>

        <PersonAvatarBadge graph={graph} personId={id} size="sm" />

        <span className="min-w-0 font-display text-base font-medium leading-tight">
          {selfMatch.has(id) ? highlightName(person.display_name, query) : person.display_name}
        </span>

        {showMeta && hasKids && (
          <span className="rounded-full bg-secondary px-2 py-px text-[11px] font-semibold text-muted-foreground">
            {desc} {desc === 1 ? "descendant" : "descendants"}
          </span>
        )}

        {showMeta && person.notes && !renderEnd && (
          <span className="min-w-0 truncate text-[11px] italic text-muted-foreground">
            {person.notes}
          </span>
        )}

        {renderEnd && (
          <span
            className="ml-auto flex shrink-0 items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {renderEnd(id)}
          </span>
        )}
      </div>

      {hasKids && isExpanded && (
        <ul
          role="group"
          className="branch-open ml-[17px] list-none border-l-[1.5px] border-border pl-[17px]"
        >
          {children.map((childId) => (
            <TreeItem
              key={childId}
              graph={graph}
              id={childId}
              expanded={expanded}
              onToggle={onToggle}
              visible={visible}
              selfMatch={selfMatch}
              selectedId={selectedId}
              focusedId={focusedId}
              query={query}
              onSelect={onSelect}
              onFocusId={onFocusId}
              showMeta={showMeta}
              orderedIds={orderedIds}
              itemRef={itemRef}
              renderEnd={renderEnd}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function collectVisibleOrdered(
  graph: FamilyGraph,
  rootId: string,
  expanded: Set<string>,
  visible: Set<string>,
): string[] {
  const result: string[] = [];
  const walk = (id: string) => {
    if (!visible.has(id)) return;
    result.push(id);
    if (expanded.has(id)) {
      for (const child of graph.childrenOf.get(id) ?? []) walk(child);
    }
  };
  walk(rootId);
  return result;
}

export function AccessibleFamilyTree({
  graph,
  rootId,
  expanded,
  onToggle,
  visible,
  selfMatch,
  selectedId = null,
  focusedId = null,
  query = "",
  onSelect,
  onFocusId,
  showMeta = true,
  className,
  ariaLabel,
  renderEnd,
}: {
  graph: FamilyGraph;
  rootId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  visible: Set<string>;
  selfMatch: Set<string>;
  selectedId?: string | null | undefined;
  focusedId?: string | null | undefined;
  query?: string | undefined;
  onSelect: (id: string) => void;
  onFocusId?: ((id: string) => void) | undefined;
  showMeta?: boolean | undefined;
  className?: string | undefined;
  ariaLabel?: string | undefined;
  renderEnd?: ((id: string) => ReactNode) | undefined;
}) {
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const rootName = graph.byId.get(rootId)?.display_name ?? "Unknown";

  const orderedIds = useMemo(
    () => collectVisibleOrdered(graph, rootId, expanded, visible),
    [graph, rootId, expanded, visible],
  );

  const setItemRef = useCallback((id: string, el: HTMLLIElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  const handleFocusId = useCallback(
    (id: string) => {
      onFocusId?.(id);
      requestAnimationFrame(() => {
        itemRefs.current.get(id)?.querySelector<HTMLElement>("[tabindex]")?.focus();
      });
    },
    [onFocusId],
  );

  useEffect(() => {
    if (!focusedId) return;
    requestAnimationFrame(() => {
      itemRefs.current.get(focusedId)?.querySelector<HTMLElement>("[tabindex]")?.focus();
    });
  }, [focusedId]);

  return (
    <ul
      role="tree"
      aria-label={ariaLabel ?? `Family tree rooted at ${rootName}`}
      className={cn("list-none p-0", className)}
    >
      <TreeItem
        graph={graph}
        id={rootId}
        expanded={expanded}
        onToggle={onToggle}
        visible={visible}
        selfMatch={selfMatch}
        selectedId={selectedId}
        focusedId={focusedId}
        query={query}
        onSelect={onSelect}
        onFocusId={handleFocusId}
        showMeta={showMeta}
        orderedIds={orderedIds}
        itemRef={setItemRef}
        renderEnd={renderEnd}
      />
    </ul>
  );
}
