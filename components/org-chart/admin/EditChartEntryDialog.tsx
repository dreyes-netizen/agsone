"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/feed/Avatar";
import { EmployeeCombobox, type ComboboxOption } from "../EmployeeCombobox";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";
import {
  ORG_CHART_RELATIONSHIP_TYPES,
  ORG_CHART_RELATIONSHIP_TYPE_LABEL,
  type OrgChartRelationshipType,
} from "@/lib/constants/orgChartRelationshipTypes";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — matches the size limit already enforced elsewhere in the app's image uploads

export type EditChartEntryPayload = {
  position: string;
  managerId: string | null;
  orgChartHighlight: "" | "gold" | "teal";
  orgChartDashed: boolean;
};

// "Edit chart entry" is deliberately named to distinguish it from opening the
// employee's actual profile — this only ever touches org-chart placement
// (position/manager/highlight/dashed/additional relationships/photo
// override), never identity fields. "Remove from chart" here just delegates
// to onRequestRemove, which the admin page wires to the same shared
// RemoveFromChartDialog the node's ⋯ menu uses directly.
//
// Additional reporting relationships and the photo override are each
// persisted immediately (their own API call per action) rather than folded
// into the dialog's single Save button — same "focused, immediate action"
// pattern the rest of this admin surface already uses (e.g.
// ReorderSiblingsDialog). Save only ever touches position/manager/highlight/
// primary relationship.
export function EditChartEntryDialog({
  open,
  onOpenChange,
  node,
  managerOptions,
  onSubmit,
  onRequestRemove,
  onAddAdditionalManager,
  onRemoveAdditionalManager,
  onUploadPhoto,
  onClearPhoto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: OrgChartUser | null;
  managerOptions: ComboboxOption[];
  onSubmit: (payload: EditChartEntryPayload) => Promise<void>;
  onRequestRemove: () => void;
  onAddAdditionalManager: (managerId: string, relationshipType: OrgChartRelationshipType) => Promise<void>;
  onRemoveAdditionalManager: (managerId: string) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onClearPhoto: () => Promise<void>;
}) {
  // No open/reset effect: the admin page remounts this component (via a
  // `key` that changes on every open) whenever it's opened for a node, so
  // these lazy initializers already run fresh each time.
  const [position, setPosition] = useState(() => node?.position ?? "");
  const [managerId, setManagerId] = useState<string | null>(() => node?.managerId ?? null);
  const [relationship, setRelationship] = useState<"direct" | "dashed">(() => (node?.orgChartDashed ? "dashed" : "direct"));
  const [highlight, setHighlight] = useState<"" | "gold" | "teal">(() => (node?.orgChartHighlight as "gold" | "teal") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newManagerId, setNewManagerId] = useState<string | null>(null);
  const [newRelationshipType, setNewRelationshipType] = useState<OrgChartRelationshipType>("dotted-line");
  const [addingRelationship, setAddingRelationship] = useState(false);
  const [removingManagerId, setRemovingManagerId] = useState<string | null>(null);
  const [relationshipError, setRelationshipError] = useState("");

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!node) return null;

  async function handleSubmit() {
    if (!position.trim()) return setError("Position is required");
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        position: position.trim(),
        managerId,
        orgChartHighlight: highlight,
        orgChartDashed: relationship === "dashed",
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRelationship() {
    if (!newManagerId) return;
    setAddingRelationship(true);
    setRelationshipError("");
    try {
      await onAddAdditionalManager(newManagerId, newRelationshipType);
      setNewManagerId(null);
      setNewRelationshipType("dotted-line");
    } catch (err) {
      setRelationshipError(err instanceof Error ? err.message : "Failed to add relationship");
    } finally {
      setAddingRelationship(false);
    }
  }

  async function handleRemoveRelationship(targetManagerId: string) {
    setRemovingManagerId(targetManagerId);
    setRelationshipError("");
    try {
      await onRemoveAdditionalManager(targetManagerId);
    } catch (err) {
      setRelationshipError(err instanceof Error ? err.message : "Failed to remove relationship");
    } finally {
      setRemovingManagerId(null);
    }
  }

  function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhotoError("Please choose an image file");
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError("Image must be smaller than 5 MB");
    setPhotoError("");
    setUploadingPhoto(true);
    onUploadPhoto(file)
      .catch((err) => setPhotoError(err instanceof Error ? err.message : "Failed to upload photo"))
      .finally(() => setUploadingPhoto(false));
  }

  async function handleClearPhoto() {
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      await onClearPhoto();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to remove override");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const additionalExcludeIds = new Set([node.id, ...(managerId ? [managerId] : []), ...node.additionalManagers.map((m) => m.managerId)]);
  const managerLabel = (id: string) => managerOptions.find((o) => o.id === id)?.label ?? "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Chart Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="space-y-1">
            <Label>Employee</Label>
            <Input disabled value={node.displayName} className="bg-gray-50 text-gray-500" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-chart-position">Position</Label>
            <Input id="edit-chart-position" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Primary manager</Label>
            <EmployeeCombobox
              options={managerOptions}
              value={managerId}
              onChange={setManagerId}
              excludeIds={new Set([node.id])}
              placeholder="— Top of chart —"
            />
          </div>

          <div className="space-y-1">
            <Label>Primary manager relationship</Label>
            <div className="flex flex-col gap-1.5 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input type="radio" name="edit-relationship" checked={relationship === "direct"} onChange={() => setRelationship("direct")} />
                Direct report
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="edit-relationship" checked={relationship === "dashed"} onChange={() => setRelationship("dashed")} />
                Dotted-line / support
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-chart-highlight">Highlight color</Label>
            <select
              id="edit-chart-highlight"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value as "" | "gold" | "teal")}
              className="w-full h-9 border border-gray-300 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            >
              <option value="">None</option>
              <option value="gold">Gold — HR & Compliance</option>
              <option value="teal">Teal — Quality & Training</option>
            </select>
          </div>

          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <Label>Additional reporting relationships</Label>
            <p className="text-xs text-gray-500">
              Secondary/support lines — these never change {node.displayName.split(" ")[0]}&apos;s place in the tree above.
            </p>

            {node.additionalManagers.length > 0 && (
              <ul className="space-y-1.5">
                {node.additionalManagers.map((m) => (
                  <li key={m.managerId} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="flex-1 truncate text-gray-900">{managerLabel(m.managerId)}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {ORG_CHART_RELATIONSHIP_TYPE_LABEL[m.relationshipType as OrgChartRelationshipType] ?? m.relationshipType}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRelationship(m.managerId)}
                      disabled={removingManagerId === m.managerId}
                      aria-label={`Remove additional reporting relationship to ${managerLabel(m.managerId)}`}
                    >
                      {removingManagerId === m.managerId ? "Removing…" : "Remove"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {relationshipError && <p className="text-xs text-red-500">{relationshipError}</p>}

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <EmployeeCombobox
                  options={managerOptions}
                  value={newManagerId}
                  onChange={setNewManagerId}
                  excludeIds={additionalExcludeIds}
                  placeholder="Select manager..."
                />
              </div>
              <select
                aria-label="Relationship type"
                value={newRelationshipType}
                onChange={(e) => setNewRelationshipType(e.target.value as OrgChartRelationshipType)}
                className="h-9 border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              >
                {ORG_CHART_RELATIONSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>{ORG_CHART_RELATIONSHIP_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddRelationship} disabled={!newManagerId || addingRelationship}>
              {addingRelationship ? "Adding…" : "+ Add another manager"}
            </Button>
          </div>

          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <Label>Org Chart Photo</Label>
            <p className="text-xs text-gray-500">Optional headshot shown only on the org chart — never changes {node.displayName.split(" ")[0]}&apos;s profile photo.</p>
            <div className="flex items-center gap-3">
              <Avatar name={node.displayName} url={node.orgChartPhotoUrl ?? node.avatarUrl} size="md" />
              <div className="flex flex-col gap-1.5">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                  aria-label="Upload org chart photo"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  {uploadingPhoto ? "Uploading…" : "Upload New Photo"}
                </Button>
                {node.orgChartPhotoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleClearPhoto} disabled={uploadingPhoto}>
                    Remove Override
                  </Button>
                )}
              </div>
            </div>
            {photoError && <p className="text-xs text-red-500">{photoError}</p>}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onRequestRemove();
            }}
            disabled={saving}
          >
            Remove from chart
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
