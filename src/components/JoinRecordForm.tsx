import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FamilyPlace } from "@/components/family-place";
import { PersonAvatarBadge } from "@/components/person-identity";
import { RelationshipPersonPicker } from "@/components/RelationshipPersonPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { recordedParents, type FamilyGraph } from "@/lib/family";
import {
  joinDraftUsesPatronymic,
  previewPatronymicForJoin,
  submissionProblem,
  type LinkSide,
  type ParentSource,
  type SubmissionContext,
  type SubmissionDraft,
} from "@/lib/submission-draft";
import { cn } from "@/lib/utils";

function Choice({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border bg-background",
      )}
    >
      {children}
    </button>
  );
}

function AddedPersonFields({
  prefix,
  whose,
  first,
  middle,
  last,
  birth,
  death,
  onChange,
}: {
  prefix: string;
  whose: string;
  first: string;
  middle: string;
  last: string;
  birth: string;
  death: string;
  onChange: (patch: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    birth_date?: string;
    death_date?: string;
  }) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{whose}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-first`}>
            First name <span className="text-muted-foreground">*</span>
          </Label>
          <Input
            id={`${prefix}-first`}
            autoComplete="off"
            autoCorrect="off"
            value={first}
            onChange={(e) => onChange({ first_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-middle`}>Middle name</Label>
          <Input
            id={`${prefix}-middle`}
            autoComplete="off"
            autoCorrect="off"
            value={middle}
            onChange={(e) => onChange({ middle_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-last`}>Last name</Label>
          <Input
            id={`${prefix}-last`}
            autoComplete="off"
            autoCorrect="off"
            value={last}
            onChange={(e) => onChange({ last_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-birth`}>Birthday</Label>
          <Input
            id={`${prefix}-birth`}
            type="date"
            value={birth}
            onChange={(e) => onChange({ birth_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${prefix}-death`}>Death date — if they have passed</Label>
          <Input
            id={`${prefix}-death`}
            type="date"
            value={death}
            onChange={(e) => onChange({ death_date: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function JoinRecordForm({
  graph,
  draft,
  onChange,
  onSubmit,
  onBack,
  lockedPerson,
  busy,
  submissionContext,
}: {
  graph: FamilyGraph;
  draft: SubmissionDraft;
  onChange: (draft: SubmissionDraft) => void;
  onSubmit: () => void;
  onBack?: (() => void) | undefined;
  lockedPerson?: boolean | undefined;
  busy: boolean;
  submissionContext?: SubmissionContext | undefined;
}) {
  const isNew = draft.kind === "new";
  const linkWord = draft.link_side === "mother" ? "mother" : draft.link_side === "father" ? "father" : "parent";
  const otherWord = draft.link_side === "mother" ? "father" : draft.link_side === "father" ? "mother" : "other parent";
  const picked = draft.person_id ? graph.byId.get(draft.person_id) : null;
  const existingParents = picked ? recordedParents(graph, picked.id) : [];
  const problem = submissionProblem(draft, existingParents.length, submissionContext);
  const usesPatronymic = joinDraftUsesPatronymic(graph, draft);
  const patronymicPreview = previewPatronymicForJoin(graph, draft);
  const [attempted, setAttempted] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (attempted && problem) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [attempted, problem]);

  const setLink = (value: LinkSide) =>
    onChange({
      ...draft,
      link_side: value,
      parent_id: null,
      parent_source: "",
      added_parent_of: null,
    });

  const error = attempted && problem && (
    <p ref={errorRef} role="alert" className="text-sm text-destructive">
      {problem}
    </p>
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setAttempted(true);
        if (problem) return;
        onSubmit();
      }}
    >
      {picked && (
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your place on the tree
          </p>
          <div className="flex items-start gap-3">
            <PersonAvatarBadge graph={graph} personId={picked.id} size="md" />
            <FamilyPlace graph={graph} personId={picked.id} className="min-w-0 flex-1" />
          </div>
          {onBack && !lockedPerson && (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onBack}>
              Not you? Pick someone else
            </button>
          )}
        </div>
      )}

      {isNew && (
        <fieldset className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
          <legend className="px-1 text-sm font-medium">How are you linked?</legend>
          <p className="text-sm text-muted-foreground">
            Name the parent who connects you to this family. If they have passed and are not listed, add them
            here.
          </p>
          <RadioGroup
            value={draft.link_side}
            onValueChange={(value) => setLink(value as LinkSide)}
            className="grid gap-2 sm:grid-cols-2"
          >
            {(
              [
                ["father", "Through my father"],
                ["mother", "Through my mother"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm transition-colors",
                  draft.link_side === value ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <RadioGroupItem value={value} id={`link-${value}`} />
                {label}
              </label>
            ))}
          </RadioGroup>

          {draft.link_side && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice
                checked={draft.parent_source === "listed"}
                onClick={() =>
                  onChange({ ...draft, parent_source: "listed" as ParentSource, added_parent_of: null })
                }
              >
                {`My ${linkWord} is already on the tree`}
              </Choice>
              <Choice
                checked={draft.parent_source === "add"}
                onClick={() => onChange({ ...draft, parent_source: "add", parent_id: null })}
              >
                {`Add my ${linkWord}`}
              </Choice>
            </div>
          )}

          {draft.link_side && draft.parent_source === "listed" && (
            <RelationshipPersonPicker
              graph={graph}
              label={`Your ${linkWord} on the tree *`}
              placeholder={`Find your ${linkWord}…`}
              personId={draft.parent_id}
              onSelect={(id) => onChange({ ...draft, parent_id: id })}
              onClear={() => onChange({ ...draft, parent_id: null })}
              inline
            />
          )}

          {draft.link_side && draft.parent_source === "add" && (
            <div className="space-y-3">
              <RelationshipPersonPicker
                graph={graph}
                label={`Who on the tree is your ${linkWord}’s parent? *`}
                placeholder="Find their parent on the tree…"
                personId={draft.added_parent_of}
                onSelect={(id) => onChange({ ...draft, added_parent_of: id })}
                onClear={() => onChange({ ...draft, added_parent_of: null })}
                inline
              />
              <AddedPersonFields
                prefix="added-parent"
                whose={`Your ${linkWord}`}
                first={draft.added_parent_first_name}
                middle={draft.added_parent_middle_name}
                last={draft.added_parent_last_name}
                birth={draft.added_parent_birth_date}
                death={draft.added_parent_death_date}
                onChange={(patch) =>
                  onChange({
                    ...draft,
                    added_parent_first_name: patch.first_name ?? draft.added_parent_first_name,
                    added_parent_middle_name: patch.middle_name ?? draft.added_parent_middle_name,
                    added_parent_last_name: patch.last_name ?? draft.added_parent_last_name,
                    added_parent_birth_date: patch.birth_date ?? draft.added_parent_birth_date,
                    added_parent_death_date: patch.death_date ?? draft.added_parent_death_date,
                  })
                }
              />
            </div>
          )}

          {draft.link_side && (
            <div className="space-y-3 border-t border-border/70 pt-3">
              <p className="text-sm font-medium">Your {otherWord}</p>
              <p className="text-sm text-muted-foreground">
                Optional. Add them to the tree, or leave a name for the record keeper.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  checked={draft.other_source === "skip"}
                  onClick={() => onChange({ ...draft, other_source: "skip" })}
                >
                  Name only, or skip
                </Choice>
                <Choice
                  checked={draft.other_source === "add"}
                  onClick={() => onChange({ ...draft, other_source: "add" })}
                >
                  {`Add my ${otherWord} to the tree`}
                </Choice>
              </div>
              {draft.other_source === "skip" && (
                <div className="space-y-1.5">
                  <Label htmlFor="other_parent_name">
                    {otherWord.charAt(0).toUpperCase() + otherWord.slice(1)}’s name{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="other_parent_name"
                    autoComplete="off"
                    value={draft.other_parent_name}
                    onChange={(e) => onChange({ ...draft, other_parent_name: e.target.value })}
                  />
                </div>
              )}
              {draft.other_source === "add" && (
                <AddedPersonFields
                  prefix="other-parent"
                  whose={`Your ${otherWord}`}
                  first={draft.other_parent_first_name}
                  middle={draft.other_parent_middle_name}
                  last={draft.other_parent_last_name}
                  birth={draft.other_parent_birth_date}
                  death={draft.other_parent_death_date}
                  onChange={(patch) =>
                    onChange({
                      ...draft,
                      other_parent_first_name: patch.first_name ?? draft.other_parent_first_name,
                      other_parent_middle_name: patch.middle_name ?? draft.other_parent_middle_name,
                      other_parent_last_name: patch.last_name ?? draft.other_parent_last_name,
                      other_parent_birth_date: patch.birth_date ?? draft.other_parent_birth_date,
                      other_parent_death_date: patch.death_date ?? draft.other_parent_death_date,
                    })
                  }
                />
              )}
            </div>
          )}
        </fieldset>
      )}

      {!isNew && picked && existingParents.length < 2 && (
        <fieldset className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
          <legend className="px-1 text-sm font-medium">Add a missing parent</legend>
          <p className="text-sm text-muted-foreground">
            If a parent is not on the tree — including if they have passed — you can add them here.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              checked={draft.parent_source !== "add"}
              onClick={() =>
                onChange({
                  ...draft,
                  parent_source: "",
                  link_side: "",
                  added_parent_of: null,
                  added_parent_first_name: "",
                  added_parent_middle_name: "",
                  added_parent_last_name: "",
                  added_parent_birth_date: "",
                  added_parent_death_date: "",
                })
              }
            >
              Not now
            </Choice>
            {(["father", "mother"] as const)
              .filter((side) => !existingParents.some((p) => p.role.toLowerCase() === side))
              .map((side) => (
                <Choice
                  key={side}
                  checked={draft.parent_source === "add" && draft.link_side === side}
                  onClick={() => onChange({ ...draft, parent_source: "add", link_side: side })}
                >
                  {`Add my ${side}`}
                </Choice>
              ))}
          </div>
          {draft.parent_source === "add" && draft.link_side && (
            <div className="space-y-3">
              {existingParents.length === 0 && (
                <RelationshipPersonPicker
                  graph={graph}
                  label={`Who on the tree is your ${linkWord}’s parent? *`}
                  placeholder="Find their parent on the tree…"
                  personId={draft.added_parent_of}
                  excludeId={draft.person_id}
                  onSelect={(id) => onChange({ ...draft, added_parent_of: id })}
                  onClear={() => onChange({ ...draft, added_parent_of: null })}
                  inline
                />
              )}
              <AddedPersonFields
                prefix="edit-added-parent"
                whose={`Your ${linkWord}`}
                first={draft.added_parent_first_name}
                middle={draft.added_parent_middle_name}
                last={draft.added_parent_last_name}
                birth={draft.added_parent_birth_date}
                death={draft.added_parent_death_date}
                onChange={(patch) =>
                  onChange({
                    ...draft,
                    added_parent_first_name: patch.first_name ?? draft.added_parent_first_name,
                    added_parent_middle_name: patch.middle_name ?? draft.added_parent_middle_name,
                    added_parent_last_name: patch.last_name ?? draft.added_parent_last_name,
                    added_parent_birth_date: patch.birth_date ?? draft.added_parent_birth_date,
                    added_parent_death_date: patch.death_date ?? draft.added_parent_death_date,
                  })
                }
              />
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
        <legend className="px-1 text-sm font-medium">Your details</legend>
        <p className="text-sm text-muted-foreground">
          Address, phone, and email appear on this person’s profile after an admin approves. Required
          fields are marked *.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">
              {usesPatronymic ? "Your first name" : "First name"}{" "}
              <span className="text-muted-foreground">*</span>
            </Label>
            <Input
              id="first_name"
              name="given-name"
              autoComplete="given-name"
              required
              value={draft.first_name}
              onChange={(e) => onChange({ ...draft, first_name: e.target.value })}
            />
          </div>
          {!usesPatronymic && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="middle_name">Middle name</Label>
                <Input
                  id="middle_name"
                  autoComplete="additional-name"
                  value={draft.middle_name}
                  onChange={(e) => onChange({ ...draft, middle_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  name="family-name"
                  autoComplete="family-name"
                  value={draft.last_name}
                  onChange={(e) => onChange({ ...draft, last_name: e.target.value })}
                />
              </div>
            </>
          )}
          {patronymicPreview && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              On the tree you will appear as{" "}
              <span className="font-medium text-foreground">{patronymicPreview}</span>.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">
              Birthday <span className="text-muted-foreground">*</span>
            </Label>
            <Input
              id="birth_date"
              name="bday"
              type="date"
              required
              value={draft.birth_date}
              onChange={(e) => onChange({ ...draft, birth_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">
              Address <span className="text-muted-foreground">*</span>
            </Label>
            <Input
              id="address"
              name="street-address"
              autoComplete="street-address"
              required
              value={draft.address}
              onChange={(e) => onChange({ ...draft, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Phone <span className="text-muted-foreground">*</span>
            </Label>
            <Input
              id="phone"
              name="tel"
              type="tel"
              autoComplete="tel"
              required
              value={draft.phone}
              onChange={(e) => onChange({ ...draft, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-email">
              Email <span className="text-muted-foreground">*</span>
            </Label>
            <Input
              id="join-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={draft.email}
              onChange={(e) => onChange({ ...draft, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Note for the record keeper</Label>
            <Textarea
              id="notes"
              value={draft.notes}
              onChange={(e) => onChange({ ...draft, notes: e.target.value })}
              placeholder="Anything that helps confirm who you are"
            />
          </div>
        </div>
      </fieldset>

      {error}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? "Submitting…" : "Submit for approval"}
        </Button>
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
            Back
          </Button>
        )}
      </div>
    </form>
  );
}
