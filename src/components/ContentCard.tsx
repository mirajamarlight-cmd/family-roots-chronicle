import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md";
};

export function ContentCard({ children, className, padding = "md" }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/80 leaf-shadow",
        padding === "sm" ? "p-3 sm:p-4" : "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
