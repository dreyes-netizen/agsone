"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export type ComboboxOption = { id: string; label: string; secondaryLine?: string };

const MAX_RESULTS = 8;

// Searchable single-select for employee/manager pickers inside admin org
// chart dialogs — replaces the plain <select> roster dropdowns. Filter logic
// mirrors OrgChartSearch.tsx's proven pattern; this variant additionally
// shows the current selection as the input's value when closed.
export function EmployeeCombobox({
  options,
  value,
  onChange,
  placeholder = "Search employees...",
  excludeIds,
  disabled,
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  excludeIds?: Set<string>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const pool = excludeIds ? options.filter((o) => !excludeIds.has(o.id)) : options;
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, MAX_RESULTS);
    return pool
      .filter((o) => o.label.toLowerCase().includes(q) || o.secondaryLine?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [options, excludeIds, query]);

  useEffect(() => {
    function onPointerDownOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => document.removeEventListener("pointerdown", onPointerDownOutside);
  }, []);

  function select(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
        <Input
          type="text"
          disabled={disabled}
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 pl-8"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-table-border shadow-md py-1 max-h-60 overflow-y-auto">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => select(o.id)}
                className={`w-full flex flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${o.id === value ? "bg-navy-50" : ""}`}
              >
                <span className="font-medium text-gray-900">{o.label}</span>
                {o.secondaryLine && <span className="text-xs text-gray-500">{o.secondaryLine}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
