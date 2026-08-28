"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRealtimeChannels } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { Pagination } from "@/components/ui/pagination";
import { HR_REQUEST_CATEGORIES, findHrCategory } from "@/lib/constants/hrRequests";
import {
  ALL_HR_REQUEST_STATUSES,
  HR_REQUEST_STATUS_LABEL,
} from "@/lib/constants/hrRequestStatus";
import { HrRequestsTable } from "./components/HrRequestsTable";
import { HrRequestDetailDialog } from "./components/HrRequestDetailDialog";
import type { AdminHrRequest } from "./types";

const FILTER_CLASS =
  "border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400";

export default function AdminHrRequestsPage() {
  const { apiFetch } = useApiClient();

  const [requests, setRequests] = useState<AdminHrRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [q, setQ] = useState("");

  const [selected, setSelected] = useState<AdminHrRequest | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);
      if (typeId) params.set("typeId", typeId);
      if (q.trim()) params.set("q", q.trim());

      const res = await apiFetch<{ data: AdminHrRequest[]; pages: number }>(
        `/api/admin/hr-requests?${params.toString()}`,
      );
      setRequests(res.data);
      setPages(res.pages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load HR requests");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, status, categoryId, typeId, q]);

  // Deferred a microtask so `load`'s setState calls don't run synchronously
  // inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useRealtimeChannels([realtimeTopics.hrRequests], () => void load(), { debounceMs: 200 });

  async function handleUpdate(
    id: string,
    nextStatus: AdminHrRequest["status"],
    adminNote: string,
  ) {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/hr-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, adminNote }),
      });
      toast.success(`Marked ${HR_REQUEST_STATUS_LABEL[nextStatus]}`);
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the request");
    } finally {
      setSaving(false);
    }
  }

  // Changing a filter must return to page 1, or a narrowed result set can land
  // the viewer on a page that no longer exists.
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const category = categoryId ? findHrCategory(categoryId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HR Requests</h1>
        <p className="text-gray-500 text-sm mt-1">
          Requests filed from the Email HR page. The employee also sends you the email itself —
          this queue is so nothing gets lost in the inbox.
        </p>
      </div>

      <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="hr-filter-status">
            Status
          </label>
          <select
            id="hr-filter-status"
            value={status}
            onChange={(e) => updateFilter(setStatus, e.target.value)}
            className={FILTER_CLASS}
          >
            <option value="">All statuses</option>
            {ALL_HR_REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {HR_REQUEST_STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="hr-filter-category">
            Category
          </label>
          <select
            id="hr-filter-category"
            value={categoryId}
            onChange={(e) => {
              updateFilter(setCategoryId, e.target.value);
              setTypeId("");
            }}
            className={FILTER_CLASS}
          >
            <option value="">All categories</option>
            {HR_REQUEST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="hr-filter-type">
            Request type
          </label>
          <select
            id="hr-filter-type"
            value={typeId}
            disabled={!category}
            onChange={(e) => updateFilter(setTypeId, e.target.value)}
            className={`${FILTER_CLASS} disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">All types</option>
            {category?.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="hr-filter-search">
            Search employee or subject
          </label>
          <input
            id="hr-filter-search"
            type="search"
            value={q}
            onChange={(e) => updateFilter(setQ, e.target.value)}
            placeholder="Search employee or subject…"
            className={`${FILTER_CLASS} flex-1 min-w-[200px]`}
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading requests…</p>
        ) : (
          <>
            <HrRequestsTable requests={requests} onOpen={setSelected} />
            {pages > 1 && (
              <div className="pt-2">
                <Pagination page={page} pages={pages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <HrRequestDetailDialog
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          saving={saving}
        />
      )}
    </div>
  );
}
