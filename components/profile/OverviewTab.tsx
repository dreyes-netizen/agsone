"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import { Coins, Star, Medal, CalendarDays, Trophy, FileText, Tag, X, MessageCircle, Megaphone, AlertCircle, Loader2 } from "lucide-react";
import { CompletenessBar } from "@/components/profile/CompletenessBar";
import { MinigamesStatsCard } from "@/components/profile/MinigamesStatsCard";
import type { UserProfile, ShoutoutEntry } from "@/lib/hooks/useProfileActions";

export function OverviewTab({
  profile,
  isEditing,
  bioEdit,
  setBioEdit,
  skillsEdit,
  setSkillsEdit,
  skillInput,
  setSkillInput,
  onSkillKeyDown,
  shoutouts,
  profileSaving,
  profileError,
  onSave,
  onCancel,
}: {
  profile: UserProfile;
  isEditing: boolean;
  bioEdit: string;
  setBioEdit: (value: string) => void;
  skillsEdit: string[];
  setSkillsEdit: (value: string[] | ((prev: string[]) => string[])) => void;
  skillInput: string;
  setSkillInput: (value: string) => void;
  onSkillKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  shoutouts: ShoutoutEntry[] | null;
  profileSaving: boolean;
  profileError: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <CompletenessBar profile={profile} />
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Coins, value: profile.pointsBalance.toLocaleString(), label: "Points Balance", color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
          { icon: Star,  value: profile.level,                          label: "Level",          color: "text-navy-600",   bg: "bg-navy-50",   hint: null },
          { icon: Medal, value: profile.userBadges.length,              label: "Badges",         color: "text-amber-600",  bg: "bg-amber-50",  hint: null },
        ].map(({ icon: Icon, value, label, color, bg, hint }) => (
          <div key={label} className="bg-white rounded-card border border-table-border p-3 sm:p-4 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
            </div>
            <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            {hint && <p className="text-xs text-gray-500 italic leading-tight">{hint}</p>}
          </div>
        ))}
      </div>

      {/* Minigames stats */}
      <MinigamesStatsCard />

      {/* Details: Birthday + Hire Date */}
      <div className="bg-white rounded-card border border-table-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-rose-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">Birthday</p>
            <p className="text-sm font-semibold text-gray-800">
              {profile.birthday
                ? new Date(profile.birthday).toLocaleDateString(undefined, { month: "long", day: "numeric" })
                : "Not set"}
            </p>
          </div>
          {profile.hireDate && (
            <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-blue-500" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Hire Date</p>
                <p className="text-sm font-semibold text-gray-800">
                  {new Date(profile.hireDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      <div className="bg-white rounded-card border border-table-border px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-gray-800">About / Bio</p>
        </div>
        {isEditing ? (
          <>
            <label htmlFor="bio-edit" className="sr-only">Bio / About yourself</label>
            <textarea
              id="bio-edit"
              value={bioEdit}
              onChange={(e) => setBioEdit(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell your colleagues a bit about yourself…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:border-navy-400 transition resize-none"
            />
            <p className="text-xs text-gray-500">{bioEdit.length}/500</p>
          </>
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed">
            {profile.bio || <span className="text-gray-500 italic">No bio yet. Click Edit Profile to add one.</span>}
          </p>
        )}
      </div>

      {/* Skills */}
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
                      onClick={() => setSkillsEdit(skillsEdit.filter((s) => s !== skill))}
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
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={onSkillKeyDown}
              placeholder="e.g. Leadership, Excel, Python…"
              aria-label="Add a skill (press Enter to add)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus-visible:border-navy-400 transition"
            />
            <p className="text-xs text-gray-500">{skillsEdit.length}/20 skills</p>
          </>
        ) : (
          profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
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

      {/* Shoutouts Received */}
      {shoutouts !== null && (
        <div className="bg-white rounded-card border border-table-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" aria-hidden="true" /> Shoutouts</p>
            <Link href="/feed" className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">See all →</Link>
          </div>
          {shoutouts.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-3 px-4 text-center">
              <Megaphone className="w-4 h-4 text-gray-300" aria-hidden="true" />
              <p className="text-xs font-medium text-gray-600">No shoutouts yet</p>
              <p className="text-[10px] text-gray-500">Your colleagues will recognize you here</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {shoutouts.map((s) => (
                <li key={s.id} className="flex gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                    {s.post.author.avatarUrl
                      ? <img src={s.post.author.avatarUrl} alt={s.post.author.displayName} className="w-full h-full object-cover" />
                      : s.post.author.displayName.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{s.post.author.displayName}</p>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{s.post.content}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(s.post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Save / Cancel — only in edit mode */}
      {isEditing && (
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
      )}
    </>
  );
}
