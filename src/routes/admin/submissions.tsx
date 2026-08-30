import { createFileRoute } from "@tanstack/react-router";

import { AdminSubmissionsPage } from "@/components/AdminSubmissionsPage";
import { PageState } from "@/components/PageState";
import { useFamilyGraph } from "@/hooks/useFamily";

export const Route = createFileRoute("/admin/submissions")({
  component: AdminSubmissionsRoute,
});

function AdminSubmissionsRoute() {
  const { data: graph, isLoading } = useFamilyGraph();

  if (isLoading || !graph) {
    return <PageState variant="loading" className="p-6" message="Loading family…" />;
  }

  return <AdminSubmissionsPage graph={graph} />;
}
