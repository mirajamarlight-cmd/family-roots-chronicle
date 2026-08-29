import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { pathWithinRoot, type FamilyGraph } from "@/lib/family";

export function TreeBreadcrumbs({
  graph,
  rootId,
  focusId,
  onFocus,
}: {
  graph: FamilyGraph;
  rootId: string;
  focusId: string;
  onFocus: (id: string) => void;
}) {
  const path = pathWithinRoot(graph, rootId, focusId);
  if (path.length <= 1) return null;

  return (
    <Breadcrumb className="pointer-events-auto min-w-0 max-w-full">
      <BreadcrumbList className="flex-nowrap overflow-x-auto text-xs sm:text-sm">
        {path.map((person, index) => {
          const isLast = index === path.length - 1;
          return (
            <span key={person.id} className="contents">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="shrink-0">
                {isLast ? (
                  <BreadcrumbPage>{person.first_name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={() => onFocus(person.id)}>
                      {person.first_name}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
