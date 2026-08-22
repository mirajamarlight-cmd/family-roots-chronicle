import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/brand";

type Props = {
  variant: "loading" | "error" | "empty";
  message?: string;
  hint?: string;
  onRetry?: () => void;
  className?: string;
};

const DEFAULTS = {
  loading: `Loading ${SITE_NAME}…`,
  error: "Could not load the family data.",
  empty: "Nothing to show yet.",
} as const;

export function PageState({ variant, message, hint, onRetry, className }: Props) {
  const text = message ?? DEFAULTS[variant];

  if (variant === "loading") {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {text}
      </p>
    );
  }

  if (variant === "error") {
    return (
      <div className={cn("flex flex-col items-start gap-3 text-destructive", className)}>
        <p className="text-sm">{text}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card/70 px-4 py-8 text-center", className)}>
      <p className="text-sm text-muted-foreground">{text}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
