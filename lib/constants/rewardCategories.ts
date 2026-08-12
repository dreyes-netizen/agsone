import { Package, Ticket, Star, Monitor, type LucideIcon } from "lucide-react";

// Single source of truth for Reward category display — shared by the employee
// marketplace and the admin rewards manager so a category's icon, label, and
// color read identically everywhere. Colors are distinct shades of the
// sanctioned palette (navy, gray, emerald, amber, rose) plus the existing
// non-flagged accents already in use elsewhere in the app.
export const REWARD_CATEGORIES = ["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"] as const;

export type RewardCategory = (typeof REWARD_CATEGORIES)[number];

export const REWARD_CATEGORY_CONFIG: Record<
  RewardCategory,
  { icon: LucideIcon; iconClass: string; label: string; accent: string; badge: string }
> = {
  PHYSICAL:  { icon: Package,  iconClass: "text-amber-600", label: "Physical",  accent: "from-amber-400 to-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  VOUCHER:   { icon: Ticket,   iconClass: "text-navy-600",   label: "Voucher",   accent: "from-navy-400 to-navy-600",    badge: "bg-navy-50 text-navy-700 border-navy-200" },
  PRIVILEGE: { icon: Star,     iconClass: "text-navy-600",   label: "Privilege", accent: "from-navy-500 to-navy-700",    badge: "bg-navy-50 text-navy-700 border-navy-200" },
  DIGITAL:   { icon: Monitor,  iconClass: "text-emerald-600",label: "Digital",   accent: "from-emerald-500 to-emerald-700", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
