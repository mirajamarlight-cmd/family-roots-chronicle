import { createFileRoute } from "@tanstack/react-router";
import { MousePointerClick } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

import { AdminInspector } from "@/components/AdminInspector";
import { AdminPeopleTree } from "@/components/AdminPeopleTree";
import { FamilyAssistantChat } from "@/components/FamilyAssistantChat";
import { PageState } from "@/components/PageState";
import { useAdminPersonEditor } from "@/hooks/useAdminPersonEditor";
import { useFamilyGraph } from "@/hooks/useFamily";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  person: z.string().optional(),
});

export const Route = createFileRoute("/admin/tree")({
  validateSearch: searchSchema,
  component: AdminTreePage,
});

function AdminTreePage() {
  const { person: personFromUrl } = Route.useSearch();
  const { data: graph, isLoading: graphLoading } = useFamilyGraph();
  const isMobile = useIsMobile();
  const {
    busy,
    draft,
    selectedId,
    openPerson,
    patchDraft,
    persistDeceased,
    persistGender,
    startNew,
    closeEditor,
    save,
    remove,
  } = useAdminPersonEditor(graph);

  useEffect(() => {
    if (!personFromUrl || !graph?.byId.has(personFromUrl)) return;
    openPerson(personFromUrl);
  }, [personFromUrl, graph, openPerson]);

  const addLabel = selectedId ? "Add child" : "Add person";
  const editing = draft?.id ? graph?.byId.get(draft.id) : undefined;

  return (
    <div className="tree-page flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex min-h-0 flex-1 basis-0 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 basis-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-muted/10">
          {graphLoading && <PageState variant="loading" className="p-6" message="Loading family…" />}
          {graph && (
            <AdminPeopleTree
              graph={graph}
              selectedId={selectedId}
              onSelect={openPerson}
              onAddChild={startNew}
              onAddPerson={() => startNew(selectedId ?? "")}
              addPersonLabel={addLabel}
            />
          )}
        </div>

        {graph && draft && (
          <AdminInspector
            graph={graph}
            draft={draft}
            onDraftChange={patchDraft}
            onDeceasedChange={(next) => void persistDeceased(next)}
            onGenderChange={(next) => void persistGender(next)}
            onSave={() => void save()}
            onDelete={
              editing
                ? () => {
                    void remove(editing);
                  }
                : undefined
            }
            onClose={closeEditor}
            busy={busy}
          />
        )}

        {graph && !draft && !isMobile && (
          <aside
            aria-hidden
            className={cn(
              "hidden min-h-0 w-full max-w-[22rem] shrink-0 flex-col items-center justify-center gap-3 self-stretch overflow-hidden border-l border-border/60 bg-muted/20 px-6 text-center xl:flex xl:max-w-sm",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-border bg-card/80 text-muted-foreground">
              <MousePointerClick className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="font-display text-sm font-medium">Select someone to edit</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Click a name in the tree, or use Find someone to jump there. The + button on each row adds a child.
              </p>
            </div>
          </aside>
        )}
      </div>

      <FamilyAssistantChat selectedPersonId={selectedId} onOpenPerson={openPerson} />
    </div>
  );
}
