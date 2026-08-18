"use client";

import { useState } from "react";
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
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

// Shared by EmployeeNode's "⋯ → Remove from chart" and EditChartEntryDialog's
// own Remove action, so there's exactly one confirmation UI regardless of
// entry point. Business logic (nulling position/highlight/dashed, leaving
// the removed person's own reports' managerId untouched so they fall out to
// root — see app/admin/org-chart/page.tsx's removeFromChart) is unchanged.
export function RemoveFromChartDialog({
  open,
  onOpenChange,
  node,
  directReportCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: OrgChartUser | null;
  directReportCount: number;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!node) return null;

  async function handleConfirm() {
    setSaving(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {node.displayName} from the org chart?</AlertDialogTitle>
          <AlertDialogDescription>
            {directReportCount > 0
              ? `Their ${directReportCount} direct report${directReportCount === 1 ? "" : "s"} will become top-level entries in the chart.`
              : "This only removes their chart placement — their account is unaffected."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm} disabled={saving}>
            {saving ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
