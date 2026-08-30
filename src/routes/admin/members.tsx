import { createFileRoute } from "@tanstack/react-router";

import { AdminRegisteredMembers } from "@/components/AdminRegisteredMembers";
import { PageState } from "@/components/PageState";
import { useFamilyGraph } from "@/hooks/useFamily";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembersRoute,
});

function AdminMembersRoute() {
  const { data: graph, isLoading } = useFamilyGraph();

  if (isLoading || !graph) {
    return <PageState variant="loading" className="p-6" message="Loading family…" />;
  }

  return <AdminRegisteredMembers graph={graph} />;
}
