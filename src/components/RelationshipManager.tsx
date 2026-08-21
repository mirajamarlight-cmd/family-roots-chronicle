import { useQueryClient } from "@tanstack/react-query";
import { Link2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FamilyGraph } from "@/lib/family";
import { lineageLabel, siblingsOf } from "@/lib/family";
import {
  addParentChild,
  addSibling,
  removeParentChild,
  validateParentChild,
  validateSibling,
} from "@/lib/relationships";

function PersonSelect({
  id,
  value,
  onChange,
  graph,
  exclude,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  graph: FamilyGraph;
  exclude?: string;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const query = q.trim().toLowerCase();
    return graph.people
      .filter((p) => p.id !== exclude && (!query || p.display_name.toLowerCase().includes(query)))
      .slice(0, 200);
  }, [graph, q, exclude]);

  return (
    <div className="space-y-1.5">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to filter names"
        aria-label="Filter people"
      />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name} — {lineageLabel(graph, p.id)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RelationshipManager({ graph }: { graph: FamilyGraph }) {
  const queryClient = useQueryClient();
  const [personId, setPersonId] = useState("");
  const [newParent, setNewParent] = useState("");
  const [newChild, setNewChild] = useState("");
  const [newSibling, setNewSibling] = useState("");
  const [busy, setBusy] = useState(false);

  const person = personId ? graph.byId.get(personId) : undefined;
  const parents = person ? (graph.parentsOf.get(person.id) ?? []) : [];
  const children = person ? (graph.childrenOf.get(person.id) ?? []) : [];
  const siblings = person ? siblingsOf(graph, person.id) : [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family-graph"] });

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the relationship");
    } finally {
      setBusy(false);
    }
  };

  const attachParent = () => {
    const check = validateParentChild(graph, newParent, personId);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    void run(async () => {
      await addParentChild(newParent, personId);
      setNewParent("");
    }, "Parent linked");
  };

  const attachChild = () => {
    const check = validateParentChild(graph, personId, newChild);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    void run(async () => {
      await addParentChild(personId, newChild);
      setNewChild("");
    }, "Child linked");
  };

  const attachSibling = () => {
    const check = validateSibling(graph, personId, newSibling);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    void run(async () => {
      await addSibling(graph, personId, newSibling);
      setNewSibling("");
    }, "Sibling linked");
  };

  const detach = (parentId: string, childId: string) =>
    run(() => removeParentChild(parentId, childId), "Link removed");

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4" /> Relationships
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="rel-person">Person</Label>
          <PersonSelect
            id="rel-person"
            value={personId}
            onChange={(v) => {
              setPersonId(v);
              setNewParent("");
              setNewChild("");
              setNewSibling("");
            }}
            graph={graph}
            placeholder="Select a person"
          />
        </div>

        {person && (
          <div className="grid gap-5 md:grid-cols-3">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Parents ({parents.length}/2)</h3>
              <ul className="space-y-1">
                {parents.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{graph.byId.get(id)?.display_name ?? "Unknown"}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove parent link"
                      disabled={busy}
                      onClick={() => detach(id, person.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
                {parents.length === 0 && (
                  <li className="text-sm text-muted-foreground">No recorded parent.</li>
                )}
              </ul>
              {parents.length < 2 && (
                <>
                  <PersonSelect
                    id="rel-parent"
                    value={newParent}
                    onChange={setNewParent}
                    graph={graph}
                    exclude={person.id}
                    placeholder="Add a parent…"
                  />
                  <Button size="sm" onClick={attachParent} disabled={busy || !newParent}>
                    Link parent
                  </Button>
                </>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Children ({children.length})</h3>
              <ul className="space-y-1">
                {children.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{graph.byId.get(id)?.display_name ?? "Unknown"}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove child link"
                      disabled={busy}
                      onClick={() => detach(person.id, id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
                {children.length === 0 && (
                  <li className="text-sm text-muted-foreground">No recorded child.</li>
                )}
              </ul>
              <PersonSelect
                id="rel-child"
                value={newChild}
                onChange={setNewChild}
                graph={graph}
                exclude={person.id}
                placeholder="Add a child…"
              />
              <Button size="sm" onClick={attachChild} disabled={busy || !newChild}>
                Link child
              </Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Siblings ({siblings.length})</h3>
              <ul className="space-y-1">
                {siblings.map((id) => (
                  <li key={id} className="text-sm">
                    {graph.byId.get(id)?.display_name ?? "Unknown"}
                  </li>
                ))}
                {siblings.length === 0 && (
                  <li className="text-sm text-muted-foreground">No recorded sibling.</li>
                )}
              </ul>
              {parents.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add a parent first — siblings are recorded through shared parents.
                </p>
              ) : (
                <>
                  <PersonSelect
                    id="rel-sibling"
                    value={newSibling}
                    onChange={setNewSibling}
                    graph={graph}
                    exclude={person.id}
                    placeholder="Add a sibling…"
                  />
                  <Button size="sm" onClick={attachSibling} disabled={busy || !newSibling}>
                    Link sibling
                  </Button>
                </>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
