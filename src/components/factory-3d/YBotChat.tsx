"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { YBotAvatar } from "./YBotAvatar";
import {
  DEFAULT_YBOT_CONFIG,
  YBOT_CONFIG_PATH,
  subscribeNode,
  type YbotConfig,
} from "@/lib/settings";

type Message = { role: "user" | "assistant"; content: string };

const ACCENT = "#a855f7";

const MARKDOWN_CLASSES =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_a]:font-medium [&_a]:underline [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400" />
    </div>
  );
}

export function YBotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>(DEFAULT_YBOT_CONFIG.suggestedQuestions);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(
    () =>
      subscribeNode<YbotConfig>(YBOT_CONFIG_PATH, DEFAULT_YBOT_CONFIG, (config) => {
        if (config.suggestedQuestions?.length) setSuggested(config.suggestedQuestions);
      }),
    []
  );

  const lastAssistantEmpty =
    streaming && messages.at(-1)?.role === "assistant" && messages.at(-1)?.content === "";
  const avatarState: "idle" | "thinking" | "speaking" = lastAssistantEmpty
    ? "thinking"
    : streaming
      ? "speaking"
      : "idle";

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    const history: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Y-BOT is unavailable right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="animate-panel-rise flex h-[62vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/60 bg-white/85 text-zinc-900 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.5)] ring-1 ring-black/5 backdrop-blur-2xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-zinc-200/70 bg-white/50 px-5 py-3.5">
        <YBotAvatar size={40} state={avatarState} />
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold leading-none text-zinc-900">Y-BOT</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {streaming ? "typing…" : "online · asks about Yasar"}
          </p>
        </div>
        <span
          className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: ACCENT }}
        >
          🤖 Innovation Lab
        </span>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="ybot-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-4 text-center">
            <YBotAvatar size={68} state="idle" />
            <p className="max-w-xs text-sm text-zinc-500">
              Hi! I&apos;m Y-BOT. Ask me anything about Yasar&apos;s projects, skills, or experience.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggested.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => {
          const isAssistant = message.role === "assistant";
          const isLast = i === messages.length - 1;
          return (
            <div
              key={i}
              className={`flex items-end gap-2 ${isAssistant ? "" : "flex-row-reverse"}`}
            >
              {isAssistant && (
                <div className="mb-0.5 shrink-0">
                  <YBotAvatar size={28} state={isLast ? avatarState : "idle"} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  isAssistant
                    ? "rounded-bl-sm bg-zinc-100 text-zinc-800"
                    : "rounded-br-sm bg-zinc-900 text-white"
                }`}
              >
                {isAssistant && isLast && streaming && message.content === "" ? (
                  <TypingDots />
                ) : (
                  <div className={MARKDOWN_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-zinc-200/70 bg-white/50 px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Y-BOT anything…"
          disabled={streaming}
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-200 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: ACCENT }}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M4 12l16-8-6 8 6 8-16-8z"
              fill="currentColor"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
