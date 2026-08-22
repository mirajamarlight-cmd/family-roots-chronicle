import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { RelationshipManager } from "@/components/RelationshipManager";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFamilyGraph, useIsAdmin } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import type { Person } from "@/lib/family";
import { lineageLabel } from "@/lib/family";
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

type Draft = {
  id?: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  birth_date: string;
  death_date: string;
  notes: string;
  parent_id: string;
};

const emptyDraft: Draft = {
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  birth_date: "",
  death_date: "",
  notes: "",
  parent_id: "",
};

function AdminPage() {
  const { isAdmin, userId, email, loading, refetch } = useIsAdmin();
  const { data: graph } = useFamilyGraph();
  const queryClient = useQueryClient();

  const [authEmail, setAuthEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");

  const people = useMemo(() => {
    if (!graph) return [];
    const q = filter.trim().toLowerCase();
    return graph.people.filter((p) => !q || p.display_name.toLowerCase().includes(q));
  }, [graph, filter]);

  const signIn = async (mode: "in" | "up") => {
    setBusy(true);
    const fn =
      mode === "in"
        ? supabase.auth.signInWithPassword({ email: authEmail, password })
        : supabase.auth.signUp({
            email: authEmail,
            password,
            options: { emailRedirectTo: window.location.origin + "/admin" },
          });
    const { error } = await fn;
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(mode === "in" ? "Signed in" : "Account created");
  };

  const claimAdmin = async () => {
    const { error } = await supabase.rpc("claim_admin");
    if (error) toast.error(error.message);
    else {
      toast.success("You are now an admin");
      refetch();
    }
  };

  const openEdit = (p: Person) => {
    setDraft({
      id: p.id,
      first_name: p.first_name,
      middle_name: p.middle_name ?? "",
      last_name: p.last_name ?? "",
      gender: p.gender ?? "",
      birth_date: p.birth_date ?? "",
      death_date: p.death_date ?? "",
      notes: p.notes ?? "",
      parent_id: graph?.parentsOf.get(p.id)?.[0] ?? "",
    });
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
    } else {
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
    }
    setBusy(false);
    setDraft(null);
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
        <Card className="mx-auto max-w-sm leaf-shadow">
          <CardHeader>
            <CardTitle className="font-display">Admin sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You don&apos;t need an account to browse the family tree — sign in only if you&apos;re
              maintaining records.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button onClick={() => signIn("in")} disabled={busy} className="flex-1">
                Sign in
              </Button>
              <Button
                variant="outline"
                onClick={() => signIn("up")}
                disabled={busy}
                className="flex-1"
              >
                Create account
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md space-y-4 text-center">
          <PageHeader title="No admin access" description={`Signed in as ${email}. If you are the family record keeper and no admin exists yet, you can claim the role.`} />
          <div className="flex justify-center gap-2">
            <Button onClick={claimAdmin}>Claim admin role</Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Admin"
        description={`Signed in as ${email}`}
        actions={
          <>
            <Button className="flex-1 sm:flex-none" onClick={() => setDraft({ ...emptyDraft })}>
              <Plus className="size-4" /> Add person
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </>
        }
      />

      {draft && (
        <Card className="mt-6 leaf-shadow">
          <CardHeader>
            <CardTitle className="font-display text-base">{draft.id ? "Edit person" : "New person"}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["first_name", "First name", "text"],
                ["middle_name", "Middle name", "text"],
                ["last_name", "Last name", "text"],
                ["gender", "Gender", "text"],
                ["birth_date", "Birth date", "date"],
                ["death_date", "Death date", "date"],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </div>
            ))}
            {!draft.id && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="parent">Parent</Label>
                <select
                  id="parent"
                  value={draft.parent_id}
                  onChange={(e) => setDraft({ ...draft, parent_id: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No parent (new root)</option>
                  {graph?.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} — {lineageLabel(graph, p.id)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:col-span-2">
              <Button onClick={save} disabled={busy}>
                Save
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {graph && <RelationshipManager graph={graph} />}

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter people"
        className="mt-6 w-full max-w-xs"
      />

      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card/80 leaf-shadow">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm">{p.display_name}</span>
            <span className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => openEdit(p)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(p)}>
                <Trash2 className="size-4" />
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
