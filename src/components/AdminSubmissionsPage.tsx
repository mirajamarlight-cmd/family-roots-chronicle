import { useNavigate } from "@tanstack/react-router";
import { Inbox, Loader2 } from "lucide-react";

import { useAdminSubmissions } from "@/hooks/useAdminSubmissions";
import type { FamilyGraph } from "@/lib/family";
import type { PersonSubmission } from "@/lib/submissions";
import { formatRecordDate, formatRelativeTime } from "@/lib/utils";

import { FamilyPlace } from "@/components/family-place";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-base font-semibold leading-tight">{name}</h3>
          <p className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
        </div>
        <Badge variant={item.kind === "new" ? "default" : "secondary"} className="shrink-0 rounded-full">
          {item.kind === "new" ? "New" : "Edit"}
        </Badge>
      </div>
      {listedId && (
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">
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
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            Adding {item.link_side ?? "parent"} under
          </p>
          <FamilyPlace graph={graph} personId={item.added_parent_of} compact className="mt-1.5" />
        </div>
      )}
      <div className="grid gap-1 text-sm">
        <Field label="Birthday" value={formatRecordDate(item.birth_date)} />
        <Field label={`Adding ${item.link_side ?? "parent"}`} value={added} />
        <Field
          label={`Adding ${item.link_side === "father" ? "mother" : "father"}`}
          value={otherAdded}
        />
        <Field label="Other parent" value={otherAdded ? null : item.other_parent_name} />
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
        <p className="text-[11px] font-medium text-muted-foreground">Contact (private)</p>
        <div className="mt-1 grid gap-0.5">
          <Field label="Address" value={item.address} />
          <Field label="Phone" value={item.phone} />
          <Field label="Email" value={item.email} />
        </div>
      </div>
      <Field label="Note" value={item.notes} />
      <div className="mt-auto flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 rounded-full"
          disabled={busy}
          onClick={() => onApprove(item.id, approvePrompt(item, added, otherAdded))}
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Approve
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => onReject(item.id)}>
          Reject
        </Button>
      </div>
    </article>
  );
}

export function AdminSubmissionsPage({ graph }: { graph: FamilyGraph }) {
  const navigate = useNavigate();
  const { items, isLoading, busyId, approve, reject } = useAdminSubmissions((personId) => {
    void navigate({ to: "/admin/tree", search: { person: personId } });
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/60 bg-amber-500/5 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Inbox className="size-5 text-amber-700 dark:text-amber-400" aria-hidden />
          <h1 className="font-display text-xl font-semibold tracking-tight">Pending approvals</h1>
          {items.length > 0 && <Badge className="rounded-full">{items.length}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Review join requests before they appear on the public tree.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading submissions…
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <Inbox className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
            <p className="mt-4 font-display text-base font-medium">All caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">No submissions waiting for approval.</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <SubmissionCard
                key={item.id}
                graph={graph}
                item={item}
                busyId={busyId}
                onApprove={approve}
                onReject={reject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
