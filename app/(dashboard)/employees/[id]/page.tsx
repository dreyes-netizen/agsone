"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ArrowLeft, Coins, Star, Flame, CalendarDays, Building2,
  Award, Trophy, Sparkles, History, FileText, Tag, Briefcase,
} from "lucide-react";

type Shoutout = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
};

type Employee = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  pointsBalance: number;
  level: number;
  streakDays: number;
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

const roleLabel = { EMPLOYEE: "Employee", MANAGER: "Manager", HR_ADMIN: "HR Admin" };
const roleBadgeClass = {
  EMPLOYEE: "bg-gray-100 text-gray-600",
  MANAGER:  "bg-blue-100 text-blue-700",
  HR_ADMIN: "bg-violet-100 text-violet-700",
};

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  MANUAL_AWARD: { label: "Points Awarded",   color: "text-emerald-600", bg: "bg-emerald-50" },
  ATTENDANCE:   { label: "Streak Bonus",     color: "text-sky-600",     bg: "bg-sky-50" },
  REDEMPTION:   { label: "Redeemed",         color: "text-rose-500",    bg: "bg-rose-50" },
  REFUND:       { label: "Refund",           color: "text-emerald-600", bg: "bg-emerald-50" },
  GAME_WIN:     { label: "Game Win",         color: "text-violet-600",  bg: "bg-violet-50" },
  GAME_SPEND:   { label: "Game Entry",       color: "text-orange-500",  bg: "bg-orange-50" },
  CONTEST:      { label: "Contest",          color: "text-navy-600",    bg: "bg-navy-50" },
  KPI:          { label: "KPI Bonus",        color: "text-emerald-600", bg: "bg-emerald-50" },
  TASK:         { label: "Task Completion",  color: "text-emerald-600", bg: "bg-emerald-50" },
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
  // Google profile photos: strip the =sNNN-c size suffix to get the original
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

  const isAdminOrManager = dbUser?.role === "HR_ADMIN" || dbUser?.role === "MANAGER";
  const isSelf = dbUser?.id === id;

  function loadEmployee() {
    return apiFetch<{ data: Employee }>(`/api/employees/${id}`)
      .then((r) => setEmployee(r.data))
      .catch(() => setNotFound(true));
  }

  useEffect(() => {
    loadEmployee().finally(() => setLoading(false));
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
        body: JSON.stringify({ toUserId: id, amount: Number(awardAmount), note: awardNote }),
      });
      setAwardSuccess(`${Number(awardAmount).toLocaleString()} points awarded!`);
      setAwardAmount("");
      setAwardNote("");
      loadEmployee();
      // Refresh history
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
        body: JSON.stringify({ type: "SHOUTOUT", content: shoutoutText, recipientId: id }),
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
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-24" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="h-28 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (notFound || !employee) {
    return (
      <div className="max-w-2xl">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-gray-500">Employee not found.</p>
      </div>
    );
  }

  const initials = employee.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <button
            type="button"
            onClick={() => employee.avatarUrl && setAvatarZoomed(true)}
            className={`w-20 h-20 rounded-full bg-gradient-to-br from-navy-400 to-violet-500 flex items-center justify-center text-white text-2xl font-bold shrink-0 overflow-hidden ${employee.avatarUrl ? "cursor-zoom-in hover:ring-2 hover:ring-navy-400 hover:ring-offset-2 transition-all" : "cursor-default"}`}
          >
            {employee.avatarUrl
              ? <img src={employee.avatarUrl} alt={employee.displayName} className="w-full h-full object-cover" />
              : initials}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{employee.displayName}</h1>
              {!employee.isActive && (
                <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            {isAdminOrManager && (
              <p className="text-sm text-gray-400 mt-0.5">{employee.email}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeClass[employee.role]}`}>
                {roleLabel[employee.role]}
              </span>
              {employee.department && (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                  <Building2 className="w-3 h-3" />
                  {employee.department.name}
                </span>
              )}
              {getTenure(employee.hireDate) && (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                  <Briefcase className="w-3 h-3" />
                  {getTenure(employee.hireDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats — 2×2 on mobile, 4-col on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Coins className="w-4 h-4 text-navy-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-900 tabular-nums">{employee.pointsBalance.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Points</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Star className="w-4 h-4 text-violet-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-violet-600">{employee.level}</p>
          <p className="text-xs text-gray-400 mt-0.5">Level</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-orange-500">{employee.streakDays}</p>
          <p className="text-xs text-gray-400 mt-0.5">Day Streak</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-yellow-600">#{employee.rank}</p>
          <p className="text-xs text-gray-400 mt-0.5">All-Time Rank</p>
        </div>
      </div>

      {/* Bio */}
      {employee.bio && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">About</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{employee.bio}</p>
        </div>
      )}

      {/* Skills */}
      {employee.skills.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Skills</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {employee.skills.map((skill) => (
              <span key={skill} className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Shoutouts received */}
      {employee.shoutoutsReceived.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-semibold text-gray-700">
              Shoutouts Received
              <span className="ml-1.5 text-xs font-normal text-gray-400">({employee.shoutoutsReceived.length})</span>
            </p>
          </div>
          <div className="space-y-3">
            {employee.shoutoutsReceived.map((s) => {
              const initials = s.author.displayName.charAt(0).toUpperCase();
              return (
                <div key={s.id} className="flex gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                    {s.author.avatarUrl
                      ? <img src={s.author.avatarUrl} alt={s.author.displayName} className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-900">{s.author.displayName}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{s.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Award Points — managers and HR admins only, not on own profile */}
      {isAdminOrManager && !isSelf && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-4 h-4 text-navy-400" />
            <p className="text-sm font-semibold text-gray-700">Award Points</p>
          </div>
          <form onSubmit={handleAwardPoints} className="space-y-3">
            <input
              type="number"
              min={1}
              max={10000}
              placeholder="Points (e.g. 100)"
              value={awardAmount}
              onChange={(e) => setAwardAmount(e.target.value)}
              required
              className={inputClass}
            />
            <textarea
              placeholder={`Reason for awarding ${employee.displayName.split(" ")[0]}…`}
              value={awardNote}
              onChange={(e) => setAwardNote(e.target.value)}
              required
              rows={2}
              className={inputClass + " resize-none"}
            />
            {awardSuccess && <p className="text-xs text-emerald-600 font-medium">{awardSuccess}</p>}
            {awardError && <p className="text-xs text-red-500">{awardError}</p>}
            <button
              type="submit"
              disabled={awardSubmitting || !awardAmount}
              className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {awardSubmitting ? "Awarding…" : "Award Points"}
            </button>
          </form>
        </div>
      )}

      {/* Send a Shoutout — everyone, not on own profile */}
      {!isSelf && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-semibold text-gray-700">Send a Shoutout</p>
          </div>
          {shoutoutSuccess ? (
            <div className="text-center py-3">
              <p className="text-emerald-600 font-medium text-sm">Shoutout posted to the feed! 🎉</p>
              <button
                onClick={() => setShoutoutSuccess(false)}
                className="text-xs text-gray-400 hover:text-gray-600 mt-1 transition-colors"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleShoutout} className="space-y-3">
              <textarea
                placeholder={`Say something great about ${employee.displayName.split(" ")[0]}…`}
                value={shoutoutText}
                onChange={(e) => setShoutoutText(e.target.value)}
                required
                rows={2}
                maxLength={500}
                className={inputClass + " resize-none focus:ring-amber-400/30 focus:border-amber-400"}
              />
              {shoutoutError && <p className="text-xs text-red-500">{shoutoutError}</p>}
              <button
                type="submit"
                disabled={shoutoutSubmitting || !shoutoutText.trim()}
                className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {shoutoutSubmitting ? "Sending…" : "✨ Send Shoutout"}
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
              <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-500">Hire date</span>
              <span className="ml-auto font-medium text-gray-900">{formatDate(employee.hireDate)}</span>
            </div>
          )}
          {employee.birthday && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-base leading-none shrink-0">🎂</span>
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
            <Award className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Badges ({employee.userBadges.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {employee.userBadges.map((ub) => (
              <div
                key={ub.id}
                title={ub.badge.description ?? ""}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full"
              >
                <span>🏅</span>
                {ub.badge.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points History — managers and HR admins only */}
      {isAdminOrManager && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <History className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Points History</p>
          </div>
          {historyLoading ? (
            <div className="p-5 space-y-2 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>
          ) : (
            <ul>
              {transactions.map((t, i) => {
                const cfg = typeConfig[t.type] ?? { label: t.type, color: "text-gray-600", bg: "bg-gray-50" };
                const positive = t.amount > 0;
                return (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between px-5 py-3 ${i < transactions.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <span className={`text-xs font-black ${cfg.color}`}>{positive ? "+" : "−"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{cfg.label}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {t.fromUser ? `From ${t.fromUser.displayName}` : (t.note ?? "")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                        {positive ? "+" : ""}{t.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
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
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center select-none"
          onClick={() => { setAvatarZoomed(false); setZoom(1); setPan({ x: 0, y: 0 }); }}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.002)));
          }}
        >
          <img
            src={fullSizeAvatar(employee.avatarUrl)}
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
          <p className="absolute bottom-4 text-white/50 text-xs pointer-events-none">
            {zoom > 1 ? "Double-click or click to reset · Drag to pan" : "Click to zoom · Scroll to zoom"}
          </p>
        </div>
      )}
    </div>
  );
}
