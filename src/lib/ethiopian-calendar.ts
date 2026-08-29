const EC_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miyazya",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
] as const;

export type EthiopianDate = { year: number; month: number; day: number };

/** JDN of 1 Meskerem 1 EC */
const ETHIOPIC_EPOCH = 1724220;

function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function ethiopianToJdn(year: number, month: number, day: number): number {
  return ETHIOPIC_EPOCH + 365 * (year - 1) + Math.floor((year - 1) / 4) + 30 * (month - 1) + day - 1;
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = jdn - ETHIOPIC_EPOCH;
  const n = Math.floor((4 * r + 3) / 1461);
  const year = n + 1;
  const n1 = r - (365 * n + Math.floor(n / 4));
  const month = Math.floor(n1 / 30) + 1;
  const day = (n1 % 30) + 1;
  return { year, month, day };
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function gregorianToEthiopian(iso: string): EthiopianDate | null {
  const g = parseIsoDate(iso);
  if (!g) return null;
  return jdnToEthiopian(gregorianToJdn(g.year, g.month, g.day));
}

export function ethiopianToGregorianIso(date: EthiopianDate): string | null {
  if (date.month < 1 || date.month > 13 || date.day < 1) return null;
  const pagumeLen = date.year % 4 === 3 ? 6 : 5;
  if (date.month < 13 && date.day > 30) return null;
  if (date.month === 13 && date.day > pagumeLen) return null;
  const g = jdnToGregorian(ethiopianToJdn(date.year, date.month, date.day));
  const mm = String(g.month).padStart(2, "0");
  const dd = String(g.day).padStart(2, "0");
  return `${g.year}-${mm}-${dd}`;
}

export function formatEthiopianDate(iso: string): string | null {
  const ec = gregorianToEthiopian(iso);
  if (!ec) return null;
  const month = EC_MONTHS[ec.month - 1] ?? `M${ec.month}`;
  return `${ec.day} ${month} ${ec.year}`;
}

export function ethiopianMonthOptions(): { value: number; label: string }[] {
  return EC_MONTHS.map((label, i) => ({ value: i + 1, label }));
}
