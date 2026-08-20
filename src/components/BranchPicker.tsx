import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string };

export function BranchPicker({
  branches,
  value,
  onChange,
  wholeFamilyLabel = "Whole family",
}: {
  branches: Branch[];
  value: string;
  onChange: (branchId: string) => void;
  wholeFamilyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => {
    if (!value) return wholeFamilyLabel;
    return `${branches.find((b) => b.id === value)?.name ?? "Unknown"}'s branch`;
  }, [branches, value, wholeFamilyLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Focus a branch"
          className="pointer-events-auto h-8 max-w-[11rem] shrink-0 justify-between rounded-full bg-card/90 px-3 text-xs font-normal sm:max-w-none"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search branches…" />
          <CommandList>
            <CommandEmpty>No branch found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={wholeFamilyLabel}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                {wholeFamilyLabel}
              </CommandItem>
              {branches.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`${b.name} ${b.name}'s branch`}
                  onSelect={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === b.id ? "opacity-100" : "opacity-0")} />
                  {b.name}&apos;s branch
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
