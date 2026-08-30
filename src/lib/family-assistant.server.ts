import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ASSISTANT_TOOL_DEFINITIONS,
  runAssistantTool,
  type AssistantToolName,
} from "@/lib/family-assistant-tools";
import { fetchFamilyGraphServer } from "@/lib/family-graph.server";
import { effectiveDisplayName, type FamilyGraph } from "@/lib/family";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatContext = {
  selectedPersonId?: string | null;
  pendingSubmissionCount?: number;
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

const MAX_TOOL_ROUNDS = 6;

function llmConfig(): { apiKey: string; baseUrl: string; model: string } {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      apiKey: groqKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      apiKey: openAiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
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
    "You cannot edit the tree yet — help explore, explain relationships, and summarize the record.",
    "Do not share private contact details (email, phone, address) from join submissions.",
    selected ? `The admin currently has "${selected}" selected in the editor.` : "No person is selected in the admin editor.",
    pending != null ? `${pending} submission(s) are waiting for admin approval.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function listPendingSubmissionsSummary() {
  const { data, error } = await supabaseAdmin
    .from("person_submissions")
    .select("id, kind, first_name, middle_name, last_name, created_at, status")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
    created_at: row.created_at,
  }));
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
      tools: [
        ...ASSISTANT_TOOL_DEFINITIONS,
        {
          type: "function",
          function: {
            name: "list_pending_submissions",
            description: "List join/edit submissions waiting for admin approval.",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
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
  messages: AssistantChatMessage[],
  ctx?: AssistantChatContext,
): Promise<string> {
  const graph = await fetchFamilyGraphServer();
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
      return text;
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

      let result: unknown;
      if (name === "list_pending_submissions") {
        result = { submissions: await listPendingSubmissionsSummary() };
      } else {
        result = runAssistantTool(graph, name as AssistantToolName, args);
      }

      openAiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Assistant needed too many tool calls. Try a simpler question.");
}
