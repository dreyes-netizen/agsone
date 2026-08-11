"use client";

import { Palette } from "lucide-react";

export const BANNER_COLOR_OPTIONS = [
  { key: "default",  gradient: "from-navy-500 to-navy-700" },
  { key: "ocean",    gradient: "from-blue-500 to-navy-600" },
  { key: "forest",   gradient: "from-emerald-500 to-emerald-700" },
  { key: "sunset",   gradient: "from-orange-500 to-rose-500" },
  { key: "midnight", gradient: "from-slate-800 to-gray-700" },
  { key: "lavender", gradient: "from-gray-500 to-navy-700" },
  { key: "gold",     gradient: "from-amber-400 to-orange-500" },
  { key: "rose",     gradient: "from-rose-400 to-rose-600" },
] as const;

export const BANNER_GRADIENTS: Record<string, string> = Object.fromEntries(
  BANNER_COLOR_OPTIONS.map(({ key, gradient }) => [key, gradient])
);

export function BannerColorPicker({
  bannerUrl,
  open,
  onToggle,
  onSelect,
}: {
  bannerUrl: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="absolute top-2 right-2">
      <button
        aria-label="Change banner color"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
        className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Palette className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute top-9 right-0 z-10 bg-white rounded-xl border border-gray-200 shadow-lg p-3 w-48">
          <p className="text-xs text-gray-500 font-medium mb-2">Banner color</p>
          <div className="grid grid-cols-4 gap-2">
            {BANNER_COLOR_OPTIONS.map(({ key, gradient }) => (
              <button
                key={key}
                onClick={() => onSelect(key)}
                aria-label={`${key} banner color${(bannerUrl === key || (!bannerUrl && key === "default")) ? " (selected)" : ""}`}
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} ring-2 transition-all focus-visible:outline-none focus-visible:ring-gray-800 ${bannerUrl === key || (!bannerUrl && key === "default") ? "ring-gray-800" : "ring-transparent hover:ring-gray-400"}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
