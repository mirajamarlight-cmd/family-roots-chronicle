import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { familyAssistantChat } from "@/lib/family-assistant.functions";
import { fetchPendingSubmissions } from "@/lib/submissions";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Ask me about people, relationships, lineage, or pending join requests. I use the live family record — I won't guess.",
};

const STARTER_PROMPTS = [
  "How is the tree organized?",
  "What's waiting for approval?",
  "Who has duplicate names?",
] as const;

type FamilyAssistantChatProps = {
  selectedPersonId?: string | null;
};

export function FamilyAssistantChat({ selectedPersonId }: FamilyAssistantChatProps) {
  const chatFn = useServerFn(familyAssistantChat);
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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const apiMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(apiMessages);
    setInput("");
    setBusy(true);

    try {
      const result = await chatFn({
        data: {
          messages: apiMessages,
          context: {
            selectedPersonId: selectedPersonId ?? null,
            pendingSubmissionCount: pendingQuery.data?.length ?? 0,
          },
        },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistant request failed";
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry — I couldn't reach the assistant. Set GROQ_API_KEY (or OPENAI_API_KEY) in your server .env and restart.",
        },
      ]);
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
            Answers from the live tree and family history. Read-only for now.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {displayMessages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {message.content}
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
