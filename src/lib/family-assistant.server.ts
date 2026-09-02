import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AssistantAction } from "@/lib/family-assistant-actions";
import { ADMIN_TOOL_DEFINITIONS, runAdminAssistantTool } from "@/lib/family-assistant-admin.server";
import {
  ASSISTANT_TOOL_DEFINITIONS,
  runAssistantTool,
  type AssistantToolName,
} from "@/lib/family-assistant-tools";
import { fetchFamilyGraphWithClient } from "@/lib/family-graph.server";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatContext = {
  selectedPersonId?: string | null;
  pendingSubmissionCount?: number;
};

export type AssistantChatResult = {
  reply: string;
  actions: AssistantAction[];
};

type OpenAiMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

const READ_TOOL_NAMES = new Set<string>([
  "search_people",
  "get_person",
  "find_relationship",
  "get_lineage",
  "get_tree_stats",
  "get_family_history",
]);

const MAX_TOOL_ROUNDS = 8;

function llmConfig(): { apiKey: string; baseUrl: string; model: string } {
  const groqKey = process.env["GROQ_API_KEY"]?.trim();
  if (groqKey) {
    return {
      apiKey: groqKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env["GROQ_MODEL"]?.trim() || "openai/gpt-oss-120b",
    };
  }

  const openAiKey = process.env["OPENAI_API_KEY"]?.trim();
  if (openAiKey) {
    return {
      apiKey: openAiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini",
    };
  }

  throw new Error(
    "Family assistant is not configured. Set GROQ_API_KEY or OPENAI_API_KEY in your server environment.",
  );
}

function buildSystemPrompt(graph: FamilyGraph, ctx?: AssistantChatContext): string {
  const selected =
    ctx?.selectedPersonId && graph.byId.has(ctx.selectedPersonId)
      ? effectiveDisplayName(graph, ctx.selectedPersonId)
      : null;
  const pending =
    typeof ctx?.pendingSubmissionCount === "number" ? ctx.pendingSubmissionCount : null;

  return [
    "You are the admin assistant for the Feqi Yonis family tree (descendants of Faqih Yonis Abdosh, known as Yonis, from Harar, Ethiopia).",
    "Answer using tool results and documented family history only. Never invent people, dates, or relationships.",
    "Patronymic names are common (e.g. Abdosh Ahmed means Abdosh son of Ahmed). Use search_people when a name might match several people.",
    "Be concise, accurate, and warm. Refer to people by the names returned from tools.",
    "For writes (approve, reject, add child, update person), always use prepare_* tools first — never claim a change is done until the admin clicks the confirm button.",
    "Use select_person_in_admin to open someone in the editor. Use match_submission_to_tree before approving when duplicates are possible.",
    "Do not share private contact details (email, phone, address) from join submissions unless the admin explicitly asks.",
    selected ? `The admin currently has "${selected}" selected in the editor.` : "No person is selected in the admin editor.",
    pending != null ? `${pending} submission(s) are waiting for admin approval.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callLlm(messages: OpenAiMessage[]) {
  const { apiKey, baseUrl, model } = llmConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: [...ASSISTANT_TOOL_DEFINITIONS, ...ADMIN_TOOL_DEFINITIONS],
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Assistant request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: OpenAiMessage }>;
  };
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Assistant returned an empty response.");
  return message;
}

export async function runFamilyAssistant(
  supabase: SupabaseClient<Database>,
  messages: AssistantChatMessage[],
  ctx?: AssistantChatContext,
): Promise<AssistantChatResult> {
  const graph = await fetchFamilyGraphWithClient(supabase);
  const actions: AssistantAction[] = [];
  const openAiMessages: OpenAiMessage[] = [
    { role: "system", content: buildSystemPrompt(graph, ctx) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const assistant = await callLlm(openAiMessages);
    const toolCalls =
      "tool_calls" in assistant && assistant.tool_calls?.length ? assistant.tool_calls : null;

    if (!toolCalls) {
      const text = assistant.content?.trim();
      if (!text) throw new Error("Assistant returned no text.");
      return { reply: text, actions };
    }

    openAiMessages.push(assistant);

    for (const call of toolCalls) {
      const name = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      const result = READ_TOOL_NAMES.has(name)
        ? runAssistantTool(graph, name as AssistantToolName, args)
        : await runAdminAssistantTool(supabase, graph, name, args, actions);

      openAiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Assistant needed too many tool calls. Try a simpler question.");
}
