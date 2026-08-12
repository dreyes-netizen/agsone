"use client";

import type { Session } from "../types";

export function DnBBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const state = session.state as {
    rows: number; cols: number;
    hLines: boolean[][]; vLines: boolean[][];
    boxes: (number | null)[][];
    score: [number, number];
  };

  const myId = session.myRole === "host" ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;
  const myNum = session.myRole === "host" ? 1 : 2;
  const { rows, cols, hLines, vLines, boxes, score } = state;
  const gridRows = 2 * rows + 1;
  const gridCols = 2 * cols + 1;

  function renderCell(gr: number, gc: number) {
    const isEvenRow = gr % 2 === 0;
    const isEvenCol = gc % 2 === 0;

    if (isEvenRow && isEvenCol) {
      return <div key={`d-${gr}-${gc}`} className="w-3 h-3 rounded-full bg-gray-600" />;
    }
    if (isEvenRow && !isEvenCol) {
      const r = gr / 2;
      const c = (gc - 1) / 2;
      const drawn = hLines[r]?.[c];
      const color = drawn ? (boxes[r]?.[c] === 1 || (r > 0 && boxes[r-1]?.[c] === 1) ? "bg-navy-600" : boxes[r]?.[c] === 2 || (r > 0 && boxes[r-1]?.[c] === 2) ? "bg-rose-500" : "bg-gray-400") : "";
      return (
        <button
          key={`h-${r}-${c}`}
          onClick={() => isMyTurn && !drawn && onMove({ lineType: "h", row: r, col: c })}
          disabled={drawn || !isMyTurn}
          className={`h-3 w-full rounded-full transition-all ${
            drawn ? color :
            isMyTurn ? "bg-gray-200 hover:bg-navy-400 active:bg-navy-600 cursor-pointer" :
            "bg-gray-150 cursor-default"
          }`}
        />
      );
    }
    if (!isEvenRow && isEvenCol) {
      const r = (gr - 1) / 2;
      const c = gc / 2;
      const drawn = vLines[r]?.[c];
      return (
        <button
          key={`v-${r}-${c}`}
          onClick={() => isMyTurn && !drawn && onMove({ lineType: "v", row: r, col: c })}
          disabled={drawn || !isMyTurn}
          className={`w-3 h-full rounded-full transition-all ${
            drawn ? "bg-gray-400" :
            isMyTurn ? "bg-gray-200 hover:bg-navy-400 active:bg-navy-600 cursor-pointer" :
            "bg-gray-150 cursor-default"
          }`}
        />
      );
    }
    const r = (gr - 1) / 2;
    const c = (gc - 1) / 2;
    const owner = boxes[r]?.[c];
    return (
      <div key={`b-${r}-${c}`} className={`rounded-lg flex items-center justify-center text-base font-bold transition-colors ${
        owner === 1 ? "bg-navy-200 text-navy-600" :
        owner === 2 ? "bg-rose-200 text-rose-600" :
        "bg-transparent"
      }`}>
        {owner === 1 ? "●" : owner === 2 ? "●" : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-navy-600 mx-auto mb-1 shadow-sm" />
          <p className="text-3xl font-bold text-gray-900">{score[0]}</p>
          <p className="text-xs text-gray-500 mt-0.5">{session.host.displayName}</p>
        </div>
        <p className="text-gray-300 font-bold">—</p>
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-rose-500 mx-auto mb-1 shadow-sm" />
          <p className="text-3xl font-bold text-gray-900">{score[1]}</p>
          <p className="text-xs text-gray-500 mt-0.5">{session.guest?.displayName ?? "Opponent"}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className="inline-grid gap-1.5 p-4 bg-gray-50 border border-gray-200 rounded-2xl w-full"
          style={{
            gridTemplateColumns: Array.from({ length: gridCols }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
            gridTemplateRows: Array.from({ length: gridRows }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
            aspectRatio: "1",
          }}
        >
          {Array.from({ length: gridRows }, (_, gr) =>
            Array.from({ length: gridCols }, (_, gc) => renderCell(gr, gc))
          )}
        </div>
      </div>

      <p className="text-xs text-center text-gray-500">
        You are <span className={myNum === 1 ? "text-navy-600 font-semibold" : "text-rose-600 font-semibold"}>
          {myNum === 1 ? "🔵 Navy" : "🔴 Red"}
        </span>
        {isMyTurn && " · Tap a line between dots"}
      </p>
    </div>
  );
}
