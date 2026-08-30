import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  .handler(async ({ data }) => {
    const { runFamilyAssistant } = await import("@/lib/family-assistant.server");
    const reply = await runFamilyAssistant(data.messages, data.context);
    return { reply };
  });
