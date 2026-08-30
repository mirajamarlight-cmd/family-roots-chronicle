import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireAdmin } from "@/lib/family-assistant-auth.middleware";

const executeInput = z.object({
  kind: z.enum(["approve_submission", "reject_submission", "add_child", "update_person"]),
  payload: z.record(z.unknown()),
});

export const familyAssistantExecute = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(executeInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: SupabaseClient<Database> };
    const { executeAssistantAction } = await import("@/lib/family-assistant-execute.server");
    return executeAssistantAction(supabase, data.kind, data.payload);
  });
