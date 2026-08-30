import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { AdminDashboardShell } from "@/components/AdminDashboardShell";
import { AuthSignInCard } from "@/components/AuthSignInCard";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useFamily";
import { SITE_NAME } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin — ${SITE_NAME}` },
      {
        name: "description",
        content: "Private administration area for maintaining the family tree.",
      },
      { property: "og:title", content: `Admin — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "Sign in to add, edit or remove family records.",
      },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, userId, email, loading } = useIsAdmin();

  if (loading) {
    return <PageState variant="loading" message="Checking access…" className="min-h-[100dvh]" />;
  }

  if (!userId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <AuthSignInCard
          title="Admin sign in"
          description="Sign in here only if you maintain the family record. Browsing the tree does not need an account."
          redirectTo="/admin"
          footer={
            <p className="text-center text-sm text-muted-foreground">
              Adding yourself to the tree?{" "}
              <Link to="/join" className="font-medium text-primary hover:underline">
                Start here
              </Link>
            </p>
          }
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <PageHeader
            title="No admin access"
            description={`Signed in as ${email}. Admin access must be granted by the family record keeper.`}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/join">Add yourself</Link>
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboardShell>
      <Outlet />
    </AdminDashboardShell>
  );
}
