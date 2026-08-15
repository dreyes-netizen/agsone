import { REWARD_CATEGORY_CONFIG, type RewardCategory } from "@/lib/constants/rewardCategories";

export function RewardTypeBadge({ category, className = "" }: { category: RewardCategory; className?: string }) {
  const cfg = REWARD_CATEGORY_CONFIG[category] ?? REWARD_CATEGORY_CONFIG.PHYSICAL;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge} ${className}`}>
      <cfg.icon className="w-3 h-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
