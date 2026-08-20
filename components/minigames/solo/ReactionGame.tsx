"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactionGameProps } from "./types";

type Phase = "intro" | "waiting" | "ready" | "between" | "complete";

export function ReactionGame({ challenge, disabled = false, onComplete }: ReactionGameProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [trial, setTrial] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState<number[]>([]);
  const startedAt = useRef(0);
  const readyAt = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setTimeout(() => { readyAt.current = performance.now(); setPhase("ready"); }, challenge.waitDurationsMs[trial]);
    return () => window.clearTimeout(timer);
  }, [challenge.waitDurationsMs, phase, trial]);

  function start() { if (!disabled) { startedAt.current = performance.now(); setPhase("waiting"); } }
  function advance(nextScores: number[], nextFalseStarts: number[]) {
    if (trial === 4) {
      if (!finished.current) { finished.current = true; setPhase("complete"); onComplete({ reactionMs: nextScores as [number, number, number, number, number], falseStartTrials: nextFalseStarts, clientElapsedMs: Math.round(performance.now() - startedAt.current) }); }
      return;
    }
    setTrial((value) => value + 1); setPhase("between"); window.setTimeout(() => setPhase("waiting"), 500);
  }
  function activate() {
    if (disabled || phase !== "waiting" && phase !== "ready") return;
    if (phase === "waiting") { const nextScores = [...scores, 1000]; const nextFalseStarts = [...falseStarts, trial]; setScores(nextScores); setFalseStarts(nextFalseStarts); advance(nextScores, nextFalseStarts); return; }
    const nextScores = [...scores, Math.round(performance.now() - readyAt.current)]; setScores(nextScores); advance(nextScores, falseStarts);
  }
  const text = phase === "intro" ? "Start when you are ready." : phase === "waiting" ? "Wait for green." : phase === "ready" ? "Tap now!" : phase === "between" ? "Preparing next trial…" : "Submitting your five trials…";
  return <section className="bg-white border border-table-border rounded-card p-5 space-y-4 text-center"><div><h2 className="text-base font-bold text-gray-900">Reaction Rush</h2><p className="text-xs text-gray-500">Five trials. A false start records 1000 ms; this is not a medical or cognitive assessment.</p></div><p aria-live="polite" className="text-sm font-semibold text-gray-700">Trial {Math.min(trial + 1, 5)} of 5 · {text}</p>{phase === "intro" ? <button onClick={start} disabled={disabled} className="px-5 py-2.5 rounded-xl bg-command-black text-white text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">Start five trials</button> : <button onClick={activate} disabled={disabled || phase === "between" || phase === "complete"} className={`w-full min-h-44 rounded-xl text-xl font-black transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 ${phase === "ready" ? "bg-emerald-600 text-white focus-visible:ring-emerald-500" : "bg-amber-100 text-amber-900 focus-visible:ring-amber-500"}`}>{phase === "ready" ? "TAP / ENTER" : "WAIT"}</button>}</section>;
}
