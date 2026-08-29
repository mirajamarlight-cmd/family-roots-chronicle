import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { formatEthiopianDate } from "./ethiopian-calendar.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Calendar date from YYYY-MM-DD (or ISO), e.g. "12 Mar 1990". */
export function formatRecordDate(value: string | null | undefined) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function parseIsoParts(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Whole years between two calendar dates (birthday not yet reached this year → minus one). */
export function ageBetween(fromIso: string, toIso: string): number | null {
  const from = parseIsoParts(fromIso);
  const to = parseIsoParts(toIso);
  if (!from || !to) return null;
  let age = to.y - from.y;
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age--;
  return age >= 0 ? age : null;
}

export function personAgeYears(birthDate: string | null, deathDate: string | null): number | null {
  if (!birthDate) return null;
  const end = deathDate ?? new Date().toISOString().slice(0, 10);
  return ageBetween(birthDate, end);
}

export function formatRecordDateWithEc(value: string | null | undefined): string {
  if (!value) return "";
  const g = formatRecordDate(value);
  const ec = formatEthiopianDate(value);
  return ec ? `${g} · ${ec}` : g;
}

export function birthBadgeLabel(birthDate: string | null, deathDate: string | null): string | null {
  if (!birthDate) return null;
  const age = personAgeYears(birthDate, deathDate);
  const date = formatRecordDateWithEc(birthDate);
  if (deathDate && age !== null) return `b. ${date} (aged ${age})`;
  if (age !== null) return `b. ${date} (${age})`;
  return `b. ${date}`;
}

export function deathBadgeLabel(deathDate: string | null): string | null {
  if (!deathDate) return null;
  return `d. ${formatRecordDateWithEc(deathDate)}`;
}

export function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.round((Date.now() - then) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return formatRecordDate(iso.slice(0, 10));
}
