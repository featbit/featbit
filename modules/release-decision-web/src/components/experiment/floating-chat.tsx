"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { sendMessageAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  MessageCircle,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import type { Message } from "@/generated/prisma";

type ChatSize = "collapsed" | "normal" | "large";

export function FloatingChat({
  experimentId,
  messages,
}: {
  experimentId: string;
  messages: Message[];
}) {
  const [size, setSize] = useState<ChatSize>("collapsed");
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }, []);

  function handleSubmit() {
    const content = input.trim();
    if (!content || isPending) return;
    setInput("");
    startTransition(async () => {
      await sendMessageAction(experimentId, content);
      scrollToBottom();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Collapsed — just a FAB button
  if (size === "collapsed") {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => setSize("normal")}
          className="flex items-center justify-center size-12 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity cursor-pointer"
        >
          <MessageCircle className="size-5" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-medium">
              {messages.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  const isLarge = size === "large";

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col bg-background border rounded-xl shadow-2xl transition-all duration-200",
        isLarge
          ? "bottom-4 right-4 w-[560px] h-[calc(100dvh-2rem)]"
          : "bottom-5 right-5 w-[380px] h-[480px]"
      )}
    >
      {/* ── Title bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Bot className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium flex-1">Agent Chat</span>
        <button
          onClick={() => setSize(isLarge ? "normal" : "large")}
          className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
        >
          {isLarge ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </button>
        <button
          onClick={() => setSize("collapsed")}
          className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
            <Bot className="size-8 opacity-30" />
            <p className="text-xs">
              Describe your goal or what you want to release.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2 text-sm",
                msg.role === "user" && "justify-end"
              )}
            >
              {msg.role !== "user" && (
                <div className="flex shrink-0 items-start pt-0.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-foreground/10">
                    <Bot className="size-3.5" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-1.5 whitespace-pre-wrap text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.role === "system"
                      ? "bg-muted text-muted-foreground italic"
                      : "bg-muted"
                )}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex shrink-0 items-start pt-0.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/10">
                    <User className="size-3.5" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {isPending && (
          <div className="flex gap-2 text-sm">
            <div className="flex size-6 items-center justify-center rounded-full bg-foreground/10 shrink-0">
              <Bot className="size-3.5" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-1.5">
              <span className="inline-flex gap-1 text-xs">
                <span className="animate-bounce [animation-delay:0ms]">·</span>
                <span className="animate-bounce [animation-delay:150ms]">
                  ·
                </span>
                <span className="animate-bounce [animation-delay:300ms]">
                  ·
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="border-t p-2 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell the agent what to do…"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            disabled={isPending}
          />
          <Button
            size="sm"
            disabled={!input.trim() || isPending}
            onClick={handleSubmit}
            className="h-7 px-2"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
