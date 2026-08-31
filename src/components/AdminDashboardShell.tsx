import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Inbox,
  LogOut,
  Menu,
  DatabaseBackup,
  Network,
  TreeDeciduous,
  Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { BuiltByRaafat } from "@/components/brand/built-by-raafat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SITE_NAME } from "@/lib/brand";
import { fetchPendingSubmissions, fetchRegisteredMembers } from "@/lib/submissions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin/tree", label: "Tree editor", icon: Network },
  { to: "/admin/submissions", label: "Pending", icon: Inbox, countKey: "pending" as const },
  { to: "/admin/members", label: "Registered", icon: Users, countKey: "members" as const },
  { to: "/admin/backup", label: "Backup", icon: DatabaseBackup },
] as const;

function NavLinks({
  pendingCount,
  membersCount,
  onNavigate,
}: {
  pendingCount: number;
  membersCount: number;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV.map(({ to, label, icon: Icon, countKey }) => {
        const active = pathname === to || (to === "/admin/tree" && pathname === "/admin");
        const count =
          countKey === "pending" ? pendingCount : countKey === "members" ? membersCount : 0;
        const showBadge = countKey && count > 0;
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {showBadge && (
              <Badge
                variant={active ? "secondary" : "default"}
                className={cn(
                  "h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]",
                  active && "bg-primary-foreground/20 text-primary-foreground",
                )}
              >
                {count}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 border-t border-border/60 p-3", className)}>
      <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-lg">
        <Link to="/tree">
          <TreeDeciduous className="size-4" aria-hidden />
          View public tree
          <ExternalLink className="ml-auto size-3.5 opacity-50" aria-hidden />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 rounded-lg text-muted-foreground"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
      <BuiltByRaafat className="px-1" />
    </div>
  );
}

export function AdminDashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pendingQuery = useQuery({
    queryKey: ["pending-submissions"],
    queryFn: fetchPendingSubmissions,
    staleTime: 15_000,
  });
  const membersQuery = useQuery({
    queryKey: ["registered-members"],
    queryFn: fetchRegisteredMembers,
    staleTime: 30_000,
  });
  const pendingCount = pendingQuery.data?.length ?? 0;
  const membersCount = membersQuery.data?.length ?? 0;

  const sidebarHeader = (
    <div className="border-b border-border/60 px-4 py-4">
      <p className="font-display text-lg font-semibold tracking-tight">Admin</p>
      <p className="text-xs text-muted-foreground">{SITE_NAME}</p>
    </div>
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border/70 bg-card/50 md:flex lg:w-60">
        {sidebarHeader}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks pendingCount={pendingCount} membersCount={membersCount} />
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-card/40 px-3 py-2.5 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" aria-label="Admin menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(18rem,85vw)] flex-col p-0">
              <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
                <SheetTitle className="font-display">Admin</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NavLinks
                  pendingCount={pendingCount}
                  membersCount={membersCount}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <SidebarFooter />
            </SheetContent>
          </Sheet>
          <p className="font-display text-sm font-semibold">Admin</p>
          {pendingCount > 0 && (
            <Badge className="ml-auto rounded-full">{pendingCount} pending</Badge>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
