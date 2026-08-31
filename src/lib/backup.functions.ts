import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/family-assistant-auth.middleware";
import { importFamilyBackup, validateBackup } from "@/lib/backup";

const importInput = z.object({
  backup: z.record(z.unknown()),
  mode: z.enum(["merge", "replace"]),
});

export const importFamilyBackupFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(importInput)
  .handler(async ({ data, context }) => {
    const parsed = validateBackup(data.backup);
    if ("error" in parsed) throw new Error(parsed.error);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase } = context as { supabase: typeof supabaseAdmin };

    return importFamilyBackup(supabase, supabaseAdmin, parsed.backup, data.mode);
  });
