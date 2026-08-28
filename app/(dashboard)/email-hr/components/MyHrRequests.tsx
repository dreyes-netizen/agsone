"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { findHrRequestType } from "@/lib/constants/hrRequests";
import {
  HR_REQUEST_STATUS_BADGE,
  HR_REQUEST_STATUS_LABEL,
} from "@/lib/constants/hrRequestStatus";
import type { MyHrRequest } from "../types";

/**
 * The employee's own filed requests. Without this the stored status would be
 * admin-only bookkeeping and logging a copy would buy the employee nothing —
 * they would still be reduced to guessing whether HR had picked their request
 * up.
 */
export function MyHrRequests({ userId }: { userId: string | null }) {
  const { apiFetch } = useApiClient();
  const [rows, setRows] = useState<MyHrRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const json = await apiFetch<{ data: MyHrRequest[] }>("/api/hr-requests?limit=10");
      setRows(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your requests");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Deferred a microtask so `load`'s setState calls don't run synchronously
  // inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useRealtimeChannel(userId ? realtimeTopics.hrRequestsUser(userId) : null, () => void load(), {
    debounceMs: 200,
  });

  if (loading) {
    return <p className="text-sm text-gray-500">Loading your requests…</p>;
  }

  if (error) {
    return (
      <div className="text-sm text-gray-600">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 text-xs font-medium text-navy-700 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8">
        <Inbox className="w-8 h-8 mx-auto text-gray-300" aria-hidden="true" />
        <p className="text-sm text-gray-500 mt-2">You haven&apos;t filed any requests yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-table-border">
      {rows.map((row) => {
        // Falls back to the stored tag if the type has since left the catalog —
        // an old row must stay readable rather than render blank.
        const label = findHrRequestType(row.typeId)?.label ?? row.tag;
        return (
          <li key={row.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
              <p className="text-xs text-gray-500 truncate">{row.subject}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Filed {new Date(row.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" · "}
                Ref {row.clientRef}
              </p>
              {row.adminNote && (
                <p className="text-xs text-gray-600 mt-1 italic">HR: {row.adminNote}</p>
              )}
            </div>
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                HR_REQUEST_STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {HR_REQUEST_STATUS_LABEL[row.status] ?? row.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
