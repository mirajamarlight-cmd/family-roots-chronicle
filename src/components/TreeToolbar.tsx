import { Home, List, Maximize2, Minimize2, Network, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BranchPicker } from "@/components/BranchPicker";
import { GenerationPills } from "@/components/GenerationPills";
import { TreePersonSearch } from "@/components/TreePersonSearch";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FamilyGraph } from "@/lib/family";
import { cn } from "@/lib/utils";

const COACHMARK_KEY = "tree-coachmark-dismissed";

const chip =
  "shrink-0 rounded-full border border-border bg-card/90 backdrop-blur transition-colors";

type Props = {
  graph: FamilyGraph;
  rootLabel: string;
  branches: { id: string; name: string }[];
  branchPickerValue: string;
  onBranchChange: (branchId: string) => void;
  onSelectPerson: (id: string) => void;
  onHome: () => void;
  gen: number | null;
  onGenChange: (gen: number | null) => void;
  maxGen: number;
  matchCount: number;
  filtersActive: boolean;
  onClearFilters: () => void;
  onExpandAll: () => void;
  onCollapse: () => void;
  view: "canvas" | "list";
  onViewChange: (view: "canvas" | "list") => void;
};

export function TreeToolbar({
  graph,
  rootLabel,
  branches,
  branchPickerValue,
  onBranchChange,
  onSelectPerson,
  onHome,
  gen,
  onGenChange,
  maxGen,
  matchCount,
  filtersActive,
  onClearFilters,
  onExpandAll,
  onCollapse,
  view,
  onViewChange,
}: Props) {
  const isMobile = useIsMobile();
  const [showCoachmark, setShowCoachmark] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowCoachmark(localStorage.getItem(COACHMARK_KEY) !== "1");
  }, []);

  const dismissCoachmark = () => {
    localStorage.setItem(COACHMARK_KEY, "1");
    setShowCoachmark(false);
  };

  const pickView = (next: "canvas" | "list") => {
    onViewChange(next);
    setOptionsOpen(false);
  };

  const viewToggle = (
    <div className={cn(chip, "flex p-0.5 text-xs")} role="group" aria-label="View mode">
      <button
        type="button"
        onClick={() => pickView("canvas")}
        aria-pressed={view === "canvas"}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
          view === "canvas"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Network className="size-3.5" aria-hidden />
        Canvas
      </button>
      <button
        type="button"
        onClick={() => pickView("list")}
        aria-pressed={view === "list"}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
          view === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-3.5" aria-hidden />
        List
      </button>
    </div>
  );

  const expandCollapseButtons = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className={cn(chip, "text-xs")} onClick={onExpandAll}>
        <Maximize2 className="size-3.5" /> Expand all
      </Button>
      <Button size="sm" variant="outline" className={cn(chip, "text-xs")} onClick={onCollapse}>
        <Minimize2 className="size-3.5" /> Collapse
      </Button>
    </div>
  );

  const optionsBody = (
    <div className="space-y-4">
      {expandCollapseButtons}
      {branches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Focus a branch</p>
          <BranchPicker branches={branches} value={branchPickerValue} onChange={onBranchChange} />
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">View</p>
        {viewToggle}
      </div>
      {filtersActive && (
        <Button size="sm" variant="outline" className="w-full rounded-full text-xs" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );

  const homeButton = (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label="Home — back to Yonis"
      className={cn(chip, "size-9")}
      onClick={onHome}
    >
      <Home className="size-4" />
    </Button>
  );

  return (
    <div className="relative z-30 flex shrink-0 flex-col gap-2 px-3 pt-2 sm:px-4 sm:pt-3">
      {showCoachmark && (
        <div className="relative rounded-xl border border-border bg-card/95 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={dismissCoachmark}
            aria-label="Dismiss tip"
            className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
          <p className="pr-5">
            Search by name to jump to someone · tap a person for their profile · use the chevron to
            expand a branch · switch to List for accessible navigation
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 sm:hidden">
        {homeButton}
        <TreePersonSearch graph={graph} onSelectPerson={onSelectPerson} />
        {viewToggle}
        <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Tree options"
              className={cn(chip, "size-9")}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Tree options</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{optionsBody}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        {homeButton}
        <span className={cn(chip, "px-3 py-1.5 text-xs text-muted-foreground")}>
          Rooted at <span className="font-medium text-foreground">{rootLabel}</span>
        </span>
        <TreePersonSearch graph={graph} onSelectPerson={onSelectPerson} className="max-w-xs" />
        {viewToggle}
        {branches.length > 0 && (
          <BranchPicker branches={branches} value={branchPickerValue} onChange={onBranchChange} />
        )}
        {filtersActive && (
          <span className="text-xs text-muted-foreground">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </span>
        )}
        {filtersActive && (
          <Button size="sm" variant="outline" className={cn(chip, "px-3 text-xs")} onClick={onClearFilters}>
            Clear
          </Button>
        )}
        {expandCollapseButtons}
      </div>

      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <GenerationPills maxGen={maxGen} gen={gen} onGenChange={onGenChange} />
        {isMobile && filtersActive && (
          <span className="shrink-0 self-center text-xs text-muted-foreground">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </span>
        )}
      </div>
    </div>
  );
}
