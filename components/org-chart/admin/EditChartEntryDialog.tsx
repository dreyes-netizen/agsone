"use client";

import { useState } from "react";
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
import { EmployeeCombobox, type ComboboxOption } from "../EmployeeCombobox";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

export type EditChartEntryPayload = {
  position: string;
  managerId: string | null;
  orgChartHighlight: "" | "gold" | "teal";
  orgChartDashed: boolean;
};

// "Edit chart entry" is deliberately named to distinguish it from opening the
// employee's actual profile — this only ever touches org-chart placement
// (position/manager/highlight/dashed), never identity fields. "Remove from
// chart" here just delegates to onRequestRemove, which the admin page wires
// to the same shared RemoveFromChartDialog the node's ⋯ menu uses directly.
export function EditChartEntryDialog({
  open,
  onOpenChange,
  node,
  managerOptions,
  onSubmit,
  onRequestRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: OrgChartUser | null;
  managerOptions: ComboboxOption[];
  onSubmit: (payload: EditChartEntryPayload) => Promise<void>;
  onRequestRemove: () => void;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <Label>Reports to</Label>
            <EmployeeCombobox
              options={managerOptions}
              value={managerId}
              onChange={setManagerId}
              excludeIds={new Set([node.id])}
              placeholder="— Top of chart —"
            />
          </div>

          <div className="space-y-1">
            <Label>Relationship</Label>
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
