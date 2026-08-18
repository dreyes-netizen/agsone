"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

const MAX_RESULTS = 8;

export function OrgChartSearch({ nodes, onSelect }: { nodes: OrgChartUser[]; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes
      .filter(
        (n) =>
          n.displayName.toLowerCase().includes(q) ||
          n.position?.toLowerCase().includes(q) ||
          n.departmentName?.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [nodes, query]);

  function select(id: string) {
    onSelect(id);
    setQuery("");
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(results[activeIndex].id);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
      <Input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search employees or departments..."
        aria-label="Search employees or departments"
        className="h-9 pl-8 pr-8"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      {results.length > 0 && (
        <ul className="absolute z-10 top-full mt-1 w-full bg-white rounded-lg border border-table-border shadow-md py-1 max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => select(r.id)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex flex-col items-start px-3 py-1.5 text-left text-sm ${
                  i === activeIndex ? "bg-navy-50 text-navy-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="font-medium">{r.displayName}</span>
                <span className="text-xs text-gray-500">
                  {[r.position, r.departmentName].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
