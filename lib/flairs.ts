export const FLAIRS = [
  { id: "ANNOUNCEMENT", label: "Announcement", emoji: "📢", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "BIRTHDAY",     label: "Birthday",     emoji: "🎂", color: "bg-rose-50 text-rose-600 border-rose-200" },
  { id: "CELEBRATION",  label: "Celebration",  emoji: "🎉", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { id: "ACHIEVEMENT",  label: "Achievement",  emoji: "🏆", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "RECOGNITION",  label: "Recognition",  emoji: "🙏", color: "bg-navy-100 text-navy-700 border-navy-200" },
  { id: "MILESTONE",    label: "Milestone",    emoji: "🎊", color: "bg-gray-200 text-gray-700 border-gray-300" },
  { id: "IDEA",         label: "Idea",         emoji: "💡", color: "bg-lime-100 text-lime-700 border-lime-200" },
  { id: "QUESTION",     label: "Question",     emoji: "❓", color: "bg-navy-50 text-navy-600 border-navy-200" },
  { id: "EVENT",        label: "Event",        emoji: "📅", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  { id: "TEAM",         label: "Team",         emoji: "🤝", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "MOMENTS",      label: "Moments",      emoji: "📸", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "MOTIVATION",   label: "Motivation",   emoji: "💪", color: "bg-red-100 text-red-700 border-red-200" },
  { id: "SPOTLIGHT",    label: "Spotlight",    emoji: "🌟", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { id: "HELP",         label: "Help Needed",  emoji: "🆘", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { id: "CASUAL",       label: "Casual",       emoji: "☕", color: "bg-gray-100 text-gray-600 border-gray-200" },
] as const;

export type FlairId = (typeof FLAIRS)[number]["id"];
export const FLAIR_IDS = FLAIRS.map((f) => f.id) as [FlairId, ...FlairId[]];
export const flairById = Object.fromEntries(FLAIRS.map((f) => [f.id, f])) as Record<string, (typeof FLAIRS)[number]>;
