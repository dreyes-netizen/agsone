"use client";

import { useEffect, useRef, useState } from "react";
import { createVisualMemoryBoard, MAX_VISUAL_MEMORY_LEVEL, type VisualMemoryAnswer } from "@/lib/minigames/solo/visualMemory";
import type { VisualMemoryGameProps } from "./types";

type Phase = "intro" | "showing" | "selecting" | "complete";

export function VisualMemoryGame({ challenge, disabled = false, onComplete }: VisualMemoryGameProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const answers = useRef<VisualMemoryAnswer[]>([]);
  const startedAt = useRef(0);
  const completed = useRef(false);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const board = createVisualMemoryBoard(challenge.seed, level);

  useEffect(() => { if (phase !== "showing") return; const timer = window.setTimeout(() => setPhase("selecting"), 1200); return () => window.clearTimeout(timer); }, [phase, level]);

  function begin(event: React.MouseEvent<HTMLButtonElement>) { if (!disabled) { startedAt.current = event.timeStamp; setPhase("showing"); } }
  function end(nextAnswers: VisualMemoryAnswer[], completedLevel: number, elapsedMs: number) { if (!completed.current) { completed.current = true; setPhase("complete"); onComplete({ answers: nextAnswers, claimedCompletedLevel: completedLevel, clientElapsedMs: elapsedMs }); } }
  function select(index: number, eventTimeStamp: number) {
    if (disabled || phase !== "selecting" || selected.includes(index)) return;
    const nextSelected = [...selected, index]; setSelected(nextSelected);
    if (nextSelected.length !== board.highlightedCellCount) return;
    const isCorrect = nextSelected.length === board.highlightedIndexes.length && nextSelected.every((value) => board.highlightedIndexes.includes(value));
    const nextAnswers = [...answers.current, { level, selectedIndexes: nextSelected }]; answers.current = nextAnswers;
    if (!isCorrect || level === MAX_VISUAL_MEMORY_LEVEL) { end(nextAnswers, isCorrect ? level : level - 1, Math.round(eventTimeStamp - startedAt.current)); return; }
    setLevel(level + 1); setSelected([]); setPhase("showing");
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(index, event.timeStamp); } }
  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? board.gridSize : event.key === "ArrowUp" ? -board.gridSize : 0;
    if (!delta) return;
    event.preventDefault();
    const next = Math.min(board.gridSize * board.gridSize - 1, Math.max(0, index + delta));
    cellRefs.current[next]?.focus();
  }
  const visibleIndexes = phase === "showing" ? board.highlightedIndexes : [];
  return <section className="bg-white border border-table-border rounded-card p-4 sm:p-6 space-y-4"><div className="flex justify-between gap-3"><div><h2 className="text-base font-bold text-gray-900">Visual Memory</h2><p className="text-xs text-gray-500">Remember the marked cells, then select them. Shapes and labels supplement colour.</p></div><p aria-live="polite" className="text-sm font-bold text-navy-800 shrink-0">Level {level}</p></div>{phase === "intro" ? <button onClick={begin} disabled={disabled} className="w-full py-2.5 rounded-xl bg-command-black text-white text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">Show pattern</button> : <><p aria-live="polite" className="text-sm text-gray-600">{phase === "showing" ? `Memorize ${board.highlightedCellCount} marked cells.` : phase === "selecting" ? `Select ${board.highlightedCellCount - selected.length} more cells.` : "Submitting your result…"}</p><div role="group" aria-label={`Visual memory level ${level} grid`} className="grid gap-2 max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(${board.gridSize}, minmax(0, 1fr))` }}>{Array.from({ length: board.gridSize * board.gridSize }, (_, index) => { const isPattern = visibleIndexes.includes(index); const isSelected = selected.includes(index); return <button ref={(element) => { cellRefs.current[index] = element; }} key={index} aria-label={`Cell ${index + 1}${isPattern ? ", pattern" : ""}${isSelected ? ", selected" : ""}`} aria-pressed={isSelected} onClick={(event) => select(index, event.timeStamp)} onKeyDown={(event) => { onKeyDown(event, index); moveFocus(event, index); }} disabled={disabled || phase !== "selecting"} className={`aspect-square min-h-11 rounded-lg border-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-600 ${isPattern ? "bg-navy-700 border-navy-800 text-white" : isSelected ? "bg-amber-100 border-amber-600 text-amber-900" : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100"}`}>{isPattern ? "●" : isSelected ? "✓" : index + 1}</button>; })}</div></>}</section>;
}
