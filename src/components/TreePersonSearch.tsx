import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  duplicateNamesForResults,
  PersonSearchResults,
} from "@/components/PersonSearchResults";
import { Input } from "@/components/ui/input";
import type { FamilyGraph } from "@/lib/family";
import { searchPeople } from "@/lib/family";
import { cn } from "@/lib/utils";

export function TreePersonSearch({
  graph,
  onSelectPerson,
  className,
  inputClassName,
  inline = false,
  placeholder = "Find someone…",
}: {
  graph: FamilyGraph;
  onSelectPerson: (id: string) => void;
  className?: string;
  inputClassName?: string;
  inline?: boolean | undefined;
  placeholder?: string | undefined;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(
    () => (debounced.trim() ? searchPeople(graph, debounced, 12) : []),
    [graph, debounced],
  );
  const duplicateNames = duplicateNamesForResults(graph, results);
  const showDropdown = open && debounced.trim().length > 0;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (id: string) => {
    setQuery("");
    setDebounced("");
    setOpen(false);
    onSelectPerson(id);
  };

  return (
    <div ref={wrapRef} className={cn("pointer-events-auto relative min-w-0 flex-1", className)}>
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label="Search family members"
        aria-expanded={showDropdown}
        aria-controls="tree-person-search-results"
        className={cn(
          "h-9 rounded-full border-border bg-card/90 pl-8 text-sm backdrop-blur",
          inputClassName,
        )}
      />
      {showDropdown && (
        <div
          id="tree-person-search-results"
          className={cn(
            "pointer-events-auto z-50 overflow-hidden rounded-lg border border-border bg-card shadow-lg",
            inline ? "mt-1" : "absolute inset-x-0 top-[calc(100%+0.25rem)]",
          )}
        >
          <PersonSearchResults
            graph={graph}
            results={results}
            duplicateNames={duplicateNames}
            onSelect={pick}
          />
        </div>
      )}
    </div>
  );
}
