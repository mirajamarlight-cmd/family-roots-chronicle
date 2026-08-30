import type { FamilyGraph } from "@/lib/family";
import { personPortraitUrl } from "@/lib/brand";
import { branchColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { root: "size-8 text-xs", badge: "text-[9px] px-1 py-px -bottom-0.5 -right-0.5" },
  md: { root: "size-10 text-sm", badge: "text-[9px] px-1 py-px -bottom-0.5 -right-0.5" },
  lg: { root: "size-16 text-xl", badge: "text-[10px] px-1.5 py-px -bottom-0.5 -right-0.5" },
  xl: { root: "size-16 text-2xl", badge: "text-[10px] px-1.5 py-px -bottom-0.5 -right-0.5" },
} as const;

export function GenerationBadge({
  generation,
  branchKey,
  className,
  size = "md",
}: {
  generation: number;
  branchKey: string;
  className?: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={cn(
        "rounded-full font-bold tracking-wide text-white",
        SIZE[size].badge,
        className,
      )}
      style={{ backgroundColor: branchColor(branchKey) }}
    >
      G{generation}
    </span>
  );
}

export function PersonAvatarBadge({
  graph,
  personId,
  size = "md",
  className,
  showBadge = true,
}: {
  graph: FamilyGraph;
  personId: string;
  size?: keyof typeof SIZE;
  className?: string;
  showBadge?: boolean;
}) {
  const person = graph.byId.get(personId);
  if (!person) return null;

  const photoUrl = personPortraitUrl(graph, personId);
  const branchKey = graph.branchOf.get(personId) ?? person.display_name;
  const generation = (graph.depthOf.get(personId) ?? 0) + 1;
  const initial = person.first_name?.slice(0, 1) || person.display_name.slice(0, 1);

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className={cn("rounded-full border border-border object-cover", SIZE[size].root)}
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full border border-border font-display font-semibold text-white",
            SIZE[size].root,
          )}
          style={{ backgroundColor: branchColor(branchKey) }}
          aria-hidden
        >
          {initial.toUpperCase()}
        </span>
      )}
      {showBadge && (
        <GenerationBadge
          generation={generation}
          branchKey={branchKey}
          size={size}
          className="absolute border border-card"
        />
      )}
    </span>
  );
}

export function BirthOrderBadge({
  order,
  className,
}: {
  order: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/80 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground",
        className,
      )}
      aria-label={`Family order ${order}`}
      title={`Birth order: ${order}`}
    >
      {order}
    </span>
  );
}
