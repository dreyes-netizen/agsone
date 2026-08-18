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
import { EmployeeCombobox, type ComboboxOption } from "../EmployeeCombobox";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

// Business logic is unchanged from the original always-visible form — the
// replacement inherits position/manager/highlight/dashed and everyone who
// reported to the outgoing person is repointed at the replacement (see
// POST /api/admin/org-chart/replace). Only the surrounding UI moved into a
// dialog opened from the node's overflow menu.
export function ReplaceDialog({
  open,
  onOpenChange,
  outgoing,
  employeeOptions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outgoing: OrgChartUser | null;
  employeeOptions: ComboboxOption[];
  onSubmit: (replacementId: string) => Promise<void>;
}) {
  // No open/reset effect: the admin page remounts this component (via a
  // `key` that changes on every open) whenever it's opened, so state
  // already starts fresh each time.
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!outgoing) return null;

  async function handleSubmit() {
    if (!replacementId) return setError("Choose a replacement");
    setSaving(true);
    setError("");
    try {
      await onSubmit(replacementId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replace");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace {outgoing.displayName}</DialogTitle>
          <DialogDescription>The replacement inherits their position, manager, and reports.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-1">
            <Label>Replacement</Label>
            <EmployeeCombobox
              options={employeeOptions}
              value={replacementId}
              onChange={setReplacementId}
              excludeIds={new Set([outgoing.id])}
              placeholder="Select replacement..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !replacementId}>
            {saving ? "Replacing…" : "Confirm Replacement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
