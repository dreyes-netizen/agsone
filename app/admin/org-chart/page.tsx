"use client";

import { useEffect, useState } from "react";
import { Loader2, Network } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannels } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { buildOrgChartTree, type OrgChartUser } from "@/lib/orgChart/buildTree";
import { OrgChartTree } from "@/components/org-chart/OrgChartTree";

type RosterEntry = { id: string; displayName: string; email: string; avatarUrl: string | null; position: string | null };

type NodeFormState = {
  userId: string;
  position: string;
  managerId: string;
  orgChartHighlight: "" | "gold" | "teal";
  orgChartDashed: boolean;
};

const EMPTY_FORM: NodeFormState = { userId: "", position: "", managerId: "", orgChartHighlight: "", orgChartDashed: false };

export default function AdminOrgChartPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<OrgChartUser[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"none" | "add" | "edit">("none");
  const [form, setForm] = useState<NodeFormState>(EMPTY_FORM);

  const [replacingUser, setReplacingUser] = useState<OrgChartUser | null>(null);
  const [replacementId, setReplacementId] = useState("");

  async function load() {
    try {
      const [chartRes, rosterRes] = await Promise.all([
        apiFetch<{ data: OrgChartUser[] }>("/api/org-chart"),
        apiFetch<{ data: RosterEntry[] }>("/api/admin/roster"),
      ]);
      setNodes(chartRes.data);
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

  useRealtimeChannels([realtimeTopics.orgChart, realtimeTopics.employees], load, { debounceMs: 200 });

  const chartIds = new Set(nodes.map((n) => n.id));
  const rosterNotInChart = roster.filter((r) => !chartIds.has(r.id));
  const roots = buildOrgChartTree(nodes);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError("");
    setMode("add");
  }

  function openEdit(node: OrgChartUser) {
    setForm({
      userId: node.id,
      position: node.position ?? "",
      managerId: node.managerId ?? "",
      orgChartHighlight: (node.orgChartHighlight as "gold" | "teal") ?? "",
      orgChartDashed: node.orgChartDashed,
    });
    setError("");
    setMode("edit");
  }

  function closeForm() {
    setMode("none");
    setForm(EMPTY_FORM);
    setError("");
  }

  async function submitForm() {
    if (!form.userId) {
      setError("Choose an employee");
      return;
    }
    if (!form.position.trim()) {
      setError("Position is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/admin/employees/${form.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          position: form.position.trim(),
          managerId: form.managerId || null,
          orgChartHighlight: form.orgChartHighlight || null,
          orgChartDashed: form.orgChartDashed,
        }),
      });
      toast.success(mode === "add" ? "Added to org chart." : "Org chart entry updated.");
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeFromChart(node: OrgChartUser) {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/employees/${node.id}`, {
        method: "PATCH",
        body: JSON.stringify({ position: null, orgChartHighlight: null, orgChartDashed: false }),
      });
      toast.success(`Removed ${node.displayName} from the org chart.`);
      closeForm();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  }

  async function submitReplace() {
    if (!replacingUser || !replacementId) return;
    setSaving(true);
    try {
      await apiFetch("/api/admin/org-chart/replace", {
        method: "POST",
        body: JSON.stringify({ oldUserId: replacingUser.id, newUserId: replacementId }),
      });
      toast.success("Employee replaced in the org chart.");
      setReplacingUser(null);
      setReplacementId("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to replace");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Org Chart</h1>
          <p className="text-gray-500 text-sm mt-1">Add, edit, or replace people in the org chart.</p>
        </div>
        {mode === "none" && (
          <button
            onClick={openAdd}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            Add to Org Chart
          </button>
        )}
      </div>

      {mode !== "none" && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">{mode === "add" ? "Add to Org Chart" : "Edit Org Chart Entry"}</h2>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              {mode === "add" ? (
                <select
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                >
                  <option value="">Select employee…</option>
                  {rosterNotInChart.map((r) => (
                    <option key={r.id} value={r.id}>{r.displayName} ({r.email})</option>
                  ))}
                </select>
              ) : (
                <input disabled value={roster.find((r) => r.id === form.userId)?.displayName ?? ""} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                placeholder="e.g. Site Director"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reports to</label>
              <select
                value={form.managerId}
                onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              >
                <option value="">— Top of chart —</option>
                {nodes.filter((n) => n.id !== form.userId).map((n) => (
                  <option key={n.id} value={n.id}>{n.displayName} — {n.position}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Highlight color</label>
              <select
                value={form.orgChartHighlight}
                onChange={(e) => setForm((f) => ({ ...f, orgChartHighlight: e.target.value as "" | "gold" | "teal" }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              >
                <option value="">None</option>
                <option value="gold">Gold — HR & Compliance</option>
                <option value="teal">Teal — Quality & Training</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.orgChartDashed}
              onChange={(e) => setForm((f) => ({ ...f, orgChartDashed: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Dotted-line / support reporting relationship
          </label>
          <div className="flex gap-2">
            <button
              onClick={submitForm}
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
            {mode === "edit" && (
              <button
                onClick={() => removeFromChart(nodes.find((n) => n.id === form.userId)!)}
                disabled={saving}
                className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
              >
                Remove from chart
              </button>
            )}
          </div>
        </div>
      )}

      {replacingUser && (
        <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Replace {replacingUser.displayName}</h2>
          <p className="text-sm text-gray-500">The replacement inherits their position, manager, and reports.</p>
          <select
            value={replacementId}
            onChange={(e) => setReplacementId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
          >
            <option value="">Select replacement…</option>
            {roster.filter((r) => r.id !== replacingUser.id).map((r) => (
              <option key={r.id} value={r.id}>{r.displayName} ({r.email})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={submitReplace}
              disabled={saving || !replacementId}
              className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {saving ? "Replacing…" : "Confirm Replacement"}
            </button>
            <button
              onClick={() => { setReplacingUser(null); setReplacementId(""); }}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12">
            <Network className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">Nobody is in the org chart yet.</p>
          </div>
        ) : (
          <OrgChartTree
            roots={roots}
            linkToProfile={false}
            renderExtra={(node) => (
              <div className="flex gap-2 text-xs">
                <button onClick={() => openEdit(node)} className="text-navy-600 hover:text-navy-800 font-medium">Edit</button>
                <button onClick={() => { setReplacingUser(node); setReplacementId(""); }} className="text-gray-500 hover:text-gray-700 font-medium">Replace</button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
