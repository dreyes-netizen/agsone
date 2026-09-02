"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

type Account = {
  id: string;
  name: string;
  createdAt: string;
};

export default function AccountsPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function loadAccounts() {
    try {
      const r = await apiFetch<{ data: Account[]; pages: number }>(`/api/admin/accounts?page=${page}`);
      setAccounts(r.data);
      setPages(r.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadAccounts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, page]);

  useRealtimeChannel(realtimeTopics.accounts, loadAccounts, { debounceMs: 200 });

  async function handleCreate() {
    if (!createName.trim()) {
      setCreateError("Name is required");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const res = await apiFetch<{ data: Account }>("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() }),
      });
      setAccounts((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreateForm(false);
      setCreateName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(acct: Account) {
    setEditingId(acct.id);
    setEditName(acct.name);
    setEditError("");
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      const res = await apiFetch<{ data: Account }>(`/api/admin/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setAccounts((prev) =>
        prev
          .map((a) => (a.id === id ? { ...a, ...res.data } : a))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(acct: Account) {
    try {
      await apiFetch(`/api/admin/accounts/${acct.id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== acct.id));
      setDeleteConfirmId(null);
      toast.success(`"${acct.name}" deleted.`);
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">Manage client accounts employees can tag in Feed posts.</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => { setShowCreateForm(true); setCreateError(""); }}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            New Account
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">New Account</h2>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              placeholder="e.g. Flyland"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setCreateName(""); setCreateError(""); }}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <Building2 className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No accounts yet.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] scroll-hint">
          <table className="w-full border-collapse" aria-label="Accounts">
            <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-table-border">
                <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Name</th>
                <th scope="col" className="px-3.5 py-2.5 last:pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct, i) => (
                <tr key={acct.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 && editingId !== acct.id ? "bg-row-alt" : ""}`}>
                  {editingId === acct.id ? (
                    <td colSpan={2} className="px-3.5 py-4 first:pl-5 last:pr-5">
                      <div className="space-y-3">
                        {editError && <p className="text-sm text-red-500">{editError}</p>}
                        <div className="flex flex-wrap gap-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 w-full sm:w-48"
                            placeholder="Name"
                          />
                          <button
                            onClick={() => handleEdit(acct.id)}
                            disabled={saving}
                            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{acct.name}</td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(acct)}
                            className="text-navy-600 hover:text-navy-800 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded"
                          >
                            Edit
                          </button>
                          {deleteConfirmId === acct.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Delete?</span>
                              <button onClick={() => confirmDelete(acct)} className="text-xs text-red-600 font-semibold hover:text-red-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded">Yes</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 rounded">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(acct.id)} className="text-red-500 hover:text-red-700 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">Delete</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}
