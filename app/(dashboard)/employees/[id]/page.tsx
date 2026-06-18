"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ArrowLeft, Coins, Star, CalendarDays, Building2,
  Award, Trophy, Sparkles, History, FileText, Tag, Briefcase, Lock, AlertCircle, Loader2, X,
} from "lucide-react";
import { AWARD_ACTIVITIES, AWARD_CATEGORIES, findActivity, type AwardCategory } from "@/lib/constants/awardActivities";

type ShoutoutPost = {
  id: string;
  content: string;
  createdAt: string;
  imageUrls: string[];
  author: { id: string; displayName: string; avatarUrl: string | null; department: { name: string } | null };
};

type Shoutout = {
  id: string;
  post: ShoutoutPost;
};

type Employee = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  pointsBalance: number;
  level: number;
  birthday: string | null;
  hireDate: string | null;
  bio: string | null;
  skills: string[];
  isActive: boolean;
  rank: number;
  department: { id: string; name: string } | null;
  userBadges: {
    id: string;
    awardedAt: string;
    badge: { name: string; description: string | null; iconUrl: string | null };
  }[];
  shoutoutsReceived: Shoutout[];
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
  fromUser: { displayName: string; avatarUrl: string | null } | null;
};

const roleLabel = { EMPLOYEE: "Employee", MANAGER: "Manager", HR_ADMIN: "HR Admin", SUPER_ADMIN: "Super Admin" };
const roleBadgeClass = {
  EMPLOYEE:    "bg-gray-100 text-gray-600",
  MANAGER:     "bg-blue-100 text-blue-700",
  HR_ADMIN:    "bg-violet-100 text-violet-700",
  SUPER_ADMIN: "bg-red-100 text-red-700",
};

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  MANUAL_AWARD: { label: "Points Awarded",   color: "text-emerald-600", bg: "bg-emerald-50" },
  REDEMPTION:   { label: "Redeemed",         color: "text-rose-500",    bg: "bg-rose-50" },
  REFUND:       { label: "Refund",           color: "text-emerald-600", bg: "bg-emerald-50" },
  GAME_WIN:     { label: "Game Win",         color: "text-violet-600",  bg: "bg-violet-50" },
  GAME_SPEND:   { label: "Game Entry",       color: "text-orange-500",  bg: "bg-orange-50" },
  CONTEST:      { label: "Contest",          color: "text-navy-600",    bg: "bg-navy-50" },
  KPI:          { label: "KPI Bonus",        color: "text-emerald-600", bg: "bg-emerald-50" },
  MILESTONE:    { label: "Milestone Reward", color: "text-violet-600",  bg: "bg-violet-50" },
};

