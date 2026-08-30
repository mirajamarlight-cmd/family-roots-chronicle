import { useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, MapPin, Phone, UserPen } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { FamilyPlace } from "@/components/family-place";
import { PersonAvatarBadge } from "@/components/person-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";
import { fetchRegisteredMembers } from "@/lib/submissions";
import { formatRelativeTime } from "@/lib/utils";

function MemberCard({
  graph,
  claim,
  onOpen,
}: {
  graph: FamilyGraph;
  claim: Awaited<ReturnType<typeof fetchRegisteredMembers>>[number];
  onOpen: (personId: string) => void;
}) {
  const person = graph.byId.get(claim.person_id);
  if (!person) return null;
  const name = effectiveDisplayName(graph, claim.person_id);
  const gen = (graph.depthOf.get(claim.person_id) ?? 0) + 1;

  return (
    <article className="flex gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <PersonAvatarBadge graph={graph} personId={claim.person_id} size="md" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold leading-tight">{name}</h3>
            <p className="text-xs text-muted-foreground">
              G{gen} · joined {formatRelativeTime(claim.created_at)}
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => onOpen(claim.person_id)}>
            <UserPen className="size-3.5" aria-hidden />
            Edit in tree
          </Button>
        </div>
        <FamilyPlace graph={graph} personId={claim.person_id} compact />
        <div className="space-y-1 text-sm">
          {claim.address && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{claim.address}</span>
            </p>
          )}
          {claim.phone && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              <a href={`tel:${claim.phone}`} className="hover:text-foreground">
                {claim.phone}
              </a>
            </p>
          )}
          {claim.email && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <a href={`mailto:${claim.email}`} className="truncate hover:text-foreground">
                {claim.email}
              </a>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function AdminRegisteredMembers({ graph }: { graph: FamilyGraph }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const membersQuery = useQuery({
    queryKey: ["registered-members"],
    queryFn: fetchRegisteredMembers,
  });

  const filtered = useMemo(() => {
    const items = membersQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((claim) => {
      const haystack = [
        effectiveDisplayName(graph, claim.person_id),
        claim.address,
        claim.phone,
        claim.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [graph, membersQuery.data, query]);

  const openInTree = (personId: string) => {
    void navigate({ to: "/admin/tree", search: { person: personId } });
  };

  if (membersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading registered members…
      </div>
    );
  }

  const total = membersQuery.data?.length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/60 bg-card/40 px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">Registered members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} {total === 1 ? "person has" : "people have"} linked their account and contact details.
        </p>
        <div className="relative mt-4 max-w-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, address…"
            className="rounded-full bg-background pl-4"
            aria-label="Search registered members"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {total === 0
              ? "No one has registered yet. Approved join requests appear here."
              : "No members match your search."}
          </p>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-3">
            {filtered.map((claim) => (
              <MemberCard key={claim.user_id} graph={graph} claim={claim} onOpen={openInTree} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
