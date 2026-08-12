import { FileText } from "lucide-react";

interface BioSectionProps {
  bio: string | null;
  isEditing: boolean;
  bioEdit: string;
  onBioChange: (value: string) => void;
}

export function BioSection({ bio, isEditing, bioEdit, onBioChange }: BioSectionProps) {
  return (
    <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center">
          <FileText className="w-4 h-4 text-navy-500" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-gray-800">About / Bio</p>
      </div>
      {isEditing ? (
        <>
          <label htmlFor="bio-edit" className="sr-only">Bio / About yourself</label>
          <textarea
            id="bio-edit"
            value={bioEdit}
            onChange={(e) => onBioChange(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Tell your colleagues a bit about yourself…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:border-navy-400 transition resize-none"
          />
          <p className="text-xs text-gray-500">{bioEdit.length}/500</p>
        </>
      ) : (
        <p className="text-sm text-gray-600 leading-relaxed">
          {bio || <span className="text-gray-500 italic">No bio yet. Click Edit Profile to add one.</span>}
        </p>
      )}
    </div>
  );
}
