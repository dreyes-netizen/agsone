import type { SyncResult } from "../types";

interface SyncBannersProps {
  syncResult: SyncResult | null;
  syncError: string;
  onDismissResult: () => void;
  onDismissError: () => void;
}

export function SyncBanners({ syncResult, syncError, onDismissResult, onDismissError }: SyncBannersProps) {
  return (
    <>
      {syncResult && (
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
            <span>
              Sync complete — <strong>{syncResult.activeInFile}</strong> active, <strong>{syncResult.resignedInFile}</strong> resigned in file.{" "}
              {syncResult.imported > 0 && <><strong>{syncResult.imported}</strong> new account{syncResult.imported !== 1 ? "s" : ""} created, </>}
              <strong>{syncResult.deactivated}</strong> deactivated
              {syncResult.reactivated > 0 && <>, <strong>{syncResult.reactivated}</strong> reactivated</>}
              {syncResult.birthdaysUpdated > 0 && <>, <strong>{syncResult.birthdaysUpdated}</strong> birthday{syncResult.birthdaysUpdated !== 1 ? "s" : ""} updated</>}.
            </span>
            <button onClick={onDismissResult} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Dismiss</button>
          </div>
          {syncResult.failedImports > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">{syncResult.failedImports} employee{syncResult.failedImports !== 1 ? "s" : ""} could not be imported (already exist with a different email format):</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs font-mono">
                {syncResult.failedEmails.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{syncError}</span>
          <button onClick={onDismissError} className="text-red-500 hover:text-red-700 text-xs font-medium">Dismiss</button>
        </div>
      )}
    </>
  );
}
