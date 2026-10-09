import { createServerFn } from "@tanstack/react-start";

import { assertPostgresConfigured, dataBackend } from "@/lib/data-backend";
import { requirePgAdmin } from "@/lib/pg-auth.middleware";

export const pgFetchBackupDataFn = createServerFn({ method: "GET" })
  .middleware([requirePgAdmin])
  .handler(async () => {
    if (dataBackend() !== "postgres") throw new Error("Requires DATA_BACKEND=postgres");
    assertPostgresConfigured();
    const { pgFetchBackupData } = await import("@/server/pg/backup");
    return pgFetchBackupData();
  });
