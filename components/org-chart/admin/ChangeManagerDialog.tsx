"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmployeeCombobox, type ComboboxOption } from "../EmployeeCombobox";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

// Manager changes always go through this explicit confirmation step before
// the PATCH fires — never an immediate save — even when triggered by a
// canvas drag-and-drop (see OrgChartCanvas's onRequestReparent). The server
// (PATCH /api/admin/employees/[id]) re-validates the cycle regardless of
// this dialog's client-side excludeIds filtering.
export function ChangeManagerDialog({
  open,
  onOpenChange,
  employee,
  currentManagerLabel,
  managerOptions,
  excludeIds,
  onSubmit,
  initialNewManagerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: OrgChartUser | null;
  currentManagerLabel: string;
  managerOptions: ComboboxOption[];
  excludeIds: Set<string>;
  onSubmit: (newManagerId: string | null) => Promise<void>;
  initialNewManagerId?: string | null;
}) {
  // No open/reset effect: the admin page remounts this component (via a
  // `key` that changes on every open) whenever it's opened for an employee,
  // so these lazy initializers already run fresh each time.
  const [newManagerId, setNewManagerId] = useState<string | null>(() => initialNewManagerId ?? null);
  const [confirming, setConfirming] = useState(() => !!initialNewManagerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!employee) return null;

  const newManagerLabel = managerOptions.find((o) => o.id === newManagerId)?.label ?? "Top of chart";

  async function handleConfirm() {
    setSaving(true);
    setError("");
    try {
      await onSubmit(newManagerId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change manager");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Manager</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="space-y-1">
              <Label>Employee</Label>
              <Input disabled value={employee.displayName} className="bg-gray-50 text-gray-500" />
            </div>

            <div className="space-y-1">
              <Label>Current manager</Label>
              <Input disabled value={currentManagerLabel} className="bg-gray-50 text-gray-500" />
            </div>

            <div className="space-y-1">
              <Label>New manager</Label>
              <EmployeeCombobox
                options={managerOptions}
                value={newManagerId}
                onChange={setNewManagerId}
                excludeIds={excludeIds}
                placeholder="— Top of chart —"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => setConfirming(true)}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={open && confirming} onOpenChange={(o) => { if (!o) setConfirming(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {employee.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Current manager: {currentManagerLabel}
              <br />
              New manager: {newManagerLabel}
              <br />
              This will change their reporting relationship.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} onClick={() => setConfirming(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={saving}>
              {saving ? "Moving…" : "Move Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
