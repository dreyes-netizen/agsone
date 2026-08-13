"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

type Department = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  employeeCount: number;
};

export default function DepartmentsPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function loadDepartments() {
    try {
      const r = await apiFetch<{ data: Department[]; pages: number }>(`/api/admin/departments?page=${page}`);
      setDepartments(r.data);
      setPages(r.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadDepartments);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, page]);

  useRealtimeChannel(realtimeTopics.departments, loadDepartments, { debounceMs: 200 });

  async function handleCreate() {
    if (!createName.trim()) {
      setCreateError("Name is required");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const res = await apiFetch<{ data: Department }>("/api/admin/departments", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || undefined }),
      });
      setDepartments((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreateForm(false);
      setCreateName("");
      setCreateDesc("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditDesc(dept.description ?? "");
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
      const res = await apiFetch<{ data: Department }>(`/api/admin/departments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || undefined }),
      });
      setDepartments((prev) =>
        prev
          .map((d) => (d.id === id ? { ...d, ...res.data } : d))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(dept: Department) {
    try {
      await apiFetch(`/api/admin/departments/${dept.id}`, { method: "DELETE" });
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      setDeleteConfirmId(null);
      toast.success(`"${dept.name}" deleted.`);
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 text-sm mt-1">Manage company departments.</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => { setShowCreateForm(true); setCreateError(""); }}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            New Department
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">New Department</h2>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="e.g. Engineering"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="Brief description"
              />
            </div>
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
              onClick={() => { setShowCreateForm(false); setCreateName(""); setCreateDesc(""); setCreateError(""); }}
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
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <Building2 className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No departments yet.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] scroll-hint">
          <table className="w-full border-collapse" aria-label="Departments">
            <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-table-border">
                <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Name</th>
                <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Description</th>
                <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Employees</th>
                <th scope="col" className="px-3.5 py-2.5 last:pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept, i) => (
                <tr key={dept.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 && editingId !== dept.id ? "bg-row-alt" : ""}`}>
                  {editingId === dept.id ? (
                    <td colSpan={4} className="px-3.5 py-4 first:pl-5 last:pr-5">
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
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 flex-1"
                            placeholder="Description (optional)"
                          />
                          <button
                            onClick={() => handleEdit(dept.id)}
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
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{dept.name}</td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">{dept.description ?? "—"}</td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">{dept.employeeCount}</td>
                      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(dept)}
                            className="text-navy-600 hover:text-navy-800 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded"
                          >
                            Edit
                          </button>
                          {deleteConfirmId === dept.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Delete?</span>
                              <button onClick={() => confirmDelete(dept)} className="text-xs text-red-600 font-semibold hover:text-red-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded">Yes</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 rounded">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(dept.id)} className="text-red-500 hover:text-red-700 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">Delete</button>
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
