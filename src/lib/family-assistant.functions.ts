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
  .handler(async ({ data, context }): Promise<import("@/lib/family-assistant.server").AssistantChatResult> => {
    const { dataBackend } = await import("@/lib/data-backend");
    if (dataBackend() === "postgres") {
      const { buildGraph } = await import("@/lib/family");
      const { pgFetchLinks, pgFetchMarriages, pgFetchPeople } = await import("@/server/pg/family");
      const { runFamilyAssistantWithGraph } = await import("@/lib/family-assistant.server");
      const [people, links, marriages] = await Promise.all([
        pgFetchPeople(),
        pgFetchLinks(),
        pgFetchMarriages(),
      ]);
      return runFamilyAssistantWithGraph(
        buildGraph(people, links, marriages),
        data.messages,
        data.context,
        null,
      );
    }
    const { supabase } = (context ?? {}) as { supabase?: SupabaseClient<Database> };
    if (!supabase) throw new Error("Unauthorized");
    const { runFamilyAssistant } = await import("@/lib/family-assistant.server");
    return runFamilyAssistant(supabase, data.messages, data.context);
  });
