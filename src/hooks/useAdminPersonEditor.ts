import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { emptyPersonDraft, personToDraft, type PersonDraft } from "@/components/AdminInspector";
import { supabase } from "@/integrations/supabase/client";
import type { FamilyGraph, Person } from "@/lib/family";
import { personIsDeceased, updatePersonDeceased } from "@/lib/family";

export function useAdminPersonEditor(graph: FamilyGraph | undefined) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const draftDirtyRef = useRef(false);

  const openPerson = useCallback(
    (id: string) => {
      if (!graph) return;
      const p = graph.byId.get(id);
      if (!p) return;
      setSelectedId(id);
      setDraft((prev) => {
        if (prev?.id === id && draftDirtyRef.current) return prev;
        draftDirtyRef.current = false;
        return personToDraft(p);
      });
    },
    [graph],
  );

  const patchDraft = useCallback((next: PersonDraft) => {
    draftDirtyRef.current = true;
    setDraft(next);
  }, []);

  const persistDeceased = useCallback(
    async (next: PersonDraft) => {
      patchDraft(next);
      if (!next.id) return;
      setBusy(true);
      const result = await updatePersonDeceased(
        next.id,
        next.is_deceased,
        next.death_date.trim() || null,
      );
      setBusy(false);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      draftDirtyRef.current = false;
      toast.success(next.is_deceased ? "Marked as deceased" : "Marked as living");
      void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
    },
    [patchDraft, queryClient],
  );

  const startNew = useCallback((parentId: string) => {
    if (parentId) setSelectedId(parentId);
    setDraft({ ...emptyPersonDraft, parent_id: parentId });
  }, []);

  const closeEditor = useCallback(() => setDraft(null), []);

  const save = useCallback(async () => {
    if (!draft || !draft.first_name.trim()) {
      toast.error("A first name is required");
      return;
    }
    setBusy(true);
    const death_date = draft.is_deceased ? draft.death_date.trim() || null : null;
    const payload = {
      first_name: draft.first_name.trim(),
      middle_name: draft.middle_name.trim() || null,
      last_name: draft.last_name.trim() || null,
      display_name: [draft.first_name, draft.middle_name, draft.last_name]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" "),
      gender: draft.gender.trim() || null,
      birth_date: draft.birth_date.trim() || null,
      death_date,
      notes: draft.notes.trim() || null,
    };

    if (draft.id) {
      const { error } = await supabase.from("people").update(payload).eq("id", draft.id);
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      const deceasedResult = await updatePersonDeceased(
        draft.id,
        draft.is_deceased,
        draft.death_date.trim() || null,
      );
      if (!deceasedResult.ok) {
        setBusy(false);
        toast.error(deceasedResult.message);
        return;
      }
      setBusy(false);
      draftDirtyRef.current = false;
      setDraft({
        ...draft,
        death_date: death_date ?? "",
        is_deceased: personIsDeceased({ is_deceased: draft.is_deceased, death_date }),
      });
      toast.success("Saved");
      void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
      return;
    }

    const { data, error } = await supabase.from("people").insert(payload).select("id").single();
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Could not save");
      return;
    }
    if (draft.is_deceased) {
      const deceasedResult = await updatePersonDeceased(
        data.id,
        true,
        draft.death_date.trim() || null,
      );
      if (!deceasedResult.ok) {
        setBusy(false);
        toast.error(deceasedResult.message);
        return;
      }
    }
    if (draft.parent_id) {
      const { error: linkError } = await supabase.from("parent_child").insert({
        parent_id: draft.parent_id,
        child_id: data.id,
        relationship_type: "biological",
      });
      if (linkError) toast.error(linkError.message);
    }
    setBusy(false);
    setSelectedId(data.id);
    setDraft({ ...draft, id: data.id, parent_id: "" });
    toast.success("Saved");
    void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
  }, [draft, queryClient]);

  const remove = useCallback(
    async (p: Person) => {
      if (!graph) return;
      const childCount = graph.childrenOf.get(p.id)?.length ?? 0;
      const parentCount = graph.parentsOf.get(p.id)?.length ?? 0;
      const spouseCount = graph.spousesOf.get(p.id)?.length ?? 0;
      const relCount = childCount + parentCount + spouseCount;
      const parts: string[] = [];
      if (childCount) parts.push(`${childCount} child${childCount === 1 ? "" : "ren"}`);
      if (parentCount) parts.push(`${parentCount} parent${parentCount === 1 ? "" : "s"}`);
      if (spouseCount) parts.push(`${spouseCount} spouse${spouseCount === 1 ? "" : "s"}`);
      const relDetail =
        relCount > 0
          ? ` This will also delete ${relCount} recorded relationship${relCount === 1 ? "" : "s"} (${parts.join(", ")}) and cannot be undone.`
          : "";
      if (!window.confirm(`Remove ${p.display_name}?${relDetail}`)) return;
      const { error } = await supabase.from("people").delete().eq("id", p.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Removed");
        if (selectedId === p.id) setSelectedId(null);
        if (draft?.id === p.id) setDraft(null);
        void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
      }
    },
    [graph, draft?.id, queryClient, selectedId],
  );

  return {
    busy,
    draft,
    selectedId,
    openPerson,
    patchDraft,
    persistDeceased,
    startNew,
    closeEditor,
    save,
    remove,
  };
}
