import { Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, GitCompare, House, Search, Settings, TreeDeciduous, UserPlus } from "lucide-react";
import type { ReactNode } from "react";

import { BuiltByRaafat } from "@/components/brand/built-by-raafat";
import { SITE_LOGO_PATH, SITE_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

function goHome(navigate: ReturnType<typeof useNavigate>) {
  void navigate({ to: "/", search: {}, resetScroll: true });
}

const NAV = [
  { to: "/", label: "Home", short: "Home", icon: House },
  { to: "/tree", label: "Family Tree", short: "Tree", icon: TreeDeciduous },
  { to: "/search", label: "Search", short: "Search", icon: Search },
  { to: "/relationship", label: "Relationship", short: "Relate", icon: GitCompare },
  { to: "/statistics", label: "Statistics", short: "Stats", icon: BarChart3 },
] as const;

const navLinkClass =
  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground";

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[100dvh] flex-col parchment">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3">
          <Link
            to="/"
            search={{}}
            resetScroll
            activeOptions={{ exact: true }}
            onClick={(e) => {
              e.preventDefault();
              goHome(navigate);
            }}
            className="flex min-w-0 items-center gap-2.5"
          >
            <img
              src={SITE_LOGO_PATH}
              alt={`${SITE_NAME} logo`}
              className="size-9 shrink-0 rounded-full border border-border object-cover shadow-sm"
            />
            <span className="min-w-0">
              <span className="block font-display text-lg font-semibold leading-tight tracking-tight">
                {SITE_NAME}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/join"
              activeProps={{ className: "bg-primary/10 text-primary" }}
              className={cn(navLinkClass, "gap-1 px-2.5 md:hidden")}
            >
              <UserPlus className="size-4" aria-hidden />
              Join
            </Link>
            <Link
              to="/admin"
              activeProps={{ className: "bg-primary/10 text-primary" }}
              className={cn(navLinkClass, "px-2 md:hidden")}
              aria-label="Admin"
              title="Admin"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  search={{}}
                  resetScroll
                  activeOptions={{ exact: to === "/" }}
                  activeProps={{ className: "bg-primary/10 font-medium text-primary" }}
                  className={navLinkClass}
                  onClick={
                    to === "/"
                      ? (e) => {
                          e.preventDefault();
                          goHome(navigate);
                        }
                      : undefined
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              ))}
              <Link
                to="/join"
                activeProps={{ className: "bg-primary/10 font-medium text-primary" }}
                className={navLinkClass}
              >
                <UserPlus className="size-4" aria-hidden />
                Join
              </Link>
              <Link
                to="/admin"
                activeProps={{ className: "bg-primary/10 font-medium text-primary" }}
                className={navLinkClass}
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
        <BuiltByRaafat />
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ to, short, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                search={{}}
                resetScroll
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-primary after:bg-primary" }}
                className="relative flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] text-muted-foreground transition-colors after:absolute after:inset-x-4 after:top-0 after:h-0.5 after:rounded-full after:bg-transparent"
                onClick={
                  to === "/"
                    ? (e) => {
                        e.preventDefault();
                        goHome(navigate);
                      }
                    : undefined
                }
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
