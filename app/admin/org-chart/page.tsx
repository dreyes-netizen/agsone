"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Network, Maximize, Pencil, Check, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannels } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { uploadOrgChartPhoto } from "@/lib/cloudinary/upload";
import type { OrgChartRelationshipType } from "@/lib/constants/orgChartRelationshipTypes";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";
import { OrgChartCanvas, type OrgChartCanvasApi } from "@/components/org-chart/OrgChartCanvas";
import { OrgChartSearch } from "@/components/org-chart/OrgChartSearch";
import { OrgChartLevelSelector } from "@/components/org-chart/OrgChartLevelSelector";
import type { ComboboxOption } from "@/components/org-chart/EmployeeCombobox";
import type { EmployeeNodeAdminActions } from "@/components/org-chart/EmployeeNode";
import { AddEmployeeDialog, type AddEmployeePayload } from "@/components/org-chart/admin/AddEmployeeDialog";
import { EditChartEntryDialog, type EditChartEntryPayload } from "@/components/org-chart/admin/EditChartEntryDialog";
import { ReplaceDialog } from "@/components/org-chart/admin/ReplaceDialog";
import { ChangeManagerDialog } from "@/components/org-chart/admin/ChangeManagerDialog";
import { ReorderSiblingsDialog } from "@/components/org-chart/admin/ReorderSiblingsDialog";
import { RemoveFromChartDialog } from "@/components/org-chart/admin/RemoveFromChartDialog";

type RosterEntry = { id: string; displayName: string; email: string; avatarUrl: string | null; position: string | null };

const bySortOrder = (a: OrgChartUser, b: OrgChartUser) =>
  a.orgChartSortOrder - b.orgChartSortOrder || a.displayName.localeCompare(b.displayName);

function rosterOption(r: RosterEntry): ComboboxOption {
  return { id: r.id, label: r.displayName, secondaryLine: r.position ?? r.email };
}

function managerOption(n: OrgChartUser): ComboboxOption {
  return { id: n.id, label: n.displayName, secondaryLine: [n.position, n.departmentName].filter(Boolean).join(" · ") };
}

