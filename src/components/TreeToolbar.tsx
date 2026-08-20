import { Maximize2, Minimize2, MoreHorizontal, Search } from "lucide-react";

import { BranchPicker } from "@/components/BranchPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Props = {
  branches: { id: string; name: string }[];
  branchPickerValue: string;
  onBranchChange: (branchId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  gen: number | null;
  onGenChange: (gen: number | null) => void;
  maxGen: number;
  matchCount: number;
  filtersActive: boolean;
  onClearFilters: () => void;
  onExpandAll: () => void;
  onCollapse: () => void;
};

export function TreeToolbar({
  branches,
  branchPickerValue,
  onBranchChange,
  query,
  onQueryChange,
  gen,
  onGenChange,
  maxGen,
  matchCount,
  filtersActive,
  onClearFilters,
  onExpandAll,
  onCollapse,
}: Props) {
  const isMobile = useIsMobile();

  const expandCollapseButtons = (
    <>
      <Button
        size="sm"
        variant="outline"
        className="pointer-events-auto shrink-0 rounded-full bg-card/90 px-3 text-xs"
        onClick={onExpandAll}
      >
        <Maximize2 className="size-3.5" /> Expand all
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="pointer-events-auto shrink-0 rounded-full bg-card/90 px-3 text-xs"
        onClick={onCollapse}
      >
        <Minimize2 className="size-3.5" /> Collapse
      </Button>
    </>
  );

  const genPills = (
    <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => onGenChange(null)}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          gen === null
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/90 text-muted-foreground hover:border-primary/50",
        )}
      >
        All
      </button>
      {Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onGenChange(g)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            gen === g
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card/90 text-muted-foreground hover:border-primary/50",
          )}
        >
          G{g}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col gap-2 px-3 sm:left-4 sm:right-4 sm:top-4 sm:px-0">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <div className="pointer-events-auto shrink-0 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          {isMobile
            ? "Tap a name · arrow expands"
            : "Tap a name to open the profile · use the arrow to expand a branch"}
        </div>

        <div className="pointer-events-auto relative w-full min-w-[140px] max-w-[200px] shrink-0 sm:max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search…"
            className="h-8 rounded-full border-border bg-card/90 pl-8 text-xs backdrop-blur"
          />
        </div>

        {branches.length > 0 && (
          <BranchPicker branches={branches} value={branchPickerValue} onChange={onBranchChange} />
        )}

        {filtersActive && (
          <span className="pointer-events-auto shrink-0 text-xs text-muted-foreground">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </span>
        )}

        {filtersActive && (
          <Button
            size="sm"
            variant="outline"
            className="pointer-events-auto shrink-0 rounded-full bg-card/90 px-3 text-xs"
            onClick={onClearFilters}
          >
            Clear
          </Button>
        )}

        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="pointer-events-auto shrink-0 rounded-full bg-card/90 px-2"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExpandAll}>Expand all</DropdownMenuItem>
              <DropdownMenuItem onClick={onCollapse}>Collapse</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          expandCollapseButtons
        )}
      </div>

      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {genPills}
      </div>
    </div>
  );
}
