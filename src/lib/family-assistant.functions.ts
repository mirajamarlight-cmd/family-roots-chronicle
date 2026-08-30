import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireAdmin } from "@/lib/family-assistant-auth.middleware";

const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
  context: z
    .object({
      selectedPersonId: z.string().nullable().optional(),
      pendingSubmissionCount: z.number().int().min(0).optional(),
    })
    .optional(),
});

export const familyAssistantChat = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(chatInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: SupabaseClient<Database> };
    const { runFamilyAssistant } = await import("@/lib/family-assistant.server");
    return runFamilyAssistant(supabase, data.messages, data.context);
  });