// Every id transitively under `rootId` (via managerId) — used to stop an
// employee from being reassigned under their own report (a cycle the server
// also rejects, but excluding it from the picker avoids a pointless round
// trip and a confusing error).
function collectDescendantIds(allNodes: OrgChartUser[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const n of allNodes) {
    if (!n.managerId) continue;
    const arr = childrenByParent.get(n.managerId) ?? [];
    arr.push(n.id);
    childrenByParent.set(n.managerId, arr);
  }
  const result = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

export default function AdminOrgChartPage() {
  const { apiFetch } = useApiClient();
  const { user, token, loading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<OrgChartUser[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const canvasApiRef = useRef<OrgChartCanvasApi | null>(null);

  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [addReportManager, setAddReportManager] = useState<OrgChartUser | null>(null);
  const [editingNode, setEditingNode] = useState<OrgChartUser | null>(null);
  const [replacingNode, setReplacingNode] = useState<OrgChartUser | null>(null);
  const [removingNode, setRemovingNode] = useState<OrgChartUser | null>(null);
  const [changeManagerNode, setChangeManagerNode] = useState<OrgChartUser | null>(null);
  const [changeManagerPreset, setChangeManagerPreset] = useState<string | null>(null);
  const [reorderContext, setReorderContext] = useState<{ managerId: string | null; managerLabel: string; siblings: OrgChartUser[] } | null>(null);
  // Bumped on every dialog-opening action so `key={openNonce}` forces each
  // dialog to remount fresh (rather than resetting its form state via a
  // useEffect keyed on `open`, which the project's lint rules flag as an
  // anti-pattern — see https://react.dev/learn/you-might-not-need-an-effect).
  const [openNonce, setOpenNonce] = useState(0);
  function bumpOpenNonce() {
    setOpenNonce((n) => n + 1);
  }

  async function load() {
    try {
      const [chartRes, rosterRes] = await Promise.all([
        apiFetch<{ data: OrgChartUser[] }>("/api/org-chart"),
        apiFetch<{ data: RosterEntry[] }>("/api/admin/roster"),
      ]);
      setNodes(chartRes.data);
      setRoster(rosterRes.data);
      return chartRes.data;
    } catch (err) {
      console.error(err);
      return undefined;
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

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const chartIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const rosterNotInChart = useMemo(() => roster.filter((r) => !chartIds.has(r.id)), [roster, chartIds]);
  const employeeOptions = useMemo(() => rosterNotInChart.map(rosterOption), [rosterNotInChart]);
  const managerOptions = useMemo(() => nodes.map(managerOption), [nodes]);
  const roots = useMemo(() => nodes.filter((n) => !n.managerId || !chartIds.has(n.managerId)).sort(bySortOrder), [nodes, chartIds]);

  function directReportsOf(managerId: string): OrgChartUser[] {
    return nodes.filter((n) => n.managerId === managerId).sort(bySortOrder);
  }

  async function patchEmployee(id: string, body: Record<string, unknown>) {
    await apiFetch(`/api/admin/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  }

  async function handleAddEmployee(payload: AddEmployeePayload) {
    await patchEmployee(payload.userId, {
      position: payload.position,
      managerId: payload.managerId,
      orgChartHighlight: payload.orgChartHighlight || null,
      orgChartDashed: payload.orgChartDashed,
    });
    toast.success(addReportManager ? "Direct report added." : "Employee added to org chart.");
    load();
  }

  async function handleEditEntry(node: OrgChartUser, payload: EditChartEntryPayload) {
    await patchEmployee(node.id, {
      position: payload.position,
      managerId: payload.managerId,
      orgChartHighlight: payload.orgChartHighlight || null,
      orgChartDashed: payload.orgChartDashed,
    });
    toast.success("Org chart entry updated.");
    load();
  }

  async function handleReplace(outgoing: OrgChartUser, replacementId: string) {
    await apiFetch("/api/admin/org-chart/replace", {
      method: "POST",
      body: JSON.stringify({ oldUserId: outgoing.id, newUserId: replacementId }),
    });
    toast.success("Employee replaced in the org chart.");
    load();
  }

  async function handleRemove(node: OrgChartUser) {
    await patchEmployee(node.id, { position: null, orgChartHighlight: null, orgChartDashed: false });
    toast.success(`Removed ${node.displayName} from the org chart.`);
    load();
  }

  async function handleChangeManager(employee: OrgChartUser, newManagerId: string | null) {
    await patchEmployee(employee.id, { managerId: newManagerId });
    toast.success("Reporting manager updated.");
    load();
  }

  async function handleReorderSiblings(managerId: string | null, orderedUserIds: string[]) {
    try {
      await apiFetch("/api/admin/org-chart/reorder", {
        method: "POST",
        body: JSON.stringify({ managerId, orderedUserIds }),
      });
      toast.success("Employee order updated.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
    }
  }

  // Additional (secondary) reporting relationships and the photo override
  // are each their own immediate action rather than part of the dialog's
  // single Save — reload afterward and refresh `editingNode` in place so the
  // still-open Edit dialog reflects the change instead of closing.
  async function refreshEditingNode(userId: string) {
    const updated = await load();
    setEditingNode(updated?.find((n) => n.id === userId) ?? null);
  }

  async function handleAddAdditionalManager(userId: string, managerId: string, relationshipType: OrgChartRelationshipType) {
    await apiFetch("/api/admin/org-chart/additional-reports", {
      method: "POST",
      body: JSON.stringify({ userId, managerId, relationshipType }),
    });
    await refreshEditingNode(userId);
    toast.success("Additional reporting relationship added.");
  }

  async function handleRemoveAdditionalManager(userId: string, managerId: string) {
    await apiFetch("/api/admin/org-chart/additional-reports", {
      method: "DELETE",
      body: JSON.stringify({ userId, managerId }),
    });
    await refreshEditingNode(userId);
    toast.success("Additional reporting relationship removed.");
  }

  async function handleUploadOrgChartPhoto(userId: string, file: File) {
    const { publicId } = await uploadOrgChartPhoto(file, token!);
    await apiFetch("/api/admin/org-chart/photo", { method: "PATCH", body: JSON.stringify({ userId, publicId }) });
    await refreshEditingNode(userId);
    toast.success("Org chart photo updated.");
  }

  async function handleClearOrgChartPhoto(userId: string) {
    await apiFetch("/api/admin/org-chart/photo", { method: "PATCH", body: JSON.stringify({ userId, publicId: null }) });
    await refreshEditingNode(userId);
    toast.success("Org chart photo override removed.");
  }

  // Canvas drag → reparent is always a confirmation, never an immediate
  // save: pre-fill Change Manager with the drop target already selected and
  // jump straight to its confirmation step.
  function handleRequestReparent(employeeId: string, newManagerId: string) {
    const employee = nodesById.get(employeeId);
    if (!employee) return;
    bumpOpenNonce();
    setChangeManagerNode(employee);
    setChangeManagerPreset(newManagerId);
  }

  const adminActions: EmployeeNodeAdminActions = useMemo(
    () => ({
      onAddReport: (id) => {
        const manager = nodesById.get(id);
        if (manager) {
          bumpOpenNonce();
          setAddReportManager(manager);
        }
      },
      onEditEntry: (id) => {
        const node = nodesById.get(id);
        if (node) {
          bumpOpenNonce();
          setEditingNode(node);
        }
      },
      onChangeManager: (id) => {
        const node = nodesById.get(id);
        if (node) {
          bumpOpenNonce();
          setChangeManagerNode(node);
          setChangeManagerPreset(null);
        }
      },
      onReorderSiblings: (id) => {
        const manager = nodesById.get(id);
        if (!manager) return;
        bumpOpenNonce();
        setReorderContext({ managerId: manager.id, managerLabel: manager.displayName, siblings: directReportsOf(manager.id) });
      },
      onReplace: (id) => {
        const node = nodesById.get(id);
        if (node) {
          bumpOpenNonce();
          setReplacingNode(node);
        }
      },
      onRemove: (id) => {
        const node = nodesById.get(id);
        if (node) setRemovingNode(node);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesById, nodes],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Org Chart</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your organization&apos;s reporting structure.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { bumpOpenNonce(); setAddReportManager(null); setAddEmployeeOpen(true); }}
            className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            + Add Employee
          </button>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            aria-pressed={editMode}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
              editMode ? "bg-navy-600 text-white hover:bg-navy-700" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {editMode ? <Check className="w-4 h-4" aria-hidden="true" /> : <Pencil className="w-4 h-4" aria-hidden="true" />}
            {editMode ? "Done" : "Edit Organization"}
          </button>
        </div>
      </div>

      {editMode && (
        <p className="text-xs text-navy-700 bg-navy-50 border border-navy-100 rounded-lg px-3 py-2">
          Editing Organization — drag a card onto a sibling to reorder, or onto another manager to reparent (with confirmation).
        </p>
      )}

      {!loading && nodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <OrgChartSearch nodes={nodes} onSelect={(id) => canvasApiRef.current?.focusNode(id)} />
          <div className="flex items-center gap-2">
            <OrgChartLevelSelector onSelectLevel={(level) => canvasApiRef.current?.setCollapseLevel(level)} />
            <button
              type="button"
              onClick={() => canvasApiRef.current?.fitAll()}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
            >
              <Maximize className="w-4 h-4" aria-hidden="true" />
              Fit
            </button>
            {editMode && roots.length > 1 && (
              <button
                type="button"
                onClick={() => { bumpOpenNonce(); setReorderContext({ managerId: null, managerLabel: "Top of chart", siblings: roots }); }}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
              >
                <ListOrdered className="w-4 h-4" aria-hidden="true" />
                Reorder Top Level
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12">
            <Network className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">The org chart hasn&apos;t been set up yet.</p>
          </div>
        ) : (
          <OrgChartCanvas
            nodes={nodes}
            onReady={(api) => (canvasApiRef.current = api)}
            linkToProfile={false}
            editMode={editMode}
            adminActions={adminActions}
            onReorderSiblings={handleReorderSiblings}
            onRequestReparent={handleRequestReparent}
          />
        )}
      </div>

      <AddEmployeeDialog
        key={`add-${openNonce}`}
        open={addEmployeeOpen || !!addReportManager}
        onOpenChange={(open) => { if (!open) { setAddEmployeeOpen(false); setAddReportManager(null); } }}
        employeeOptions={employeeOptions}
        managerOptions={managerOptions}
        presetManager={addReportManager ? { id: addReportManager.id, label: addReportManager.displayName } : null}
        onSubmit={handleAddEmployee}
      />

      <EditChartEntryDialog
        key={`edit-${openNonce}`}
        open={!!editingNode}
        onOpenChange={(open) => { if (!open) setEditingNode(null); }}
        node={editingNode}
        managerOptions={managerOptions}
        onSubmit={(payload) => handleEditEntry(editingNode!, payload)}
        onRequestRemove={() => { if (editingNode) setRemovingNode(editingNode); }}
        onAddAdditionalManager={(managerId, relationshipType) => handleAddAdditionalManager(editingNode!.id, managerId, relationshipType)}
        onRemoveAdditionalManager={(managerId) => handleRemoveAdditionalManager(editingNode!.id, managerId)}
        onUploadPhoto={(file) => handleUploadOrgChartPhoto(editingNode!.id, file)}
        onClearPhoto={() => handleClearOrgChartPhoto(editingNode!.id)}
      />

      <ReplaceDialog
        key={`replace-${openNonce}`}
        open={!!replacingNode}
        onOpenChange={(open) => { if (!open) setReplacingNode(null); }}
        outgoing={replacingNode}
        employeeOptions={roster.filter((r) => r.id !== replacingNode?.id).map(rosterOption)}
        onSubmit={(replacementId) => handleReplace(replacingNode!, replacementId)}
      />

      <ChangeManagerDialog
        key={`manager-${openNonce}`}
        open={!!changeManagerNode}
        onOpenChange={(open) => { if (!open) { setChangeManagerNode(null); setChangeManagerPreset(null); } }}
        employee={changeManagerNode}
        currentManagerLabel={changeManagerNode?.managerId ? (nodesById.get(changeManagerNode.managerId)?.displayName ?? "—") : "Top of chart"}
        managerOptions={managerOptions}
        excludeIds={changeManagerNode ? new Set([changeManagerNode.id, ...collectDescendantIds(nodes, changeManagerNode.id)]) : new Set()}
        initialNewManagerId={changeManagerPreset}
        onSubmit={(newManagerId) => handleChangeManager(changeManagerNode!, newManagerId)}
      />

      <ReorderSiblingsDialog
        key={`reorder-${openNonce}`}
        open={!!reorderContext}
        onOpenChange={(open) => { if (!open) setReorderContext(null); }}
        managerLabel={reorderContext?.managerLabel ?? ""}
        siblings={reorderContext?.siblings ?? []}
        onSubmit={(orderedIds) => handleReorderSiblings(reorderContext!.managerId, orderedIds)}
      />

      <RemoveFromChartDialog
        open={!!removingNode}
        onOpenChange={(open) => { if (!open) setRemovingNode(null); }}
        node={removingNode}
        directReportCount={removingNode ? nodes.filter((n) => n.managerId === removingNode.id).length : 0}
        onConfirm={() => handleRemove(removingNode!)}
      />
    </div>
  );
}
