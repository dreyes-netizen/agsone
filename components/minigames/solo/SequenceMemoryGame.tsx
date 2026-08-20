"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSequenceMemoryChallenge, MAX_SEQUENCE_MEMORY_LEVEL, SEQUENCE_MEMORY_BUTTON_COUNT, type SequenceMemoryResponse } from "@/lib/minigames/solo/sequenceMemory";
import type { SequenceMemoryGameProps } from "./types";
import { scheduleSequencePlayback } from "./sequencePlayback";

type Phase = "intro" | "showing" | "input" | "complete";
const labels = ["North", "East", "South", "West"];

export function SequenceMemoryGame({ challenge, disabled = false, onComplete }: SequenceMemoryGameProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState(1);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [inputs, setInputs] = useState<number[]>([]);
  const responses = useRef<SequenceMemoryResponse[]>([]);
  const startedAt = useRef(0);
  const completed = useRef(false);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sequence = useMemo(() => createSequenceMemoryChallenge(challenge.seed).sequence, [challenge.seed]);

  useEffect(() => {
    if (phase !== "showing") return;
    return scheduleSequencePlayback(sequence, level, setFlashIndex, () => setPhase("input"));
  }, [level, phase, sequence]);
  useEffect(() => {
    if (phase === "input") buttonRefs.current[0]?.focus();
  }, [phase]);

  function begin(event: React.MouseEvent<HTMLButtonElement>) { if (!disabled) { startedAt.current = event.timeStamp; setPhase("showing"); } }
  function end(nextResponses: SequenceMemoryResponse[], completedLevel: number, elapsedMs: number) { if (!completed.current) { completed.current = true; setPhase("complete"); onComplete({ responses: nextResponses, claimedCompletedLevel: completedLevel, clientElapsedMs: elapsedMs }); } }
  function select(button: number, eventTimeStamp: number) {
    if (disabled || phase !== "input") return;
    const nextInputs = [...inputs, button]; setInputs(nextInputs);
    if (nextInputs.length !== level) return;
    const isCorrect = nextInputs.every((value, index) => value === sequence[index]);
    const nextResponses = [...responses.current, { level, inputs: nextInputs }]; responses.current = nextResponses;
    if (!isCorrect || level === MAX_SEQUENCE_MEMORY_LEVEL) { end(nextResponses, isCorrect ? level : level - 1, Math.round(eventTimeStamp - startedAt.current)); return; }
    setLevel(level + 1); setInputs([]); setPhase("showing");
  }
  return <section className="bg-white border border-table-border rounded-card p-4 sm:p-6 space-y-4"><div className="flex justify-between gap-3"><div><h2 className="text-base font-bold text-gray-900">Sequence Memory</h2><p className="text-xs text-gray-500">Repeat the growing button sequence using touch, mouse, or keyboard.</p></div><p aria-live="polite" className="text-sm font-bold text-navy-800 shrink-0">Level {level}</p></div>{phase === "intro" ? <button onClick={begin} disabled={disabled} className="w-full py-2.5 rounded-xl bg-command-black text-white text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">Show sequence</button> : <><p aria-live="polite" className="text-sm text-gray-600">{phase === "showing" ? "Watch the highlighted sequence. Reduced-motion settings use the same clear contrast state without animation." : phase === "input" ? `Repeat ${level} button${level === 1 ? "" : "s"}.` : "Submitting your result…"}</p><div role="group" aria-label="Sequence buttons" className="grid grid-cols-2 gap-3 max-w-md mx-auto">{Array.from({ length: SEQUENCE_MEMORY_BUTTON_COUNT }, (_, index) => <button ref={(element) => { buttonRefs.current[index] = element; }} key={index} onClick={(event) => select(index, event.timeStamp)} disabled={disabled || phase !== "input"} className={`min-h-24 rounded-xl border-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-navy-600 ${flashIndex === index ? "bg-navy-700 border-navy-900 text-white" : "bg-gray-50 border-gray-300 text-gray-800 hover:bg-navy-50"}`}>{labels[index]}</button>)}</div></>}</section>;
}
