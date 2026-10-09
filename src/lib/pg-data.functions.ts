import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { assertPostgresConfigured, dataBackend } from "@/lib/data-backend";
import { buildGraph, type FamilyGraph, type Person } from "@/lib/family";
import { requirePgAdmin, requirePgAuth } from "@/lib/pg-auth.middleware";

function ensurePg() {
  if (dataBackend() !== "postgres") throw new Error("Requires DATA_BACKEND=postgres");
  assertPostgresConfigured();
}

export const pgFetchFamilyGraphFn = createServerFn({ method: "GET" }).handler(async () => {
  ensurePg();
  const { pgFetchPeople, pgFetchLinks, pgFetchMarriages } = await import("@/server/pg/family");
  const [people, links, marriages] = await Promise.all([
    pgFetchPeople(),
    pgFetchLinks(),
    pgFetchMarriages(),
  ]);
  const { resolvePhotoUrls } = await import("@/lib/person-photo");
  const withPhotos = await resolvePhotoUrls(people);
  return buildGraph(withPhotos, links, marriages) as FamilyGraph;
});

export const pgUpdatePersonDeceasedFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(
    z.object({
      id: z.string().uuid(),
      isDeceased: z.boolean(),
      deathDate: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { pgUpdatePersonDeceased } = await import("@/server/pg/family");
    await pgUpdatePersonDeceased(data.id, data.isDeceased, data.deathDate);
    return { ok: true as const };
  });

export const pgIsAdminFn = createServerFn({ method: "GET" })
  .middleware([requirePgAuth])
  .handler(async ({ context }) => {
    const { userId } = (context ?? {}) as { userId: string };
    const { pgIsAdmin } = await import("@/server/pg/family");
    return { isAdmin: await pgIsAdmin(userId) };
  });

export const pgClaimIndexFn = createServerFn({ method: "GET" })
  .middleware([requirePgAuth])
  .handler(async ({ context }) => {
    const { userId } = (context ?? {}) as { userId: string };
    const { pgPersonClaimIndex } = await import("@/server/pg/submissions");
    const map = await pgPersonClaimIndex(userId);
    return Array.from(map.entries());
  });

export const pgJoinStateFn = createServerFn({ method: "GET" })
  .middleware([requirePgAuth])
  .handler(async ({ context }) => {
    const { userId } = (context ?? {}) as { userId: string };
    const { pgFetchJoinState } = await import("@/server/pg/submissions");
    return pgFetchJoinState(userId);
  });

export const pgSubmitRecordFn = createServerFn({ method: "POST" })
  .middleware([requirePgAuth])
  .validator(z.record(z.unknown()))
  .handler(async ({ data, context }) => {
    const { userId } = (context ?? {}) as { userId: string };
    const { pgInsertSubmission } = await import("@/server/pg/submissions");
    try {
      await pgInsertSubmission(userId, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("one_pending_submission") || msg.includes("duplicate key")) {
        throw new Error("You already have a submission waiting for approval.");
      }
      throw err;
    }
    return { ok: true as const };
  });

export const pgPendingSubmissionsFn = createServerFn({ method: "GET" })
  .middleware([requirePgAdmin])
  .handler(async () => {
    const { pgFetchPendingSubmissions } = await import("@/server/pg/submissions");
    return pgFetchPendingSubmissions();
  });

export const pgRegisteredMembersFn = createServerFn({ method: "GET" })
  .middleware([requirePgAdmin])
  .handler(async () => {
    const { pgFetchRegisteredMembers } = await import("@/server/pg/submissions");
    return pgFetchRegisteredMembers();
  });

export const pgApproveSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = (context ?? {}) as { userId: string };
    const { pgApproveSubmission } = await import("@/server/pg/submissions");
    return { personId: await pgApproveSubmission(data.id, userId) };
  });

export const pgRejectSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = (context ?? {}) as { userId: string };
    const { pgRejectSubmission } = await import("@/server/pg/submissions");
    await pgRejectSubmission(data.id, userId);
    return { ok: true as const };
  });

export const pgPersonClaimFn = createServerFn({ method: "GET" })
  .middleware([requirePgAuth])
  .validator(z.object({ personId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId, isAdmin } = (context ?? {}) as { userId: string; isAdmin: boolean };
    const { pgFetchClaimForPerson } = await import("@/server/pg/submissions");
    const claim = await pgFetchClaimForPerson(data.personId);
    if (!claim) return null;
    if (!isAdmin && claim.user_id !== userId) return null;
    return claim;
  });

export const pgAdminInsertPersonFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(
    z.object({
      first_name: z.string(),
      middle_name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
      display_name: z.string(),
      gender: z.string().nullable().optional(),
      birth_date: z.string().nullable().optional(),
      death_date: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      parent_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { pgInsertPerson, pgInsertParentChild } = await import("@/server/pg/family");
    const id = await pgInsertPerson({
      first_name: data.first_name,
      middle_name: data.middle_name ?? null,
      last_name: data.last_name ?? null,
      display_name: data.display_name,
      gender: data.gender ?? null,
      birth_date: data.birth_date ?? null,
      death_date: data.death_date ?? null,
      notes: data.notes ?? null,
    });
    if (data.parent_id) {
      await pgInsertParentChild({ parent_id: data.parent_id, child_id: id });
    }
    return { id };
  });

export const pgAdminUpdatePersonFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(
    z.object({
      id: z.string().uuid(),
      patch: z.record(z.union([z.string(), z.boolean(), z.null()])),
    }),
  )
  .handler(async ({ data }) => {
    const { pgUpdatePerson } = await import("@/server/pg/family");
    await pgUpdatePerson(data.id, data.patch);
    return { ok: true as const };
  });

export const pgAdminDeletePersonFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { pgDeletePerson } = await import("@/server/pg/family");
    await pgDeletePerson(data.id);
    return { ok: true as const };
  });

export const pgAdminSetChildOrderFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(
    z.object({
      parentId: z.string().uuid(),
      orderedChildIds: z.array(z.string().uuid()),
    }),
  )
  .handler(async ({ data }) => {
    const { pgSetChildOrderForParent } = await import("@/server/pg/family");
    await pgSetChildOrderForParent(data.parentId, data.orderedChildIds);
    return { ok: true as const };
  });

export const pgAdminAddParentChildFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(
    z.object({
      parentId: z.string().uuid(),
      childId: z.string().uuid(),
      relationshipType: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { pgInsertParentChild } = await import("@/server/pg/family");
    await pgInsertParentChild({
      parent_id: data.parentId,
      child_id: data.childId,
      ...(data.relationshipType ? { relationship_type: data.relationshipType } : {}),
    });
    return { ok: true as const };
  });

export const pgAdminRemoveParentChildFn = createServerFn({ method: "POST" })
  .middleware([requirePgAdmin])
  .validator(z.object({ parentId: z.string().uuid(), childId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { pgDeleteParentChildPair } = await import("@/server/pg/family");
    await pgDeleteParentChildPair(data.parentId, data.childId);
    return { ok: true as const };
  });

export type { Person };
