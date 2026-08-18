"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";

// The only reorder path on touch devices (drag is desktop-only), and a
// manual escape hatch on desktop if canvas drag-and-drop ever misbehaves.
// Persists through the same /api/admin/org-chart/reorder endpoint the
// canvas drag path uses.
export function ReorderSiblingsDialog({
  open,
  onOpenChange,
  managerLabel,
  siblings,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerLabel: string;
  siblings: OrgChartUser[];
  onSubmit: (orderedIds: string[]) => Promise<void>;
}) {
  // No open/reset effect: the admin page remounts this component (via a
  // `key` that changes on every open) whenever it's opened for a manager,
  // so this lazy initializer already runs fresh each time.
  const [order, setOrder] = useState<OrgChartUser[]>(() => siblings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSubmit(order.map((o) => o.id));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reorder Direct Reports</DialogTitle>
          <DialogDescription>{managerLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <ul className="divide-y divide-table-border border border-table-border rounded-lg overflow-hidden">
            {order.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white">
                <span className="text-sm text-gray-800">{s.displayName}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${s.displayName} up`}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${s.displayName} down`}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
