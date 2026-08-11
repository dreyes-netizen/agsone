"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Avatar } from "./Avatar";
import type { Employee } from "./types";

export function InvitePanel({ sessionId, apiFetch }: { sessionId: string; apiFetch: ReturnType<typeof useApiClient>["apiFetch"] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function openDropdown() {
    setOpen(true);
    if (employees.length) return;
    setLoadingEmps(true);
    try {
      const res = await apiFetch<{ data: Employee[] }>("/api/employees");
      setEmployees(res.data);
    } finally {
      setLoadingEmps(false);
    }
  }

  async function sendInvite(emp: Employee) {
    setInviting(emp.id);
    try {
      await apiFetch(`/api/minigames/sessions/${sessionId}/invite`, {
        method: "POST",
        body: JSON.stringify({ userId: emp.id }),
      });
      setInvited(prev => new Set([...prev, emp.id]));
    } catch {
      // ignore
    } finally {
      setInviting(null);
    }
  }

  const filtered = employees.filter(e =>
    e.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-navy-300 hover:border-navy-500 hover:bg-navy-50 text-navy-600 hover:text-navy-800 text-sm font-semibold rounded-xl transition-all"
      >
        <UserPlus className="w-4 h-4" aria-hidden="true" /> Invite coworker
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search by name…"
              aria-label="Search employees to invite"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:border-navy-400 transition"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loadingEmps ? (
              <p className="text-xs text-gray-500 text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No employees found</p>
            ) : (
              filtered.slice(0, 20).map(emp => {
                const done = invited.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    onClick={() => !done && sendInvite(emp)}
                    disabled={done || inviting === emp.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${done ? "opacity-60 cursor-default" : "hover:bg-navy-50"}`}
                  >
                    <Avatar player={emp} size={28} />
                    <span className="flex-1 text-sm text-gray-800 truncate">{emp.displayName}</span>
                    <span className={`text-xs font-semibold shrink-0 ${done ? "text-emerald-600" : "text-navy-600"}`}>
                      {done ? "Sent ✓" : inviting === emp.id ? "…" : "Invite"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
