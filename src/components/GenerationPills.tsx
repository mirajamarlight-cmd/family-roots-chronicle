import { cn } from "@/lib/utils";

export function GenerationPills({
  maxGen,
  gen,
  onGenChange,
  className,
}: {
  maxGen: number;
  gen: number | null;
  onGenChange: (gen: number | null) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
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
}
