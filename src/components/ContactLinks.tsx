import { Mail, MessageCircle, Phone } from "lucide-react";

import { mailtoHref, telHref, telegramHref, whatsAppHref } from "@/lib/contact-links";
import { cn } from "@/lib/utils";

type Props = {
  phone?: string | null;
  email?: string | null;
  telegram?: string | null;
  className?: string;
  compact?: boolean;
};

export function ContactLinks({ phone, email, telegram, className, compact }: Props) {
  const wa = phone ? whatsAppHref(phone) : null;
  const tg = telegram ? telegramHref(telegram) : null;
  const items = [
    phone && { href: telHref(phone), label: "Call", icon: Phone },
    wa && { href: wa, label: "WhatsApp", icon: MessageCircle },
    email && { href: mailtoHref(email), label: "Email", icon: Mail },
    tg && { href: tg, label: "Telegram", icon: MessageCircle },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Phone }[];

  if (!items.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target={label === "Call" ? undefined : "_blank"}
          rel={label === "Call" ? undefined : "noopener noreferrer"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary",
            compact && "px-2 py-0.5 text-[11px]",
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {label}
        </a>
      ))}
    </div>
  );
}
