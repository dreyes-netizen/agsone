"use client";

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

export function ForfeitModal({
  open,
  opponentName,
  confirming,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  opponentName: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Forfeit Game?</AlertDialogTitle>
          <AlertDialogDescription>
            {opponentName} will be declared the winner.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            autoFocus
            variant="destructive"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Forfeiting…" : "Yes, forfeit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
