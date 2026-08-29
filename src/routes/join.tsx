import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AuthSignInCard } from "@/components/AuthSignInCard";
import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { FamilyPlace } from "@/components/family-place";
import { JoinRecordForm } from "@/components/JoinRecordForm";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import {
  duplicateNamesForResults,
  PersonSearchResults,
} from "@/components/PersonSearchResults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthSession, useFamilyGraph, useJoinState } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import { SITE_NAME } from "@/lib/brand";
import { effectiveDisplayName, recordedParents, searchPeople, type Person } from "@/lib/family";
import { draftFromPerson } from "@/lib/profile";
import { joinDraftUsesPatronymic } from "@/lib/submission-draft";
import {
  emptyDraft,
  fetchPersonClaimIndex,
  personClaimedByOther,
  submitRecord,
  type PersonSubmission,
  type SubmissionDraft,
} from "@/lib/submissions";
import { cn, formatRecordDate, formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: `Add yourself — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Sign in to add or update your place on the Feqi Yonis family tree. An admin reviews every submission.",
      },
      { property: "og:title", content: `Add yourself — ${SITE_NAME}` },
    ],
  }),
  component: JoinPage,
});

const STEPS = ["Account", "Find you", "Details", "Waiting"] as const;

function JoinSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex gap-1" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        return (
          <li
            key={label}
            aria-current={n === current ? "step" : undefined}
            className={cn(
              "flex-1 truncate rounded-full px-1.5 py-1 text-center text-[11px] font-medium",
              n === current
                ? "bg-primary text-primary-foreground"
                : n < current
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function JoinFrame({
  step,
  title,
  description,
  email,
  children,
}: {
  step: 1 | 2 | 3 | 4 | "done";
  title: string;
  description: string;
  email?: string | null;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        {step !== "done" && <JoinSteps current={step} />}
        <PageHeader title={title} description={description} className={step === "done" ? "" : "mt-5"} />
        {email && (
          <p className="mt-3 text-xs text-muted-foreground">
            Signed in as {email}
            {" · "}
            <button
              type="button"
              className="font-medium text-foreground hover:underline"
              onClick={() => void supabase.auth.signOut()}
            >
              Sign out
            </button>
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </AppShell>
  );
}

function pendingName(
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

function PendingBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 border-t border-border/70 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PendingSummary({
  pending,
  graph,
}: {
  pending: PersonSubmission;
  graph: ReturnType<typeof useFamilyGraph>["data"];
}) {
  const parent = pending.parent_id && graph ? graph.byId.get(pending.parent_id) : null;
  const addedUnder = pending.added_parent_of && graph ? graph.byId.get(pending.added_parent_of) : null;
  const added = pendingName(
    pending.added_parent_first_name,
    pending.added_parent_middle_name,
    pending.added_parent_last_name,
    pending.added_parent_birth_date,
    pending.added_parent_death_date,
  );
  const otherAdded = pendingName(
    pending.other_parent_first_name,
    pending.other_parent_middle_name,
    pending.other_parent_last_name,
    pending.other_parent_birth_date,
    pending.other_parent_death_date,
  );
  const otherSide = pending.link_side === "father" ? "mother" : "father";

  return (
    <ContentCard>
      <p className="text-sm font-medium">
        {pending.kind === "new" ? "New registration" : "Update to an existing record"}
      </p>
      <p className="mt-1 font-display text-lg font-semibold">
        {[pending.first_name, pending.middle_name, pending.last_name].filter(Boolean).join(" ")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Submitted {formatRelativeTime(pending.created_at)}
      </p>
      {pending.kind === "edit" && pending.person_id && graph && (
        <PendingBlock label="Place on the tree">
          <FamilyPlace graph={graph} personId={pending.person_id} />
        </PendingBlock>
      )}
      {parent && graph && (
        <PendingBlock label={`Linked through ${pending.link_side ?? "parent"}`}>
          <FamilyPlace graph={graph} personId={parent.id} />
        </PendingBlock>
      )}
      {added && (
        <PendingBlock label={`Adding ${pending.link_side ?? "parent"}`}>
          <p className="text-sm font-medium">{added}</p>
          {addedUnder && graph && <FamilyPlace graph={graph} personId={addedUnder.id} className="mt-2" />}
        </PendingBlock>
      )}
      {otherAdded && (
        <PendingBlock label={`Adding ${otherSide}`}>
          <p className="text-sm font-medium">{otherAdded}</p>
        </PendingBlock>
      )}
      {pending.other_parent_name && !otherAdded && (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Other parent: </span>
          {pending.other_parent_name}
        </p>
      )}
      <PendingBlock label="Your details">
        <p className="text-sm">Birthday {formatRecordDate(pending.birth_date)}</p>
        <p className="mt-1 text-sm">{pending.address}</p>
        <p className="mt-1 text-sm">{pending.phone}</p>
        <p className="mt-1 text-sm">{pending.email}</p>
        {pending.notes && <p className="mt-2 text-sm text-muted-foreground">{pending.notes}</p>}
      </PendingBlock>
      <Button asChild variant="outline" className="mt-5">
        <Link to="/tree">Browse the tree while you wait</Link>
      </Button>
    </ContentCard>
  );
}

function JoinPage() {
  const { userId, email, loading: authLoading } = useAuthSession();
  const { data: graph, isLoading: graphLoading, error, refetch } = useFamilyGraph();
  const queryClient = useQueryClient();
  const joinQuery = useJoinState(userId);
  const claimsQuery = useQuery({
    queryKey: ["person-claim-index"],
    enabled: !!userId,
    queryFn: fetchPersonClaimIndex,
    staleTime: 30_000,
  });

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = joinQuery.data?.pending ?? null;
  const claim = joinQuery.data?.claim ?? null;
  const claimIndex = claimsQuery.data;
  const submissionContext = useMemo(
    () => (userId && claimIndex ? { userId, claimsByPerson: claimIndex } : undefined),
    [userId, claimIndex],
  );

  useEffect(() => {
    setDraft(null);
    setQuery("");
  }, [userId]);

  const results = useMemo(
    () => (graph && query.trim() ? searchPeople(graph, query) : []),
    [graph, query],
  );
  const duplicateNames = useMemo(
    () => (graph ? duplicateNamesForResults(graph, results) : new Set<string>()),
    [graph, results],
  );

  const submit = async () => {
    if (!userId || !draft) return;
    setBusy(true);
    try {
      const payload =
        graph && joinDraftUsesPatronymic(graph, draft)
          ? { ...draft, middle_name: "", last_name: "" }
          : draft;
      await submitRecord(
        userId,
        payload,
        payload.person_id && graph ? recordedParents(graph, payload.person_id).length : 0,
        submissionContext,
      );
      toast.success("Sent for review. The tree will not change until an admin approves it.");
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["join-state", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <JoinFrame step={1} title="Add yourself" description="Checking whether you are signed in…">
        <PageState variant="loading" message="Starting…" />
      </JoinFrame>
    );
  }

  if (!userId) {
    return (
      <JoinFrame
        step={1}
        title="Add yourself"
        description="Enter your email and a password to continue. An admin still reviews your family details before they appear on the tree."
      >
        <AuthSignInCard redirectTo="/join" />
      </JoinFrame>
    );
  }

  if (joinQuery.isLoading || graphLoading) {
    return (
      <JoinFrame step={2} title="Add yourself" description="Loading the family record…" email={email}>
        <PageState variant="loading" message="Loading…" />
      </JoinFrame>
    );
  }

  if (error || joinQuery.error) {
    return (
      <JoinFrame
        step={2}
        title="Could not continue"
        description="We could not load the family record. Try again in a moment."
        email={email}
      >
        <PageState
          variant="error"
          onRetry={() => {
            void refetch();
            void joinQuery.refetch();
          }}
        />
      </JoinFrame>
    );
  }

  if (pending) {
    return (
      <JoinFrame
        step={4}
        title="Waiting for approval"
        description="The family record keeper will review this. The public tree stays as it is until they approve."
        email={email}
      >
        <PendingSummary pending={pending} graph={graph} />
      </JoinFrame>
    );
  }

  if (draft && graph) {
    const editingName =
      draft.person_id && graph ? effectiveDisplayName(graph, draft.person_id) : null;
    const claimedHere = !!claim && draft.person_id === claim.person_id;
    return (
      <JoinFrame
        step={3}
        title={draft.kind === "edit" ? `Update ${editingName ?? "your record"}` : "Your details"}
        description="You can add a parent who has passed if they are not listed yet. An admin reviews every change."
        email={email}
      >
        <JoinRecordForm
          graph={graph}
          draft={draft}
          onChange={setDraft}
          onSubmit={() => void submit()}
          onBack={() => setDraft(null)}
          lockedPerson={claimedHere}
          busy={busy}
          submissionContext={submissionContext}
        />
      </JoinFrame>
    );
  }

  if (claim && !draft) {
    return <Navigate to="/" replace />;
  }

  const searched = query.trim().length > 0;

  return (
    <JoinFrame
      step={2}
      title="Are you already on the tree?"
      description="Search your name. Same names exist — use the family path to pick the right person."
      email={email}
    >
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your name"
          aria-label="Search your name on the tree"
          className="rounded-full pl-9"
          autoFocus
        />
      </div>

      <div className="mt-4">
        {!searched && (
          <p className="text-sm text-muted-foreground">
            Start with your first name. If you are not listed, register as new below.
          </p>
        )}
        {graph && searched && results.length > 0 && (
          <ContentCard padding="sm" className="overflow-hidden p-0">
            <PersonSearchResults
              graph={graph}
              results={results}
              duplicateNames={duplicateNames}
              claimedByPerson={claimIndex}
              currentUserId={userId}
              onSelect={(id) => {
                if (personClaimedByOther(id, submissionContext)) {
                  toast.error("That person is already linked to another account.");
                  return;
                }
                const person = graph.byId.get(id);
                if (person) setDraft(draftFromPerson(person, email ?? "", claim));
              }}
              className="max-h-none py-0"
            />
          </ContentCard>
        )}
        {graph && searched && results.length === 0 && (
          <PageState
            variant="empty"
            message={`No relative matches “${query.trim()}”.`}
            hint="Check the spelling, or register as someone not yet on the tree."
          />
        )}
      </div>

      <div className="mt-5">
        {searched && results.length === 0 ? (
          <Button onClick={() => setDraft({ ...emptyDraft(email ?? ""), kind: "new" })}>
            Register as new
          </Button>
        ) : (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setDraft({ ...emptyDraft(email ?? ""), kind: "new" })}
          >
            I am not on the tree yet
          </button>
        )}
      </div>
    </JoinFrame>
  );
}
