import { createFileRoute } from "@tanstack/react-router";

import { AdminBackup } from "@/components/AdminBackup";

export const Route = createFileRoute("/admin/backup")({
  component: AdminBackupRoute,
});

function AdminBackupRoute() {
  return <AdminBackup />;
}
