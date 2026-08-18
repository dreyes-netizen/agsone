"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmployeeCombobox, type ComboboxOption } from "../EmployeeCombobox";

export type AddEmployeePayload = {
  userId: string;
  position: string;
  managerId: string | null;
  orgChartHighlight: "" | "gold" | "teal";
  orgChartDashed: boolean;
};

// One dialog serves both "+ Add Employee" (global, manager picked from the
// full chart) and "+ Add direct report" (opened from a specific node, with
// that manager preselected and locked) — the two flows differ only in
// whether `presetManager` is set.
export function AddEmployeeDialog({
  open,
  onOpenChange,
  employeeOptions,
  managerOptions,
  presetManager,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeOptions: ComboboxOption[];
  managerOptions: ComboboxOption[];
  presetManager?: { id: string; label: string } | null;
  onSubmit: (payload: AddEmployeePayload) => Promise<void>;
}) {
  // No open/reset effect: the admin page remounts this component (via a
  // `key` that changes on every open) whenever it's opened, so these lazy
  // initializers already run fresh each time rather than carrying over
  // state from a previous session.
  const [userId, setUserId] = useState<string | null>(null);
  const [position, setPosition] = useState("");
  const [managerId, setManagerId] = useState<string | null>(() => presetManager?.id ?? null);
  const [relationship, setRelationship] = useState<"direct" | "dashed">("direct");
  const [highlight, setHighlight] = useState<"" | "gold" | "teal">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!userId) return setError("Choose an employee");
    if (!position.trim()) return setError("Position is required");
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        userId,
        position: position.trim(),
        managerId: presetManager?.id ?? managerId,
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
          <DialogTitle>{presetManager ? "Add Direct Report" : "Add Employee"}</DialogTitle>
          {presetManager && <DialogDescription>Reports to {presetManager.label}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="space-y-1">
            <Label htmlFor="add-employee-combobox">Employee</Label>
            <EmployeeCombobox
              options={employeeOptions}
              value={userId}
              onChange={setUserId}
              placeholder="Select employee..."
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="add-employee-position">Position</Label>
            <Input
              id="add-employee-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Site Director"
            />
          </div>

          {!presetManager && (
            <div className="space-y-1">
              <Label>Reports to</Label>
              <EmployeeCombobox
                options={managerOptions}
                value={managerId}
                onChange={setManagerId}
                placeholder="— Top of chart —"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Relationship</Label>
            <div className="flex flex-col gap-1.5 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input type="radio" name="relationship" checked={relationship === "direct"} onChange={() => setRelationship("direct")} />
                Direct report
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="relationship" checked={relationship === "dashed"} onChange={() => setRelationship("dashed")} />
                Dotted-line / support
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="add-employee-highlight">Highlight color</Label>
            <select
              id="add-employee-highlight"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
