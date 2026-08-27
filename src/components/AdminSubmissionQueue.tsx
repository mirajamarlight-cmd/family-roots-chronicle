import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FamilyPlace } from "@/components/family-place";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { FamilyGraph } from "@/lib/family";
import {
  approveSubmission,
  fetchPendingSubmissions,
  rejectSubmission,
  type PersonSubmission,
} from "@/lib/submissions";
import { formatRecordDate, formatRelativeTime } from "@/lib/utils";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p className="break-words text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

function personLine(
  first: string | null,
  middle: string | null,
  last: string | null,
  birth: string | null,
  death: string | null,
) {
  const name = [first, middle, last].filter(Boolean).join(" ");
  if (!name) return "";
  const bits = [
    birth ? `b. ${formatRecordDate(birth)}` : "",
    death ? `d. ${formatRecordDate(death)}` : "",
  ].filter(Boolean);
  return bits.length ? `${name} (${bits.join(", ")})` : name;
}

function approvePrompt(item: PersonSubmission, added: string, otherAdded: string) {
  const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(" ");
  const bits = [item.kind === "new" ? `add ${name} to the tree` : `update ${name}`];
  if (added) bits.push(`add ${added} as ${item.link_side ?? "parent"}`);
  if (otherAdded) bits.push(`add ${otherAdded} as ${item.link_side === "father" ? "mother" : "father"}`);
  return `Approve this? It will ${bits.join(", then ")}.`;
}

function SubmissionCard({
  graph,
  item,
  busyId,
  onApprove,
  onReject,
}: {
  graph: FamilyGraph;
  item: PersonSubmission;
  busyId: string | null;
  onApprove: (id: string, prompt: string) => void;
  onReject: (id: string) => void;
}) {
  const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(" ");
  const listedId = item.kind === "edit" ? item.person_id : item.parent_id ?? item.added_parent_of;
  const added = personLine(
    item.added_parent_first_name,
    item.added_parent_middle_name,
    item.added_parent_last_name,
    item.added_parent_birth_date,
    item.added_parent_death_date,
  );
  const otherAdded = personLine(
    item.other_parent_first_name,
    item.other_parent_middle_name,
    item.other_parent_last_name,
    item.other_parent_birth_date,
    item.other_parent_death_date,
  );
  const busy = busyId === item.id;

  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold">{name}</h3>
        <Badge variant={item.kind === "new" ? "default" : "secondary"}>
          {item.kind === "new" ? "New" : "Edit"}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</span>
      </div>
      {listedId && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.kind === "edit"
              ? "Place on the tree"
              : item.parent_id
                ? `Linked through ${item.link_side ?? "parent"}`
                : `Adding ${item.link_side ?? "parent"} under`}
          </p>
          <FamilyPlace graph={graph} personId={listedId} compact className="mt-1.5" />
        </div>
      )}
      {item.added_parent_of && item.added_parent_of !== listedId && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Adding {item.link_side ?? "parent"} under
          </p>
          <FamilyPlace graph={graph} personId={item.added_parent_of} compact className="mt-1.5" />
        </div>
      )}
      <div className="grid gap-1">
        <Field label="Birthday" value={formatRecordDate(item.birth_date)} />
        <Field label={`Adding ${item.link_side ?? "parent"}`} value={added} />
        <Field
          label={`Adding ${item.link_side === "father" ? "mother" : "father"}`}
          value={otherAdded}
        />
        <Field label="Other parent" value={otherAdded ? null : item.other_parent_name} />
      </div>
      <div className="grid gap-1 rounded-xl bg-secondary/40 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Contact (private)
        </p>
        <Field label="Address" value={item.address} />
        <Field label="Phone" value={item.phone} />
        <Field label="Email" value={item.email} />
      </div>
      <Field label="Note" value={item.notes} />
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onApprove(item.id, approvePrompt(item, added, otherAdded))}
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onReject(item.id)}>
          Reject
        </Button>
      </div>
    </article>
  );
}

export function AdminSubmissionQueue({
  graph,
  onApproved,
}: {
  graph: FamilyGraph;
  onApproved?: (personId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["pending-submissions"],
    queryFn: fetchPendingSubmissions,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "person_submissions" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
        void queryClient.invalidateQueries({ queryKey: ["family-graph"] });
        void queryClient.invalidateQueries({ queryKey: ["join-state"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const run = async (id: string, kind: "approve" | "reject") => {
    setBusyId(id);
    try {
      if (kind === "approve") {
        const personId = await approveSubmission(id);
        toast.success("Approved — now on the tree");
        await queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
        await queryClient.invalidateQueries({ queryKey: ["family-graph"] });
        await queryClient.invalidateQueries({ queryKey: ["person-claim"] });
        if (personId) onApproved?.(personId);
      } else {
        await rejectSubmission(id);
        toast.success("Rejected");
        await queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update submission");
    } finally {
      setBusyId(null);
    }
  };

  const items = query.data ?? [];
  if (query.isLoading) return <p className="px-4 py-3 text-sm text-muted-foreground">Loading submissions…</p>;
  if (!items.length) return null;

  return (
    <section className="shrink-0 border-b border-border/70 bg-primary/5 px-3 py-3 sm:px-4">
      <h2 className="font-display text-sm font-semibold">
        Waiting for approval ({items.length})
      </h2>
      <div className="mt-3 grid max-h-[min(28rem,50dvh)] gap-3 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <SubmissionCard
            key={item.id}
            graph={graph}
            item={item}
            busyId={busyId}
            onApprove={(id, prompt) => {
              if (!window.confirm(prompt)) return;
              void run(id, "approve");
            }}
            onReject={(id) => {
              if (!window.confirm("Reject this submission? They can send it again later.")) return;
              void run(id, "reject");
            }}
          />
        ))}
      </div>
    </section>
  );
}
