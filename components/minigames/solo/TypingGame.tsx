"use client";

import { useEffect, useRef, useState } from "react";
import type { TypingGameProps } from "./types";

export function TypingGame({ challenge, mode, disabled = false, onComplete }: TypingGameProps) {
  const [typedText, setTypedText] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(challenge.durationMs);
  const completed = useRef(false);
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typedTextRef = useRef("");

  function finish(finalTypedText: string, elapsedMs: number) {
    if (completed.current) return;
    completed.current = true;
    setIsComplete(true);
    onComplete({ typedText: finalTypedText, clientElapsedMs: elapsedMs });
  }

  useEffect(() => {
    if (startedAt === null || completed.current) return;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, challenge.durationMs - elapsed);
      setRemainingMs(remaining);
      if (remaining === 0) finish(typedTextRef.current, Math.round(elapsed));
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, challenge.durationMs]);

  function begin() {
    if (disabled || startedAt !== null) return;
    const start = performance.now();
    setStartedAt(start);
    inputRef.current?.focus();
  }

  function onChange(value: string) {
    if (startedAt === null) begin();
    const nextValue = value.slice(0, challenge.passageText.length);
    typedTextRef.current = nextValue;
    setTypedText(nextValue);
  }

  const correctChars = typedText.split("").filter((character, index) => character === challenge.passageText[index]).length;
  const accuracy = typedText.length ? Math.round((correctChars / typedText.length) * 100) : 100;
  const elapsedMinutes = startedAt === null ? 0 : Math.max(1 / 60, (challenge.durationMs - remainingMs) / 60_000);
  const wpm = Math.floor((correctChars / 5) / elapsedMinutes);

  return (
    <section className="bg-white border border-table-border rounded-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-base font-bold text-gray-900">Type the passage</h2><p className="text-xs text-gray-500">{mode === "ranked" ? "Ranked runs end after 60 seconds. Paste, cut and drop are disabled." : "Begin typing when you are ready."}</p></div>
        <div aria-live="polite" className="text-right shrink-0"><p className="text-lg font-black text-navy-800">{Math.ceil(remainingMs / 1000)}s</p><p className="text-xs text-gray-500">{wpm} WPM · {accuracy}%</p></div>
      </div>
      <p aria-label="Passage" className="rounded-lg bg-gray-50 border border-gray-200 p-4 font-mono text-sm leading-7 text-gray-700 break-words">
        {challenge.passageText.split("").map((character, index) => {
          const typed = typedText[index];
          const className = typed === undefined ? "text-gray-500" : typed === character ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-100 underline";
          return <span key={index} className={className}>{character}</span>;
        })}
      </p>
      {!startedAt && <button onClick={begin} disabled={disabled} className="w-full py-2 rounded-lg bg-navy-700 text-white font-bold text-sm hover:bg-navy-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-600">Start typing</button>}
      <label className="block"><span className="sr-only">Type the passage</span><textarea ref={inputRef} value={typedText} onChange={(event) => onChange(event.target.value)} onPaste={mode === "ranked" ? (event) => event.preventDefault() : undefined} onCut={mode === "ranked" ? (event) => event.preventDefault() : undefined} onDrop={mode === "ranked" ? (event) => event.preventDefault() : undefined} disabled={disabled || isComplete} rows={4} className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 disabled:bg-gray-100" /> </label>
    </section>
  );
}
