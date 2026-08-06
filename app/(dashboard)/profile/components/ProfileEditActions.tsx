import { AlertCircle, Loader2, X } from "lucide-react";

interface ProfileEditActionsProps {
  profileError: string;
  profileSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileEditActions({ profileError, profileSaving, onSave, onCancel }: ProfileEditActionsProps) {
  return (
    <>
      {profileError && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {profileError}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={profileSaving}
           className="flex-1 bg-command-black hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5"
        >
          {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
          {profileSaving ? "Saving…" : "Save Profile"}
        </button>
        <button
          onClick={onCancel}
          disabled={profileSaving}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-xl transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" /> Cancel
        </button>
      </div>
    </>
  );
}
