import { Link } from "@tanstack/react-router";
import { BarChart3, Search, Settings, TreeDeciduous, Users } from "lucide-react";
import type { ReactNode } from "react";

import { BuiltByRaafat } from "@/components/brand/built-by-raafat";

const NAV = [
  { to: "/", label: "Family Tree", icon: TreeDeciduous },
  { to: "/search", label: "Search", icon: Search },
  { to: "/people", label: "People", icon: Users },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/admin", label: "Admin", icon: Settings },
] as const;

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col parchment">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-2">
            <TreeDeciduous className="size-5 text-primary" aria-hidden />
            <span className="font-display text-lg font-semibold tracking-tight">Family Tree</span>
          </Link>
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className={wide ? "flex-1" : "mx-auto w-full max-w-7xl flex-1 px-4 py-8"}>
        {children}
      </main>
      <footer className="space-y-2 border-t border-border/70 px-4 py-5 text-center text-xs text-muted-foreground">
        <p>
          A private family record. Only documented information is shown; unknown details are left
          blank.
        </p>
        <BuiltByRaafat />
      </footer>
    </div>
  );
}
