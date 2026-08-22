"use client";

/**
 * Pure display formatter — no wall-clock reads, no side effects. Exported so
 * `ChessClock.test.ts` can cover the mm:ss / tenths-of-a-second boundary
 * without mounting a component.
 *
 * - 10s and above: `05:00` (mm:ss)
 * - below 10s:      `00:09.8` (tenths)
 */
export function formatChessClock(ms: number): string {
  const safe = Math.max(0, ms);

  if (safe < 10_000) {
    const seconds = Math.floor(safe / 1000);
    const tenths = Math.floor((safe % 1000) / 100);
    return `00:0${seconds}.${tenths}`;
  }

  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type ChessClockProps = {
  label: string;
  ms: number;
  active: boolean;
};

/**
 * Display-only clock. The parent re-renders this every ~250ms while a game
 * is active (see `ChessBoard`'s `nowMs` interval) — deliberately no
 * `aria-live` here, since announcing a countdown every tick would spam
 * screen-reader users. The label + value are always available on demand via
 * the stable `aria-label` instead.
 */
export function ChessClock({ label, ms, active }: ChessClockProps) {
  return (
    <div
      aria-label={`${label} clock`}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
        active
          ? "border-navy-300 bg-navy-50"
          : "border-table-border bg-white"
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span
        className={`tabular-nums font-bold text-lg ${
          active ? "text-navy-700" : "text-gray-700"
        }`}
      >
        {formatChessClock(ms)}
      </span>
    </div>
  );
}
