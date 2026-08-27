import type { FamilyGraph } from "@/lib/family";

export const SITE_NAME = "Feqi Yonis Family Tree";
export const SITE_ORIGIN = "https://babafeqi.raafat.site";
export const YONIS_PORTRAIT_PATH = "/yonis.png";
export const SITE_LOGO_PATH = "/logo.png";

/** Portrait for a person, with a static fallback for the genealogical root Yonis. */
export function personPortraitUrl(graph: FamilyGraph, id: string): string | null {
  const person = graph.byId.get(id);
  if (!person) return null;
  if (person.photo_url) return person.photo_url;
  if (person.display_name === "Yonis" && !graph.parentsOf.has(id)) return YONIS_PORTRAIT_PATH;
  return null;
}
