"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";

type SearchResult = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  department: { id: string; name: string } | null;
};

const roleLabel: Record<SearchResult["role"], string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Admin",
};

const roleBadgeClass: Record<SearchResult["role"], string> = {
  EMPLOYEE: "bg-gray-100 text-gray-600",
  MANAGER: "bg-blue-100 text-blue-700",
  HR_ADMIN: "bg-violet-100 text-violet-700",
};

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-bold text-sm shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { apiFetch } = useApiClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setFocusIndex(-1);
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await apiFetch<{ data: SearchResult[] }>(
            `/api/search?q=${encodeURIComponent(q)}`
          );
          setResults(res.data);
          setError(false);
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [apiFetch]
  );

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    search(e.target.value);
    setFocusIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, -1));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search employees…"
            value={query}
            onChange={handleQueryChange}
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-gray-200 border-t-navy-500 rounded-full animate-spin shrink-0" />
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {error ? (
            <p className="text-sm text-gray-400 text-center py-8">Search unavailable</p>
          ) : query.length < 2 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              Type at least 2 characters
            </p>
          ) : results.length === 0 && !loading ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No employees found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                  focusIndex === i ? "bg-gray-50" : "hover:bg-gray-50/60"
                }`}
              >
                <Avatar name={r.displayName} url={r.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.displayName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{r.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.department && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {r.department.name}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeClass[r.role]}`}
                  >
                    {roleLabel[r.role]}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50/80">
          <span className="text-xs text-gray-400">↑↓ navigate</span>
          <span className="text-xs text-gray-400">Esc to close</span>
        </div>
      </div>
    </div>
  );
}
