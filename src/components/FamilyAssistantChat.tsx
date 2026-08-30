import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantAction } from "@/lib/family-assistant-actions";
import { familyAssistantChat } from "@/lib/family-assistant.functions";
import { familyAssistantExecute } from "@/lib/family-assistant-execute.functions";
import { fetchPendingSubmissions } from "@/lib/submissions";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
  doneActionIds?: string[];
};

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Ask about the tree, review submissions, or ask me to prepare changes. Writes need your confirm click.",
};

const STARTER_PROMPTS = [
  "What's waiting for approval?",
  "Who has duplicate names?",
  "Open the selected person",
] as const;

type FamilyAssistantChatProps = {
  selectedPersonId?: string | null;
  onOpenPerson?: (personId: string) => void;
};

export function FamilyAssistantChat({ selectedPersonId, onOpenPerson }: FamilyAssistantChatProps) {
  const chatFn = useServerFn(familyAssistantChat);
  const executeFn = useServerFn(familyAssistantExecute);
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ["pending-submissions"],
    queryFn: fetchPendingSubmissions,
    staleTime: 15_000,
  });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayMessages = messages.length ? messages : [WELCOME];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages, busy]);

  const applyOpenActions = (actions: AssistantAction[]) => {
    for (const action of actions) {
      if (action.type === "open_person") onOpenPerson?.(action.personId);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const apiMessages = messages.map(({ role, content }) => ({ role, content }));
    const nextApi = [...apiMessages, { role: "user" as const, content: trimmed }];
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setBusy(true);

    try {
      const result = await chatFn({
        data: {
          messages: nextApi,
          context: {
            selectedPersonId: selectedPersonId ?? null,
            pendingSubmissionCount: pendingQuery.data?.length ?? 0,
          },
        },
      });
      applyOpenActions(result.actions);
      const confirmActions = result.actions.filter((a) => a.type === "confirm");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, actions: confirmActions },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistant request failed";
      toast.error(message);
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async (messageIndex: number, action: Extract<AssistantAction, { type: "confirm" }>) => {
    setBusy(true);
    try {
      const result = await executeFn({
        data: { kind: action.kind, payload: action.payload },
      });
      toast.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ["pending-submissions"] });
      await queryClient.invalidateQueries({ queryKey: ["family-graph"] });
      if (result.personId) onOpenPerson?.(result.personId);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === messageIndex
            ? { ...m, doneActionIds: [...(m.doneActionIds ?? []), action.id] }
            : m,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg"
          aria-label="Open family assistant"
        >
          <MessageSquare className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-4 pr-12 text-left">
          <SheetTitle>Family assistant</SheetTitle>
          <SheetDescription>
            Explore the tree, review submissions, and prepare edits — confirm before anything saves.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {displayMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="space-y-2">
              <div
                className={cn(
                  "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {message.content}
              </div>
              {message.actions?.map((action) => {
                if (action.type !== "confirm") return null;
                const done = message.doneActionIds?.includes(action.id);
                return (
                  <Button
                    key={action.id}
                    size="sm"
                    variant={action.kind.includes("reject") ? "outline" : "default"}
                    disabled={busy || done}
                    className="mr-2"
                    onClick={() => void runConfirm(index, action)}
                  >
                    {done ? "Done" : action.label}
                  </Button>
                );
              })}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border px-4 py-4">
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal px-2 py-1 text-left text-xs"
                disabled={busy}
                onClick={() => void send(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the family…"
              rows={2}
              className="min-h-[72px] resize-none"
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
