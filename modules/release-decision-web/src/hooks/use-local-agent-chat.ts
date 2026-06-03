"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessagesAfterAction, persistMessagesAction } from "@/lib/actions";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Streamed reasoning tokens — ephemeral, not persisted to DB. */
  thinking?: string;
  createdAt: Date;
}

interface UseLocalAgentChatOptions {
  /** The experiment ID used to scope the agent session */
  experimentId: string;
  /**
   * Override the connector URL. Defaults to `http://127.0.0.1:3100`, which
   * is where `npx @featbit/experimentation-claude-code-connector` listens.
   */
  connectorUrl?: string;
  /** Max agent turns per request */
  maxTurns?: number;
  /** Working directory for the agent */
  cwd?: string;
  /** Existing messages from DB to seed chat history */
  initialMessages?: ChatMessage[];
}

export type ConnectionStatus = "checking" | "connected" | "disconnected";

interface UseLocalAgentChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  /**
   * Short label describing what the agent is doing right now ("Thinking…",
   * "Running Bash…"). Null when idle or streaming plain text.
   */
  activity: string | null;
  /** Send a message (empty string triggers session bootstrap) */
  sendMessage: (content: string) => void;
  /** Abort the current stream */
  abort: () => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONNECTOR_URL = "http://127.0.0.1:3100";

/**
 * Per-browser cursor of the most recent DB message this machine's agent has
 * already seen. Reset means: replay all history into the agent on next send.
 * Scope is per-experiment, since each experiment has its own jsonl session.
 */
function cursorStorageKey(experimentId: string): string {
  return `featbit:local-agent-msg-cursor:${experimentId}`;
}

function readCursor(experimentId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(cursorStorageKey(experimentId));
}

function writeCursor(experimentId: string, iso: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cursorStorageKey(experimentId), iso);
}

/**
 * Render a delta of DB messages as a single context block to splice into the
 * front of the next user prompt. The format is plain markdown — the model
 * treats it as a normal turn-by-turn transcript.
 */
function renderDeltaAsContext(
  delta: Array<{ role: string; content: string }>,
): string {
  const lines = delta
    .map((m) => `**${m.role}:** ${m.content}`)
    .join("\n\n");
  return [
    "The following messages were added to this experiment's conversation",
    "thread by other participants (or earlier sessions on a different machine)",
    "since your last turn. Treat them as part of the conversation history:",
    "",
    lines,
    "",
    "---",
  ].join("\n");
}

// ── Hook ─────────────────────────────────────────────────────────────────────

let msgCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++msgCounter}`;
}

/**
 * Connects the chat panel to a local Claude Code instance via the
 * `@featbit/experimentation-claude-code-connector` process running on the
 * user's machine.
 *
 * Cross-user sync: the local jsonl on this machine is per-user, but the DB
 * is shared. Before each user prompt we fetch all DB messages newer than
 * our local cursor and prepend them as context, so the local agent always
 * sees what other collaborators wrote even though their messages never hit
 * this machine's session file.
 */
export function useLocalAgentChat({
  experimentId,
  connectorUrl = DEFAULT_CONNECTOR_URL,
  maxTurns = 50,
  cwd,
  initialMessages = [],
}: UseLocalAgentChatOptions): UseLocalAgentChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking");
  const [activity, setActivity] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamAccRef = useRef("");
  const cursorRef = useRef<string | null>(null);

  // Initialise cursor from localStorage. Deliberately do NOT seed it from
  // `initialMessages` — those messages may have been written by another user
  // on a different machine, so the agent on this machine has not actually
  // seen them yet. Cursor stays null until this user sends a message.
  useEffect(() => {
    cursorRef.current = readCursor(experimentId);
  }, [experimentId]);

  // Health probe — repeats every 5s while disconnected so the UI flips to
  // "connected" the moment the user runs `npx ...` without needing a reload.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const probe = async () => {
      try {
        const res = await fetch(`${connectorUrl}/health`, {
          signal: AbortSignal.timeout(2500),
        });
        if (cancelled) return;
        setConnectionStatus(res.ok ? "connected" : "disconnected");
      } catch {
        if (cancelled) return;
        setConnectionStatus("disconnected");
      } finally {
        if (!cancelled) {
          timer = setTimeout(probe, 5000);
        }
      }
    };

    probe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [connectorUrl]);

  const appendAssistantDelta = useCallback((text: string) => {
    streamAccRef.current += text;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && last.id.startsWith("stream-")) {
        return [...prev.slice(0, -1), { ...last, content: last.content + text }];
      }
      return [
        ...prev,
        {
          id: `stream-${nextId()}`,
          role: "assistant" as const,
          content: text,
          createdAt: new Date(),
        },
      ];
    });
  }, []);

  const appendAssistantThinking = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && last.id.startsWith("stream-")) {
        return [
          ...prev.slice(0, -1),
          { ...last, thinking: (last.thinking ?? "") + text },
        ];
      }
      return [
        ...prev,
        {
          id: `stream-${nextId()}`,
          role: "assistant" as const,
          content: "",
          thinking: text,
          createdAt: new Date(),
        },
      ];
    });
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      if (abortRef.current) return;

      setError(null);

      const trimmed = content.trim();
      const isBootstrap = !trimmed;

      if (trimmed) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "user",
            content: trimmed,
            createdAt: new Date(),
          },
        ]);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      streamAccRef.current = "";

      (async () => {
        try {
          // Step 1: pull DB delta. Skip on bootstrap — the slash command
          // already loads experiment state from PG, no need to also splice
          // raw messages into the prompt.
          let promptToSend = trimmed;
          if (!isBootstrap) {
            try {
              const { messages: delta, latestCreatedAt } = await fetchMessagesAfterAction(
                experimentId,
                cursorRef.current,
              );
              if (delta.length > 0) {
                promptToSend = `${renderDeltaAsContext(delta)}\n\n${trimmed}`;
              }
              // Optimistically advance the cursor so a fast-follow send does
              // not re-prepend the same delta. The post-persist update below
              // will move it forward again to include our own pair.
              if (latestCreatedAt) {
                cursorRef.current = latestCreatedAt;
                writeCursor(experimentId, latestCreatedAt);
              }
            } catch (deltaErr) {
              console.warn("[local-agent] delta fetch failed:", deltaErr);
              // Fall through and send the user's prompt without delta — the
              // agent's local jsonl alone is better than failing the send.
            }
          }

          const body: Record<string, unknown> = {
            experimentId,
            maxTurns,
          };
          if (promptToSend) body.prompt = promptToSend;
          if (cwd) body.cwd = cwd;

          const res = await fetch(`${connectorUrl}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }

          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            let currentEvent = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ") && currentEvent) {
                const jsonStr = line.slice(6);
                try {
                  const data = JSON.parse(jsonStr);
                  handleSseEvent(currentEvent, data);
                } catch {
                  // ignore malformed JSON
                }
                currentEvent = "";
              } else if (line === "") {
                currentEvent = "";
              }
            }
          }

          setConnectionStatus("connected");

          // Step 3: persist our pair and move the cursor past it. We persist
          // the user's *original* trimmed content (not the spliced-with-delta
          // prompt), since the delta was already in the DB before we ran.
          if (streamAccRef.current) {
            try {
              const { latestCreatedAt } = await persistMessagesAction(
                experimentId,
                trimmed,
                streamAccRef.current,
              );
              if (latestCreatedAt) {
                cursorRef.current = latestCreatedAt;
                writeCursor(experimentId, latestCreatedAt);
              }
            } catch (persistErr) {
              console.warn("[local-agent] persist failed:", persistErr);
            }
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") {
            // user aborted — not an error
          } else {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setConnectionStatus("disconnected");
          }
        } finally {
          abortRef.current = null;
          setIsStreaming(false);
          setActivity(null);
        }
      })();

      function handleSseEvent(event: string, data: unknown) {
        const d = data as Record<string, unknown>;

        if (event === "stream_event") {
          const inner = d.event as Record<string, unknown> | undefined;
          if (!inner) return;

          if (inner.type === "content_block_start") {
            const block = inner.content_block as Record<string, unknown> | undefined;
            const blockType = block?.type as string | undefined;
            if (blockType === "thinking") {
              setActivity("Thinking…");
            } else if (blockType === "tool_use") {
              const name = (block?.name as string | undefined) ?? "tool";
              setActivity(`Running ${name}…`);
            } else if (blockType === "text") {
              setActivity(null);
            }
            return;
          }

          if (inner.type !== "content_block_delta") return;
          const delta = inner.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            appendAssistantDelta(delta.text);
          } else if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
            appendAssistantThinking(delta.thinking);
          }
        } else if (event === "result") {
          if (d.is_error === true) {
            const errs = (d.errors as string[] | undefined) ?? [];
            setError(errs[0] ?? "Agent error");
          }
        } else if (event === "error") {
          const msg = (d as { message?: string }).message ?? "Unknown error";
          setError(msg);
        }
      }
    },
    [experimentId, connectorUrl, maxTurns, cwd, appendAssistantDelta, appendAssistantThinking],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, error, connectionStatus, activity, sendMessage, abort };
}

export const LOCAL_AGENT_CONNECTOR_URL = DEFAULT_CONNECTOR_URL;
