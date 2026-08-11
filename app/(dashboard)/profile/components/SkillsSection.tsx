import { Tag, X } from "lucide-react";

interface SkillsSectionProps {
  skills: string[];
  isEditing: boolean;
  skillsEdit: string[];
  skillInput: string;
  onSkillInputChange: (value: string) => void;
  onSkillKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemoveSkill: (skill: string) => void;
}

export function SkillsSection(props: SkillsSectionProps) {
  const { skills, isEditing, skillsEdit, skillInput, onSkillInputChange, onSkillKeyDown, onRemoveSkill } = props;

  return (
    <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Tag className="w-4 h-4 text-emerald-500" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-gray-800">Skills</p>
      </div>
      {isEditing ? (
        <>
          {skillsEdit.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skillsEdit.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                  {skill}
                  <button
                    aria-label={`Remove ${skill}`}
                    onClick={() => onRemoveSkill(skill)}
                    className="hover:text-blue-900 transition-colors ml-1 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  ><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={skillInput}
            id="skill-input"
            onChange={(e) => onSkillInputChange(e.target.value)}
            onKeyDown={onSkillKeyDown}
            placeholder="e.g. Leadership, Excel, Python…"
            aria-label="Add a skill (press Enter to add)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:border-navy-400 transition"
          />
          <p className="text-xs text-gray-500">{skillsEdit.length}/20 skills</p>
        </>
      ) : (
        skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span key={skill} className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-3 px-4 text-center bg-gray-50 rounded-lg">
            <Tag className="w-4 h-4 text-gray-300" aria-hidden="true" />
            <p className="text-xs font-medium text-gray-600">No skills added yet</p>
            <p className="text-[10px] text-gray-500">Click <span className="font-medium text-gray-500">Edit Profile</span> to add some</p>
          </div>
        )
      )}
    </div>
  );
}
