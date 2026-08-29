import { Badge } from "@/components/ui/badge";
import { DECEASED_LABEL, DECEASED_PHRASE } from "@/lib/family";
import { cn } from "@/lib/utils";

export function DeceasedBadge({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="destructive"
      title={DECEASED_PHRASE}
      className={cn(
        "border-destructive/30 bg-destructive/90 px-1.5 py-0 font-medium text-destructive-foreground shadow-none",
        compact ? "text-[9px] leading-tight" : "text-[11px] leading-snug",
        className,
      )}
    >
      {compact ? DECEASED_LABEL : DECEASED_PHRASE}
    </Badge>
  );
}
