"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { Avatar } from "@/components/feed/Avatar";

type Contact = {
  id: string;
  position: string;
  description: string | null;
  sortOrder: number;
  user: { id: string; displayName: string; email: string; avatarUrl: string | null; orgChartPhotoUrl: string | null };
};

type RosterEntry = { id: string; displayName: string; email: string; position: string | null };

type FormState = { userId: string; position: string; description: string; sortOrder: string };
const EMPTY_FORM: FormState = { userId: "", position: "", description: "", sortOrder: "0" };

export default function AdminPointsOfContactPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function load() {
    try {
      const [contactsRes, rosterRes] = await Promise.all([
        apiFetch<{ data: Contact[] }>("/api/admin/points-of-contact"),
        apiFetch<{ data: RosterEntry[] }>("/api/admin/roster"),
      ]);
      setContacts(contactsRes.data);
      setRoster(rosterRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useRealtimeChannel(realtimeTopics.pointsOfContact, load, { debounceMs: 200 });

  // Position suggestions reuse whatever's already been typed on the org
  // chart or on other contacts — HR asked for this so they're not retyping
  // the same job titles twice.
  const positionSuggestions = useMemo(() => {
    const set = new Set<string>();
    roster.forEach((r) => r.position && set.add(r.position));
    contacts.forEach((c) => set.add(c.position));
    return Array.from(set).sort();
  }, [roster, contacts]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Contact) {
    setForm({ userId: c.user.id, position: c.position, description: c.description ?? "", sortOrder: String(c.sortOrder) });
    setEditingId(c.id);
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function submit() {
    if (!form.userId) return setError("Choose an employee");
    if (!form.position.trim()) return setError("Position is required");
    setSaving(true);
    setError("");
    const body = {
      userId: form.userId,
      position: form.position.trim(),
      description: form.description.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/admin/points-of-contact/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Contact updated.");
      } else {
        await apiFetch("/api/admin/points-of-contact", { method: "POST", body: JSON.stringify(body) });
        toast.success("Contact added.");
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(c: Contact) {
    try {
      await apiFetch(`/api/admin/points-of-contact/${c.id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      toast.success(`Removed ${c.user.displayName}.`);
      load();
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Points of Contact</h1>
          <p className="text-gray-500 text-sm mt-1">Manage who employees are directed to for common requests.</p>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            Add Contact
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">{editingId ? "Edit Contact" : "New Contact"}</h2>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              {editingId ? (
                <input disabled value={roster.find((r) => r.id === form.userId)?.displayName ?? ""} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
              ) : (
                <select
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                >
                  <option value="">Select employee…</option>
                  {roster.map((r) => (
                    <option key={r.id} value={r.id}>{r.displayName} ({r.email})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input
                type="text"
                list="poc-position-suggestions"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="e.g. HR & Compliance Manager"
              />
              <datalist id="poc-position-suggestions">
                {positionSuggestions.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="What to reach out to them for"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={closeForm}
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
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <Users className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No points of contact yet.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] scroll-hint">
            <table className="w-full border-collapse" aria-label="Points of Contact">
              <thead className="sticky top-0 z-10 bg-table-head">
                <tr className="border-b border-table-border">
                  <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Employee</th>
                  <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Position</th>
                  <th scope="col" className="text-left font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted px-3.5 py-2.5 first:pl-5 last:pr-5">Description</th>
                  <th scope="col" className="px-3.5 py-2.5 last:pr-5"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                    <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                      <div className="flex items-center gap-2">
                        <Avatar name={c.user.displayName} url={c.user.orgChartPhotoUrl ?? c.user.avatarUrl} size="sm" />
                        <span className="font-medium text-gray-900">{c.user.displayName}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-[11px] text-[13px] text-gray-500">{c.position}</td>
                    <td className="px-3.5 py-[11px] text-[13px] text-gray-500">{c.description ?? "—"}</td>
                    <td className="px-3.5 py-[11px] text-[13px] last:pr-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="text-navy-600 hover:text-navy-800 text-sm font-medium">Edit</button>
                        {deleteConfirmId === c.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 font-medium">Delete?</span>
                            <button onClick={() => confirmDelete(c)} className="text-xs text-red-600 font-semibold hover:text-red-800">Yes</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500 hover:text-gray-700">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(c.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                        )}
                      </div>
                    </td>
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
