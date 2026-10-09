import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TreeNameFilter({
  value,
  onChange,
  className,
  placeholder = "Search names…",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("pointer-events-auto relative min-w-0 flex-1", className)}>
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search names in the tree"
        className="h-9 rounded-full border-border bg-card/90 pl-8 text-sm backdrop-blur"
      />
    </div>
  );
}
