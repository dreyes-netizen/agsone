"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Loader2, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

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
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Department[] }>("/api/admin/departments")
      .then((res) => setDepartments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

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

  function handleDelete(dept: Department) {
    setDeleteConfirmId(dept.id);
  }

  async function confirmDelete(dept: Department) {
    try {
      await apiFetch(`/api/admin/departments/${dept.id}`, { method: "DELETE" });
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      setDeleteConfirmId(null);
      showToast("success", `"${dept.name}" deleted.`);
    } catch (err) {
      setDeleteConfirmId(null);
      showToast("error", err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div role="alert" aria-live="assertive" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200 ${toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 text-sm mt-1">Manage company departments.</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => { setShowCreateForm(true); setCreateError(""); }}
            className="bg-[#111827] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-700"
          >
            New Department
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
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
              className="bg-[#111827] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-700"
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div>
        ) : departments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No departments yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Description</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Employees</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departments.map((dept) => (
                <tr key={dept.id}>
                  {editingId === dept.id ? (
                    <td colSpan={4} className="px-6 py-4">
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
                            className="bg-[#111827] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-700"
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
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm">{dept.name}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{dept.description ?? "—"}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{dept.employeeCount}</td>
                      <td className="px-6 py-4 text-right">
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
    </div>
  );
}
