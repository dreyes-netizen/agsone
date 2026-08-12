export function getDaysUntil(isoDate: string): number {
  const now = new Date();
  const d = new Date(isoDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < todayMidnight.getTime()) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAnniversaryYear(hireDate: string): number {
  const now = new Date();
  const hire = new Date(hireDate);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYearDate = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
  return thisYearDate.getTime() < todayMidnight.getTime()
    ? now.getFullYear() + 1 - hire.getFullYear()
    : now.getFullYear() - hire.getFullYear();
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getTenure(hireDate: string): string {
  const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return "< 1 yr at AGS";
  return `${years} yr${years > 1 ? "s" : ""} at AGS`;
}

export const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-amber-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-amber-500" },
  REFUND:       { label: "Refund",     color: "text-navy-600" },
  MILESTONE:    { label: "Milestone",  color: "text-amber-600" },
  DEDUCTION:    { label: "Violation Deduction", color: "text-red-600" },
};

export const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-navy-50 text-navy-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-emerald-50 text-emerald-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};
