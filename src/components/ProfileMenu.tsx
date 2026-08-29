import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, MapPin, Pencil, Phone, TreeDeciduous, User } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { JoinRecordForm } from "@/components/JoinRecordForm";
import { PersonAvatarBadge } from "@/components/person-identity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuthSession, useFamilyGraph, useJoinState } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import { effectiveDisplayName, recordedParents } from "@/lib/family";
import { draftFromPerson } from "@/lib/profile";
import { joinDraftUsesPatronymic } from "@/lib/submission-draft";
import { fetchPersonClaimIndex, submitRecord, type SubmissionDraft } from "@/lib/submissions";
import { cn } from "@/lib/utils";

const triggerClass =
  "group flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-all hover:bg-secondary/80 hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=open]:bg-primary/10 data-[state=open]:text-primary data-[state=open]:shadow-sm";

const menuItemClass =
  "group gap-3 rounded-xl px-3 py-2.5 text-foreground/90 cursor-pointer data-[highlighted]:bg-secondary/80";

function MenuAction({
  children,
  description,
  icon: Icon,
}: {
  children: ReactNode;
  description: string;
  icon: typeof Pencil;
}) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-data-[highlighted]:bg-primary group-data-[highlighted]:text-primary-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="font-medium leading-none">{children}</span>
        <span className="truncate text-xs text-muted-foreground">{description}</span>
      </span>
    </>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 pb-3.5">
      <div className="size-12 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

function ProfileHeader({
  graph,
  personId,
  email,
  address,
  phone,
}: {
  graph: NonNullable<ReturnType<typeof useFamilyGraph>["data"]>;
  personId: string;
  email: string | null;
  address: string | null;
  phone: string | null;
}) {
  const parents = recordedParents(graph, personId);

  return (
    <div className="border-b border-border/60 bg-gradient-to-b from-primary/10 via-secondary/30 to-transparent p-4 pb-3.5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-background p-0.5 shadow-sm ring-1 ring-border/70">
          <PersonAvatarBadge graph={graph} personId={personId} size="lg" showBadge={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            Your profile
          </p>
          <p className="truncate font-display text-base font-semibold leading-tight">
            {effectiveDisplayName(graph, personId)}
          </p>
          {parents.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
              {parents.map((p) => (
                <span key={p.id}>
                  <span className="opacity-60">{p.role}</span> {p.name}
                </span>
              ))}
            </p>
          )}
          {email && <p className="mt-2 truncate text-[11px] text-muted-foreground/80">{email}</p>}
        </div>
      </div>

      {(address || phone) && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Private contact
          </p>
          {address && (
            <p className="flex items-start gap-2 text-xs text-foreground/90">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 break-words">{address}</span>
            </p>
          )}
          {phone && (
            <p className="flex items-center gap-2 text-xs text-foreground/90">
              <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {phone}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProfileMenu({ className }: { className?: string }) {
  const { userId, email } = useAuthSession();
  const { data: graph } = useFamilyGraph();
  const queryClient = useQueryClient();
  const joinQuery = useJoinState(userId);
  const claimsQuery = useQuery({
    queryKey: ["person-claim-index"],
    enabled: !!userId,
    queryFn: fetchPersonClaimIndex,
    staleTime: 30_000,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const claim = joinQuery.data?.claim ?? null;
  const pending = joinQuery.data?.pending ?? null;
  const person = claim && graph ? graph.byId.get(claim.person_id) : null;
  const ready = !!(person && graph && claim);
  const submissionContext =
    userId && claimsQuery.data
      ? { userId, claimsByPerson: claimsQuery.data }
      : undefined;

  const openEdit = () => {
    if (!person || !claim) return;
    setDraft(draftFromPerson(person, email ?? "", claim));
    setEditOpen(true);
  };

  const submit = async () => {
    if (!userId || !draft || !graph) return;
    setBusy(true);
    try {
      const payload = joinDraftUsesPatronymic(graph, draft)
        ? { ...draft, middle_name: "", last_name: "" }
        : draft;
      await submitRecord(
        userId,
        payload,
        payload.person_id ? recordedParents(graph, payload.person_id).length : 0,
        submissionContext,
      );
      toast.success("Sent for review. The tree will not change until an admin approves it.");
      setEditOpen(false);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["join-state", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(triggerClass, className)}>
          {ready ? (
            <PersonAvatarBadge
              graph={graph}
              personId={person.id}
              size="sm"
              showBadge={false}
              className="ring-2 ring-transparent transition-[box-shadow] group-data-[state=open]:ring-primary/20"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary/80">
              <User className="size-4" aria-hidden />
            </span>
          )}
          <span className="hidden max-w-[6.5rem] truncate font-medium sm:inline">
            {ready ? person.first_name : "Profile"}
          </span>
          <span className="font-medium sm:hidden">Profile</span>
          <ChevronDown
            className="size-3.5 opacity-50 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/80 bg-card/95 p-0 leaf-shadow backdrop-blur-md"
        >
          {ready ? (
            <ProfileHeader
              graph={graph}
              personId={person.id}
              email={email}
              address={claim.address}
              phone={claim.phone}
            />
          ) : (
            <ProfileHeaderSkeleton />
          )}

          <div className="p-1.5">
            {person && (
              <DropdownMenuItem asChild className={menuItemClass}>
                <Link to="/tree" search={{ person: person.id }}>
                  <MenuAction icon={TreeDeciduous} description="Find your place in the family">
                    View on tree
                  </MenuAction>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={menuItemClass}
              onSelect={openEdit}
              disabled={!person || !!pending}
            >
              <MenuAction
                icon={Pencil}
                description={pending ? "A change is waiting for approval" : "Submit changes for review"}
              >
                {pending ? "Approval pending" : "Edit profile"}
              </MenuAction>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              className={cn(
                menuItemClass,
                "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",
              )}
              onSelect={() => {
                void supabase.auth.signOut();
              }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <LogOut className="size-4" aria-hidden />
              </span>
              <span className="font-medium">Sign out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {graph && draft && (
        <Sheet
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setDraft(null);
          }}
        >
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-y-auto border-l border-border/70 bg-background/95 p-0 sm:max-w-xl"
          >
            <div className="border-b border-border/60 bg-secondary/20 px-6 pb-5 pt-6 pr-14">
              <SheetHeader className="space-y-1.5 text-left">
                <SheetTitle className="font-display text-xl">Update your details</SheetTitle>
                <SheetDescription>
                  Changes are reviewed before they appear on the tree.
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="px-6 py-6">
              <JoinRecordForm
                graph={graph}
                draft={draft}
                onChange={setDraft}
                onSubmit={() => void submit()}
                lockedPerson
                busy={busy}
                submissionContext={submissionContext}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
