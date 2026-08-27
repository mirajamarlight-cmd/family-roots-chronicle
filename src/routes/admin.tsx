import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminInspector, emptyPersonDraft, personToDraft, type PersonDraft } from "@/components/AdminInspector";
import { AdminPeopleTree } from "@/components/AdminPeopleTree";
import { AdminSubmissionQueue } from "@/components/AdminSubmissionQueue";
import { AppShell } from "@/components/AppShell";
import { AuthSignInCard } from "@/components/AuthSignInCard";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { Button } from "@/components/ui/button";
import { useFamilyGraph, useIsAdmin } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import type { Person } from "@/lib/family";
import { SITE_NAME } from "@/lib/brand";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Private administration area for maintaining the Feqi Yonis family tree.",
      },
      { property: "og:title", content: `Admin — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "Sign in to add, edit or remove family records.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, userId, email, loading, refetch } = useIsAdmin();
  const { data: graph, isLoading: graphLoading } = useFamilyGraph();
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectAfterLoad, setSelectAfterLoad] = useState<string | null>(null);

  const claimAdmin = async () => {
    const { error } = await supabase.rpc("claim_admin");
    if (error) toast.error(error.message);
    else {
      toast.success("You are now an admin");
      refetch();
    }
  };

  const openPerson = useCallback(
    (id: string) => {
      if (!graph) return;
      const p = graph.byId.get(id);
      if (!p) return;
      setSelectedId(id);
      setDraft((prev) => (prev?.id === id ? prev : personToDraft(p)));
    },
    [graph],
  );

  useEffect(() => {
    if (!selectAfterLoad || !graph?.byId.has(selectAfterLoad)) return;
    openPerson(selectAfterLoad);
    setSelectAfterLoad(null);
  }, [graph, selectAfterLoad, openPerson]);

  const startNew = (parentId: string) => {
    if (parentId) setSelectedId(parentId);
    setDraft({ ...emptyPersonDraft, parent_id: parentId });
  };

  const save = async () => {
    if (!draft || !draft.first_name.trim()) {
      toast.error("A first name is required");
      return;
    }
    setBusy(true);
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
      death_date: draft.death_date.trim() || null,
      notes: draft.notes.trim() || null,
    };

    if (draft.id) {
      const { error } = await supabase.from("people").update(payload).eq("id", draft.id);
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      setBusy(false);
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["family-graph"] });
      return;
    }

    const { data, error } = await supabase.from("people").insert(payload).select("id").single();
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Could not save");
      return;
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
    queryClient.invalidateQueries({ queryKey: ["family-graph"] });
  };

  const remove = async (p: Person) => {
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
      queryClient.invalidateQueries({ queryKey: ["family-graph"] });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageState variant="loading" message="Checking access…" />
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell>
        <AuthSignInCard
          title="Admin sign in"
          description="Sign in here only if you maintain the family record. Browsing the tree does not need an account."
          redirectTo="/admin"
          footer={
            <p className="text-center text-sm text-muted-foreground">
              Adding yourself to the tree?{" "}
              <Link to="/join" className="font-medium text-primary hover:underline">
                Start here
              </Link>
            </p>
          }
        />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md space-y-4 text-center">
          <PageHeader
            title="No admin access"
            description={`Signed in as ${email}. If you are adding yourself to the tree, use Join. If you are the family record keeper and no admin exists yet, you can claim the role.`}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/join">Add yourself</Link>
            </Button>
            <Button variant="outline" onClick={claimAdmin}>
              Claim admin role
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const selectedName = selectedId ? graph?.byId.get(selectedId)?.display_name : undefined;
  const addLabel = selectedName ? `Add child of ${selectedName}` : "Add person";
  const editing = draft?.id ? graph?.byId.get(draft.id) : undefined;

  return (
    <AppShell wide>
      <div className="tree-page flex flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold tracking-tight">Admin</h1>
            <p className="truncate text-xs text-muted-foreground">Signed in as {email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => startNew(selectedId ?? "")}
            >
              <Plus className="size-4" /> {addLabel}
            </Button>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        {graph && <AdminSubmissionQueue graph={graph} onApproved={setSelectAfterLoad} />}

        <div className="relative flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {graphLoading && <PageState variant="loading" className="p-6" message="Loading family…" />}
            {graph && (
              <AdminPeopleTree
                graph={graph}
                selectedId={selectedId}
                onSelect={openPerson}
                onAddChild={startNew}
              />
            )}
          </div>

          {graph && draft && (
            <AdminInspector
              graph={graph}
              draft={draft}
              onDraftChange={setDraft}
              onSave={() => void save()}
              onDelete={
                editing
                  ? () => {
                      void remove(editing);
                    }
                  : undefined
              }
              onClose={() => setDraft(null)}
              busy={busy}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
