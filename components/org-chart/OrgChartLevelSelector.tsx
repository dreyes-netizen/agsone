"use client";

import { useState } from "react";

const LEVELS: { label: string; value: number | null }[] = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "All", value: null },
];

export function OrgChartLevelSelector({ onSelectLevel }: { onSelectLevel: (level: number | null) => void }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white" role="group" aria-label="Show organization levels">
      {LEVELS.map((level) => (
        <button
          key={level.label}
          type="button"
          onClick={() => {
            setActive(level.value);
            onSelectLevel(level.value);
          }}
          aria-pressed={active === level.value}
          className={`min-w-[36px] h-8 px-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 ${
            active === level.value ? "bg-command-black text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}
