import {
  ancestryPath,
  effectiveDisplayName,
  lineagePathLabel,
  recordedParents,
  type FamilyGraph,
} from "@/lib/family";
import { cn } from "@/lib/utils";

/** Name, path to the root (without repeating the name), and recorded parents. */
export function FamilyPlace({
  graph,
  personId,
  compact,
  className,
}: {
  graph: FamilyGraph;
  personId: string;
  compact?: boolean | undefined;
  className?: string | undefined;
}) {
  const person = graph.byId.get(personId);
  if (!person) return null;
  const pathLabel = lineagePathLabel(graph, personId);
  const parents = recordedParents(graph, personId);

  return (
    <span className={cn("block min-w-0", className)}>
      <span className={cn("block font-medium leading-snug", compact && "text-sm")}>
        {effectiveDisplayName(graph, personId)}
      </span>
      {pathLabel && (
        <span
          className={cn(
            "mt-0.5 block break-words leading-snug text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {pathLabel}
        </span>
      )}
      {parents.length > 0 && (
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {parents.map((p) => (
            <span key={p.id}>
              <span className="opacity-70">{p.role}</span> {p.name}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
