/** Digits only, with Ethiopia country code when local 09… number. */
export function normalizePhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("251")) return digits;
  if (digits.startsWith("0")) return `251${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("9")) return `251${digits}`;
  return digits;
}

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
