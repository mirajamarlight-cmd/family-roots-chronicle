import { normalizePhoneE164 } from "./contact-format.ts";

export { normalizePhoneE164 };

export function telHref(phone: string): string {
  const e164 = normalizePhoneE164(phone);
  return e164 ? `tel:+${e164}` : `tel:${phone.trim()}`;
}

export function whatsAppHref(phone: string): string | null {
  const e164 = normalizePhoneE164(phone);
  return e164 ? `https://wa.me/${e164}` : null;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

/** ponytail: telegram field later — accept @handle or t.me URL */
export function telegramHref(handle: string | null | undefined): string | null {
  const raw = handle?.trim();
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const user = raw.replace(/^@/, "");
  return user ? `https://t.me/${user}` : null;
}
