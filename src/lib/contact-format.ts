export type PhoneCountry = {
  id: string;
  name: string;
  dial: string;
  placeholder: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { id: "ET", name: "Ethiopia", dial: "251", placeholder: "9xx xxx xxxx" },
  { id: "US", name: "United States", dial: "1", placeholder: "xxx xxx xxxx" },
  { id: "CA", name: "Canada", dial: "1", placeholder: "xxx xxx xxxx" },
  { id: "GB", name: "United Kingdom", dial: "44", placeholder: "xxxx xxxxxx" },
  { id: "DE", name: "Germany", dial: "49", placeholder: "xxx xxxxxxx" },
  { id: "SE", name: "Sweden", dial: "46", placeholder: "xx xxx xxxx" },
  { id: "NO", name: "Norway", dial: "47", placeholder: "xxx xx xxx" },
  { id: "AE", name: "United Arab Emirates", dial: "971", placeholder: "xx xxx xxxx" },
  { id: "SA", name: "Saudi Arabia", dial: "966", placeholder: "xx xxx xxxx" },
  { id: "AU", name: "Australia", dial: "61", placeholder: "xxx xxx xxx" },
];

export const ETHIOPIA_CITIES = [
  "Addis Ababa",
  "Adama",
  "Arba Minch",
  "Asella",
  "Awasa",
  "Bahir Dar",
  "Dessie",
  "Debre Markos",
  "Dilla",
  "Dire Dawa",
  "Gondar",
  "Harar",
  "Hawassa",
  "Jijiga",
  "Jimma",
  "Mekelle",
  "Nekemte",
  "Shashemene",
  "Woliso",
] as const;

export const DEFAULT_PHONE_COUNTRY = "ET";
export const DEFAULT_ADDRESS_COUNTRY = "Ethiopia";

const PHONE_BY_DIAL = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
const ADDRESS_COUNTRY_NAMES = new Set(PHONE_COUNTRIES.map((c) => c.name));

export type ParsedPhone = { countryId: string; local: string };
export type ParsedAddress = { country: string; city: string; details: string };

export function phoneCountry(id: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.id === id) ?? PHONE_COUNTRIES[0]!;
}

export function phoneLocalDigits(local: string): string {
  return local.replace(/\D/g, "");
}

export function parsePhone(raw: string): ParsedPhone {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { countryId: DEFAULT_PHONE_COUNTRY, local: "" };

  for (const country of PHONE_BY_DIAL) {
    if (digits.startsWith(country.dial)) {
      return { countryId: country.id, local: digits.slice(country.dial.length) };
    }
  }

  if (digits.startsWith("0")) {
    return { countryId: "ET", local: digits.slice(1) };
  }
  if (digits.length === 9 && digits.startsWith("9")) {
    return { countryId: "ET", local: digits };
  }

  return { countryId: DEFAULT_PHONE_COUNTRY, local: digits };
}

export function formatPhone(parts: ParsedPhone): string {
  const country = phoneCountry(parts.countryId);
  const digits = phoneLocalDigits(parts.local).replace(/^0+/, "");
  if (!digits) return "";
  return `+${country.dial} ${digits}`;
}

export function isValidPhone(parts: ParsedPhone): boolean {
  const digits = phoneLocalDigits(parts.local).replace(/^0+/, "");
  if (!digits) return false;
  if (parts.countryId === "ET") return /^9\d{8}$/.test(digits);
  return digits.length >= 7 && digits.length <= 15;
}

export function parseAddress(raw: string): ParsedAddress {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { country: DEFAULT_ADDRESS_COUNTRY, city: "", details: "" };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && ADDRESS_COUNTRY_NAMES.has(parts[0]!)) {
    return {
      country: parts[0]!,
      city: parts[1]!,
      details: parts.slice(2).join(", "),
    };
  }

  const ethCity = ETHIOPIA_CITIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (ethCity) {
    return { country: DEFAULT_ADDRESS_COUNTRY, city: ethCity, details: "" };
  }

  if (parts.length === 1) {
    return { country: DEFAULT_ADDRESS_COUNTRY, city: "", details: parts[0]! };
  }

  return {
    country: DEFAULT_ADDRESS_COUNTRY,
    city: parts[0]!,
    details: parts.slice(1).join(", "),
  };
}

export function formatAddress(parts: ParsedAddress): string {
  return [parts.country.trim(), parts.city.trim(), parts.details.trim()].filter(Boolean).join(", ");
}

export function isValidAddress(parts: ParsedAddress): boolean {
  return !!parts.country.trim() && !!parts.city.trim();
}

/** Digits only, with country code — used for tel:/wa.me links. */
export function normalizePhoneE164(phone: string): string | null {
  const parsed = parsePhone(phone);
  const country = phoneCountry(parsed.countryId);
  const local = phoneLocalDigits(parsed.local).replace(/^0+/, "");
  if (!local) return null;
  return `${country.dial}${local}`;
}
