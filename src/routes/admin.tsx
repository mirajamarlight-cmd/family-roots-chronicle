import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RelationshipManager } from "@/components/RelationshipManager";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFamilyGraph, useIsAdmin } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import type { Person } from "@/lib/family";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Yonis & Ahmed Family Record" },
      {
        name: "description",
        content: "Private administration area for maintaining the documented Yonis and Ahmed family records.",
      },
      { property: "og:title", content: "Admin — Yonis & Ahmed Family Record" },
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
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");

  const people = useMemo(() => {
    if (!graph) return [];
    const q = filter.trim().toLowerCase();
    return graph.people
      .filter((p) => !q || p.display_name.toLowerCase().includes(q))
      .slice(0, 100);
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
        const { error: linkError } = await supabase
          .from("parent_child")
          .insert({ parent_id: draft.parent_id, child_id: data.id, relationship_type: "biological" });
        if (linkError) toast.error(linkError.message);
      }
    }
    setBusy(false);
    setDraft(null);
    toast.success("Saved");
    queryClient.invalidateQueries({ queryKey: ["family-graph"] });
  };

  const remove = async (p: Person) => {
    if (!window.confirm(`Remove ${p.display_name} from the record?`)) return;
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking access…
        </p>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-sm">
          <CardHeader>
            <CardTitle>Admin sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
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
          <h1 className="font-display text-2xl font-semibold">No admin access</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {email}. If you are the family record keeper and no admin exists yet, you
            can claim the role.
          </p>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {email}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="size-4" /> Add person
          </Button>
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      {draft && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{draft.id ? "Edit person" : "New person"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["first_name", "First name"],
                ["middle_name", "Middle name"],
                ["last_name", "Last name"],
                ["gender", "Gender"],
                ["birth_date", "Birth date (YYYY-MM-DD)"],
                ["death_date", "Death date (YYYY-MM-DD)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
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
                      {p.display_name}
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
            <div className="flex gap-2 sm:col-span-2">
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
        className="mt-6 max-w-xs"
      />


      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card/70">
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
