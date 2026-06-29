"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { X, Send, Copy, Check, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "model";
  parts: [{ text: string }];
};

const SUGGESTED = [
  "How many vacation and sick leave days do I get?",
  "How is overtime pay computed?",
  "How many times can I be late before it becomes an offense?",
  "What happens if I'm absent without notice (AWOL)?",
];

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming: boolean }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(msg.parts[0].text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isModel = msg.role === "model";
  const isEmpty = !msg.parts[0].text;

  return (
    <div className={`flex gap-2 ${isModel ? "justify-start" : "justify-end"}`}>
      {isModel && (
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5 bg-[#111827] p-1">
          <Image src="/ally-eagle.svg" alt="Ally" width={28} height={28} className="w-full h-full object-contain invert" />
        </div>
      )}
      <div className="max-w-[82%] group relative">
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isModel
              ? "bg-white border border-zinc-100 text-zinc-700 rounded-tl-sm shadow-sm"
              : "bg-[#111827] text-white rounded-tr-sm whitespace-pre-wrap"
          }`}
        >
          {isModel && isStreaming && isEmpty ? (
            <div className="flex gap-1 items-center h-4">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          ) : isModel ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-zinc-500">{children}</em>,
                hr: () => <hr className="my-2 border-zinc-200" />,
                code: ({ children }) => <code className="bg-zinc-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
              }}
            >
              {msg.parts[0].text}
            </ReactMarkdown>
          ) : (
            msg.parts[0].text
          )}
        </div>
        {isModel && !isEmpty && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 right-0 flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AllyWidget() {
  const { apiFetch, streamFetch } = useApiClient();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check the global on/off switch once on mount. Until we know, render
  // nothing so a disabled Ally never flashes on screen.
  useEffect(() => {
    apiFetch<{ data: { allyEnabled: boolean } }>("/api/settings")
      .then((res) => setEnabled(res.data.allyEnabled))
      .catch(() => setEnabled(false));
    // apiFetch is recreated each render; run this once on mount like the rest
    // of the codebase's data-loading effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  function handleClose() {
    setOpen(false);
    setInput("");
    setError("");
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history = [...messages];
    const userMsg: Message = { role: "user", parts: [{ text: trimmed }] };

    setInput("");
    setLoading(true);
    setError("");
    setMessages([...history, userMsg, { role: "model", parts: [{ text: "" }] }]);

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await streamFetch(
        "/api/assistant/chat",
        { method: "POST", body: JSON.stringify({ message: trimmed, history }) },
        controller.signal,
      );

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(data); } catch { continue; }
          if (parsed.error) throw new Error(parsed.error as string);
          if (parsed.chunk) {
            setMessages((prev) => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = {
                ...last,
                parts: [{ text: last.parts[0].text + (parsed.chunk as string) }],
              };
              return msgs;
            });
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setMessages(history);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  // Hidden entirely when an admin has turned Ally off (or while we don't yet
  // know the flag's value).
  if (!enabled) return null;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={handleClose} />

          <div className="fixed z-50 bg-zinc-50 shadow-2xl flex flex-col rounded-2xl border border-zinc-200 overflow-hidden inset-x-3 bottom-[88px] top-16 lg:inset-auto lg:bottom-24 lg:right-6 lg:w-[400px] lg:h-[560px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#111827] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1.5">
                  <Image src="/ally-eagle.svg" alt="Ally" width={32} height={32} className="w-full h-full object-contain invert" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">Ally</p>
                  <p className="text-white/50 text-[10px] leading-tight">AGS HR Assistant</p>
                </div>
              </div>
              <button onClick={handleClose} aria-label="Close Ally chat" className="text-white/60 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !loading && (
                <div className="space-y-3">
                  <div className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#111827] p-1 shrink-0 mt-0.5">
                        <Image src="/ally-eagle.svg" alt="Ally" width={28} height={28} className="w-full h-full object-contain invert" />
                      </div>
                      <p className="text-zinc-600 text-sm leading-relaxed">
                        Hi! I&apos;m <strong className="text-zinc-900">Ally</strong>, your AGS HR assistant. Ask me anything about the Employee Handbook or Code of Conduct.
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider px-1 pt-1">Suggested</p>
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="w-full text-left text-xs text-zinc-600 bg-white border border-zinc-100 rounded-xl px-3.5 py-2.5 hover:border-[#111827]/20 hover:text-[#111827] transition-colors shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} isStreaming={loading && i === messages.length - 1} />
              ))}

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 p-3 border-t border-zinc-200 bg-white">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about company policies…"
                  rows={1}
                  disabled={loading}
                  className="flex-1 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#111827]/30 disabled:opacity-50 max-h-28 overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                  className="w-9 h-9 bg-[#111827] rounded-xl flex items-center justify-center hover:bg-[#1f2937] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </>
      )}

      {/* Floating pill button */}
      <button
        onClick={() => (open ? handleClose() : setOpen(true))}
        className={`fixed z-50 shadow-lg flex items-center gap-2 px-4 py-2.5 rounded-full transition-all bottom-20 right-4 lg:bottom-6 lg:right-6 ${
          open ? "bg-[#1f2937]" : "bg-[#111827] hover:bg-[#1f2937] hover:scale-105 active:scale-95"
        }`}
        aria-label="Open Ally HR Assistant"
      >
        {open ? (
          <>
            <ChevronDown className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">Ally</span>
          </>
        ) : (
          <>
            <Image src="/ally-eagle.svg" alt="Ally" width={20} height={20} className="object-contain invert" />
            <span className="text-white text-sm font-medium">Ask Ally</span>
          </>
        )}
      </button>
    </>
  );
}
