"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Compact "Fit − 100% +" bar. The center button both displays the current
 * zoom level and acts as a shortcut to 100% (one image pixel per screen
 * pixel) — mirrors how the Fit button doubles as a label + action.
 */
export function MediaZoomControls({
  zoomPercent,
  isFit,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onFit,
  onZoomTo100,
}: {
  zoomPercent: number;
  isFit: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onZoomTo100: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Zoom controls"
      className="flex items-center gap-0.5 bg-black/65 backdrop-blur-sm rounded-full px-1.5 py-1.5 text-white shadow-lg"
    >
      <button
        type="button"
        onClick={onFit}
        aria-pressed={isFit}
        aria-label="Fit image to screen"
        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
          isFit ? "bg-white/20" : "hover:bg-white/10"
        }`}
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onZoomTo100}
        aria-label="Zoom to 100%"
        className="w-12 text-center text-xs font-semibold tabular-nums px-1 py-1 rounded-full hover:bg-white/10 transition-colors"
      >
        {zoomPercent}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
