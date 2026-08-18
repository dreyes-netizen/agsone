"use client";

import { Search, X } from "lucide-react";

interface OffenseSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function OffenseSearch({ value, onChange }: OffenseSearchProps) {
  return (
    <div className="max-w-md">
      <label htmlFor="offense-search" className="sr-only">
        Search offenses
      </label>
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          id="offense-search"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search offenses…"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
