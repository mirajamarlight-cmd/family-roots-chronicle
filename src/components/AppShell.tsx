import { Link } from "@tanstack/react-router";
import { BarChart3, Search, Settings, TreeDeciduous } from "lucide-react";
import type { ReactNode } from "react";

import { BuiltByRaafat } from "@/components/brand/built-by-raafat";
import { SITE_LOGO_PATH } from "@/lib/brand";

const NAV = [
  { to: "/", label: "Family Tree", short: "Tree", icon: TreeDeciduous },
  { to: "/search", label: "Search", short: "Search", icon: Search },
  { to: "/statistics", label: "Statistics", short: "Stats", icon: BarChart3 },
] as const;

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] flex-col parchment">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={SITE_LOGO_PATH}
              alt=""
              className="size-9 rounded-full border border-border object-cover shadow-sm"
            />
            <span className="font-display text-lg font-semibold tracking-tight">Family Tree</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/admin"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground md:hidden"
            >
              <Settings className="size-4" aria-hidden />
              Admin
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
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
            <Link
              to="/admin"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
            >
              <Settings className="size-4" aria-hidden />
              Admin
            </Link>
          </nav>
          </div>
        </div>
      </header>

      <main
        className={
          wide
            ? "flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
            : "mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:py-8 md:pb-8"
        }
      >
        {children}
      </main>

      <footer className="space-y-2 border-t border-border/70 px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground md:pb-5">
        <p>
          A private family record. Only documented information is shown; unknown details are left
          blank.
        </p>
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-colors hover:bg-secondary/60 md:hidden"
        >
          <Settings className="size-3.5" aria-hidden />
          Admin
        </Link>
        <BuiltByRaafat />
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-3">
          {NAV.map(({ to, short, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-primary" }}
                className="flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] text-muted-foreground transition-colors"
              >
                <Icon className="size-5" aria-hidden />
                {short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
