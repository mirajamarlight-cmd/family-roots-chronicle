import { supabase } from "@/integrations/supabase/client";
import type { Person } from "@/lib/family";

export const PERSON_PHOTO_BUCKET = "person-photos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // one week
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Stored values may be a storage object path or a full external URL. */
export function isStoragePath(value: string | null | undefined): value is string {
  if (!value) return false;
  return !/^(https?:)?\/\//.test(value) && !value.startsWith("/");
}

/** Replace stored storage paths with temporary viewable links. */
export async function resolvePhotoUrls(people: Person[]): Promise<Person[]> {
  const paths = Array.from(
    new Set(people.map((p) => p.photo_url).filter((v): v is string => isStoragePath(v))),
  );
  if (paths.length === 0) return people.map((p) => ({ ...p, photo_path: p.photo_url ?? null }));

  const signed = new Map<string, string>();
  const { data } = await supabase.storage
    .from(PERSON_PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }

  return people.map((p) => ({
    ...p,
    photo_path: p.photo_url ?? null,
    photo_url: isStoragePath(p.photo_url) ? (signed.get(p.photo_url) ?? null) : p.photo_url,
  }));
}

function extensionFor(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()! : "";
  const ext = (fromName || file.type.split("/")[1] || "jpg").toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "") || "jpg";
}

export async function uploadPersonPhoto(
  personId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Choose an image file (JPG, PNG or WebP)." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: "That photo is larger than 5 MB. Please pick a smaller one." };
  }

  const path = `${personId}/${Date.now()}.${extensionFor(file)}`;
  const upload = await supabase.storage
    .from(PERSON_PHOTO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
  if (upload.error) return { ok: false, message: upload.error.message };

  const { error } = await supabase.from("people").update({ photo_url: path }).eq("id", personId);
  if (error) {
    await supabase.storage.from(PERSON_PHOTO_BUCKET).remove([path]);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function removePersonPhoto(
  personId: string,
  storedPath: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("people").update({ photo_url: null }).eq("id", personId);
  if (error) return { ok: false, message: error.message };
  if (isStoragePath(storedPath)) {
    await supabase.storage.from(PERSON_PHOTO_BUCKET).remove([storedPath]);
  }
  return { ok: true };
}