function getTenure(hireDate: string | null): string | null {
  if (!hireDate) return null;
  const start = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0 && months === 0) return "Just started";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mo`);
  return parts.join(" ") + " at AGS";
}

function formatDate(val: string | null) {
  if (!val) return null;
  return new Date(val).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fullSizeAvatar(url: string | null) {
  if (!url) return url;
  return url.replace(/=s\d+-c$/, "=s0-c");
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400";

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [awardAmount, setAwardAmount] = useState("");
  const [awardActivity, setAwardActivity] = useState("");
  const [budget, setBudget] = useState<{ isExempt: boolean; used: number; remaining: number; total: number } | null>(null);
  const [awardNote, setAwardNote] = useState("");
  const [awardSubmitting, setAwardSubmitting] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState("");
  const [awardError, setAwardError] = useState("");

  const [shoutoutText, setShoutoutText] = useState("");
  const [shoutoutSubmitting, setShoutoutSubmitting] = useState(false);
  const [shoutoutSuccess, setShoutoutSuccess] = useState(false);
  const [shoutoutError, setShoutoutError] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [avatarZoomed, setAvatarZoomed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const closeLightboxRef = useRef<HTMLButtonElement>(null);

  const isAdminOrManager = dbUser?.role === "HR_ADMIN" || dbUser?.role === "MANAGER" || dbUser?.role === "SUPER_ADMIN";
  const canAwardPoints = dbUser?.role === "SUPER_ADMIN" || (isAdminOrManager && employee?.role === "EMPLOYEE");
  const isSelf = dbUser?.id === id;

  function closeLightbox() {
    setAvatarZoomed(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // Escape key closes the lightbox
  useEffect(() => {
    if (!avatarZoomed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    // Move focus to close button when lightbox opens
    setTimeout(() => closeLightboxRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarZoomed]);

  function loadEmployee() {
    return apiFetch<{ data: Employee }>(`/api/employees/${id}`)
      .then((r) => setEmployee(r.data))
      .catch(() => setNotFound(true));
  }

  function loadBudget() {
    return apiFetch<{ data: { isExempt: boolean; used: number; remaining: number; total: number } }>("/api/points/budget")
      .then((r) => setBudget(r.data))
      .catch(() => {});
  }

  useEffect(() => {
    loadEmployee().finally(() => setLoading(false));
    if (isAdminOrManager && !isSelf) loadBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isAdminOrManager) return;
    setHistoryLoading(true);
    apiFetch<{ data: Transaction[] }>(`/api/points/history?userId=${id}`)
      .then((r) => setTransactions(r.data.slice(0, 15)))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdminOrManager]);

  async function handleAwardPoints(e: React.FormEvent) {
    e.preventDefault();
    setAwardSubmitting(true);
    setAwardSuccess("");
    setAwardError("");
    try {
      await apiFetch("/api/points/award", {
        method: "POST",
        body: JSON.stringify({ toUserId: id, amount: Number(awardAmount), note: awardNote, activity: awardActivity || undefined }),
      });
      setAwardSuccess(`${Number(awardAmount).toLocaleString()} points awarded!`);
      setAwardAmount("");
      setAwardNote("");
      setAwardActivity("");
      loadEmployee();
      loadBudget();
      apiFetch<{ data: Transaction[] }>(`/api/points/history?userId=${id}`)
        .then((r) => setTransactions(r.data.slice(0, 15)))
        .catch(() => {});
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : "Failed to award points");
    } finally {
      setAwardSubmitting(false);
    }
  }

  async function handleShoutout(e: React.FormEvent) {
    e.preventDefault();
    setShoutoutSubmitting(true);
    setShoutoutError("");
    try {
      await apiFetch("/api/feed", {
        method: "POST",
        body: JSON.stringify({ type: "SHOUTOUT", content: shoutoutText, recipientIds: [id] }),
      });
      setShoutoutSuccess(true);
      setShoutoutText("");
    } catch (err) {
      setShoutoutError(err instanceof Error ? err.message : "Failed to send shoutout");
    } finally {
      setShoutoutSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-label="Loading profile" className="max-w-2xl space-y-4">
        <div className="h-6 bg-gray-100 rounded w-24 motion-safe:animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl motion-safe:animate-pulse" />
        <div className="h-28 bg-gray-100 rounded-2xl motion-safe:animate-pulse" />
      </div>
    );
  }

  if (notFound || !employee) {
    return (
      <div className="max-w-2xl">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded px-1 py-1 mb-6">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
        </button>
        <p className="text-gray-500">Employee not found.</p>
      </div>
    );
  }

  const initials = employee.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded px-1 py-1 transition-colors">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5">
          {/* Avatar — button only when photo exists */}
          {employee.avatarUrl ? (
            <button
              type="button"
              onClick={() => setAvatarZoomed(true)}
              aria-label={`View full-size photo of ${employee.displayName}`}
              className="w-20 h-20 rounded-full overflow-hidden shrink-0 cursor-zoom-in hover:ring-2 hover:ring-navy-400 hover:ring-offset-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
            >
              <img src={employee.avatarUrl} alt={employee.displayName} className="w-full h-full object-cover" />
            </button>
          ) : (
            <div
              className="w-20 h-20 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-2xl font-bold shrink-0"
              aria-label={`${employee.displayName} — no photo`}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{employee.displayName}</h1>
              {!employee.isActive && (
                <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            {isAdminOrManager && (
              <p className="text-sm text-gray-500 mt-0.5">{employee.email}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeClass[employee.role]}`}>
                {roleLabel[employee.role]}
              </span>
              {employee.department && (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                  <Building2 className="w-3 h-3" aria-hidden="true" />
                  {employee.department.name}
                </span>
              )}
              {getTenure(employee.hireDate) && (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                  <Briefcase className="w-3 h-3" aria-hidden="true" />
                  {getTenure(employee.hireDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Coins className="w-4 h-4 text-navy-400 mx-auto mb-1" aria-hidden="true" />
          <dd className="text-2xl font-black text-gray-900 tabular-nums">{employee.pointsBalance.toLocaleString()}</dd>
          <dt className="text-xs text-gray-500 mt-0.5">Points</dt>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Star className="w-4 h-4 text-violet-400 mx-auto mb-1" aria-hidden="true" />
          <dd className="text-2xl font-black text-violet-600">{employee.level}</dd>
          <dt className="text-xs text-gray-500 mt-0.5">Level</dt>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" aria-hidden="true" />
          <dd className="text-2xl font-black text-yellow-600">#{employee.rank}</dd>
          <dt className="text-xs text-gray-500 mt-0.5">All-Time Rank</dt>
        </div>
      </dl>

      {/* Bio */}
      {employee.bio && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">About</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{employee.bio}</p>
        </div>
      )}

      {/* Skills */}
      {employee.skills.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">Skills</p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Skills">
            {employee.skills.map((skill) => (
              <li key={skill} className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                {skill}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shoutouts received */}
      {employee.shoutoutsReceived.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">
              Shoutouts Received
              <span className="ml-1.5 text-xs font-normal text-gray-500">({employee.shoutoutsReceived.length})</span>
            </p>
          </div>
          <ul className="space-y-3">
            {employee.shoutoutsReceived.map((s) => (
              <li key={s.id} className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 space-y-2">
                <div className="flex items-center gap-2">
                  <a href={`/employees/${s.post.author.id}`} className="shrink-0" aria-label={`View ${s.post.author.displayName}'s profile`}>
                    {s.post.author.avatarUrl
                      ? <img src={s.post.author.avatarUrl} alt={s.post.author.displayName} className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">{s.post.author.displayName.charAt(0).toUpperCase()}</div>
                    }
                  </a>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a href={`/employees/${s.post.author.id}`} className="text-xs font-semibold text-gray-900 hover:underline whitespace-nowrap truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded">
                        {s.post.author.displayName}
                      </a>
                      <span className="text-xs text-gray-500 ml-auto shrink-0 whitespace-nowrap">
                        {new Date(s.post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    {s.post.author.department && (
                      <span className="text-xs text-zinc-500 font-medium block">{s.post.author.department.name}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed italic whitespace-pre-wrap">&ldquo;{s.post.content}&rdquo;</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Award Points */}
      {canAwardPoints && !isSelf && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-4 h-4 text-navy-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">Award Points</p>
          </div>
          {budget && !budget.isExempt && (
            <div className="mb-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Monthly budget</span>
                <span className={`font-semibold ${budget.remaining === 0 ? "text-red-600" : "text-gray-700"}`}>{budget.remaining} pts left</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  role="progressbar"
                  aria-label="Monthly budget used"
                  aria-valuenow={Math.min(100, Math.round((budget.used / budget.total) * 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className={`h-full rounded-full transition-all ${budget.remaining === 0 ? "bg-red-500" : budget.remaining < 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (budget.used / budget.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <form onSubmit={handleAwardPoints} className="space-y-3">
            <div>
              <label htmlFor="award-activity" className="sr-only">Award activity or preset</label>
              <select
                id="award-activity"
                value={awardActivity}
                onChange={(e) => {
                  const key = e.target.value;
                  setAwardActivity(key);
                  const preset = findActivity(key);
                  if (preset) setAwardAmount(String(preset.points));
                }}
                className={inputClass}
              >
                <option value="">Custom amount…</option>
                {(Object.keys(AWARD_CATEGORIES) as AwardCategory[]).map((cat) => (
                  <optgroup key={cat} label={AWARD_CATEGORIES[cat]}>
                    {AWARD_ACTIVITIES.filter((a) => a.category === cat).map((a) => (
                      <option key={a.key} value={a.key}>{a.label} ({a.points} pts)</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={10000}
                placeholder="Points (e.g. 100)"
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
                aria-label={awardActivity ? "Points amount (set by activity)" : "Points amount"}
                aria-required="true"
                required
                readOnly={!!awardActivity}
                className={inputClass + (awardActivity ? " bg-gray-50 cursor-not-allowed pr-8" : "")}
              />
              {awardActivity && (
                <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" aria-hidden="true" />
              )}
            </div>
            <div>
              <label htmlFor="award-note" className="sr-only">Reason for awarding points</label>
              <textarea
                id="award-note"
                placeholder={`Reason for awarding ${employee.displayName.split(" ")[0]}…`}
                value={awardNote}
                onChange={(e) => setAwardNote(e.target.value)}
                aria-required="true"
                required
                rows={2}
                className={inputClass + " resize-none"}
              />
            </div>
            {awardSuccess && (
              <p role="status" aria-live="polite" className="text-xs text-emerald-600 font-medium">{awardSuccess}</p>
            )}
            {awardError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {awardError}
              </div>
            )}
            <button
              type="submit"
              disabled={awardSubmitting || !awardAmount || (budget !== null && !budget.isExempt && budget.remaining === 0)}
              aria-busy={awardSubmitting}
              className="flex items-center gap-2 bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              {awardSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {awardSubmitting ? "Awarding…" : "Award Points"}
            </button>
          </form>
        </div>
      )}

      {/* Send a Shoutout */}
      {!isSelf && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">Send a Shoutout</p>
          </div>
          {shoutoutSuccess ? (
            <div className="text-center py-3" role="status" aria-live="polite">
              <p className="text-emerald-600 font-medium text-sm">
                Shoutout posted to the feed! <span aria-hidden="true">🎉</span>
              </p>
              <button
                onClick={() => setShoutoutSuccess(false)}
                className="text-xs text-gray-500 hover:text-gray-700 mt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 rounded"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleShoutout} className="space-y-3">
              <div>
                <label htmlFor="shoutout-text" className="sr-only">
                  Write a shoutout for {employee.displayName}
                </label>
                <textarea
                  id="shoutout-text"
                  placeholder={`Say something great about ${employee.displayName.split(" ")[0]}…`}
                  value={shoutoutText}
                  onChange={(e) => setShoutoutText(e.target.value)}
                  aria-required="true"
                  required
                  rows={2}
                  maxLength={500}
                  className={inputClass + " resize-none focus:ring-amber-400/30 focus:border-amber-400"}
                />
              </div>
              {shoutoutError && (
                <p role="alert" className="text-xs text-red-500">{shoutoutError}</p>
              )}
              <button
                type="submit"
                disabled={shoutoutSubmitting || !shoutoutText.trim()}
                aria-busy={shoutoutSubmitting}
                className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-600"
              >
                {shoutoutSubmitting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Sending…</>
                  : <><span aria-hidden="true">✨</span> Send Shoutout</>
                }
              </button>
            </form>
          )}
        </div>
      )}

      {/* Details — managers and HR admins only */}
      {isAdminOrManager && (employee.hireDate || employee.birthday) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Details</p>
          {employee.hireDate && (
            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
              <span className="text-gray-500">Hire date</span>
              <span className="ml-auto font-medium text-gray-900">{formatDate(employee.hireDate)}</span>
            </div>
          )}
          {employee.birthday && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-base leading-none shrink-0" aria-hidden="true">🎂</span>
              <span className="text-gray-500">Birthday</span>
              <span className="ml-auto font-medium text-gray-900">
                {new Date(employee.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Badges */}
      {employee.userBadges.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">Badges ({employee.userBadges.length})</p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Earned badges">
            {employee.userBadges.map((ub) => (
              <li
                key={ub.id}
                aria-label={ub.badge.description ? `${ub.badge.name}: ${ub.badge.description}` : ub.badge.name}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full"
              >
                <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {ub.badge.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Points History — managers and HR admins only */}
      {isAdminOrManager && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <History className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-700">Points History</p>
          </div>
          {historyLoading ? (
            <div role="status" aria-label="Loading points history" className="p-5 space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg motion-safe:animate-pulse" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No transactions yet</p>
          ) : (
            <ul aria-label="Points transaction history">
              {transactions.map((t, i) => {
                const cfg = typeConfig[t.type] ?? { label: t.type, color: "text-gray-600", bg: "bg-gray-50" };
                const positive = t.amount > 0;
                return (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between px-5 py-3 ${i < transactions.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`} aria-hidden="true">
                        <span className={`text-xs font-black ${cfg.color}`}>{positive ? "+" : "−"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{cfg.label}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {t.fromUser ? `From ${t.fromUser.displayName}` : (t.note ?? "")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                        {positive ? "+" : ""}{t.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Avatar zoom lightbox */}
      {avatarZoomed && employee.avatarUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo of ${employee.displayName}`}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center select-none"
          onClick={closeLightbox}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.002)));
          }}
        >
          {/* Close button */}
          <button
            ref={closeLightboxRef}
            onClick={closeLightbox}
            aria-label="Close photo"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          <img
            src={fullSizeAvatar(employee.avatarUrl) ?? undefined}
            alt={employee.displayName}
            draggable={false}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: dragStart.current ? "none" : "transform 0.1s ease",
              cursor: zoom > 1 ? (dragStart.current ? "grabbing" : "grab") : "zoom-in",
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: "1rem",
              objectFit: "contain",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (zoom === 1) setZoom(2.5);
              else { setZoom(1); setPan({ x: 0, y: 0 }); }
            }}
            onDoubleClick={(e) => { e.stopPropagation(); setZoom(1); setPan({ x: 0, y: 0 }); }}
            onMouseDown={(e) => {
              if (zoom <= 1) return;
              e.stopPropagation();
              dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragStart.current) return;
              e.stopPropagation();
              setPan({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my });
            }}
            onMouseUp={() => { dragStart.current = null; }}
            onMouseLeave={() => { dragStart.current = null; }}
          />
          <p className="absolute bottom-4 text-white/50 text-xs pointer-events-none" aria-hidden="true">
            {zoom > 1 ? "Double-click or click to reset · Drag to pan" : "Click to zoom · Scroll to zoom · Esc to close"}
          </p>
        </div>
      )}
    </div>
  );
}
