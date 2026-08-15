import type { Reward } from "../types";
import { getStockState } from "../lib/rewardAvailability";
import { RewardImage } from "./RewardImage";
import { RewardTypeBadge } from "./RewardTypeBadge";

interface RewardCardProps {
  reward: Reward;
  balance: number;
  onOpen: (reward: Reward) => void;
}

// Affordability and availability are surfaced as plain text next to the
// price — never as opacity/saturation on the card or its image. A reward a
// user can't currently afford is still fully browsable and fully visible.
export function RewardCard({ reward, balance, onOpen }: RewardCardProps) {
  const canAfford = balance >= reward.pointCost;
  const stock = getStockState(reward.stockQuantity);
  const deficit = reward.pointCost - balance;

  const secondaryLine = stock.outOfStock
    ? { text: "Out of stock", className: "text-gray-500" }
    : stock.lowStock
    ? { text: `Only ${reward.stockQuantity} left`, className: "text-amber-600 font-medium" }
    : !canAfford
    ? { text: `Need ${deficit.toLocaleString()} more pts`, className: "text-gray-500" }
    : { text: "You can redeem this", className: "text-emerald-600 font-medium" };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(reward)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(reward);
        }
      }}
      aria-label={`View ${reward.name}, ${reward.pointCost.toLocaleString()} points`}
      className={`group bg-white rounded-card border overflow-hidden cursor-pointer transition-shadow sm:hover:shadow-md sm:hover:-translate-y-0.5 sm:motion-safe:transition-transform sm:[transition-timing-function:cubic-bezier(0.25,1,0.5,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black
        flex flex-row items-center
        sm:flex-col sm:items-stretch
        ${stock.outOfStock ? "border-gray-200" : "border-table-border"}`}
    >
      <div className="relative shrink-0 w-[88px] h-[88px] sm:w-full sm:h-auto">
        <RewardImage
          src={reward.imageUrls?.[0]}
          alt={reward.name}
          category={reward.category}
          sizes="(min-width: 1280px) 19vw, (min-width: 1024px) 24vw, (min-width: 768px) 32vw, (min-width: 640px) 48vw, 88px"
          className="w-full h-full sm:aspect-[4/3]"
        />
        {stock.outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="text-[10px] sm:text-xs font-bold text-gray-600 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
              Out of stock
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-3.5 gap-1 sm:gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <RewardTypeBadge category={reward.category} className="hidden sm:inline-flex" />
        </div>

        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 text-sm">{reward.name}</h3>
          <RewardTypeBadge category={reward.category} className="sm:hidden shrink-0 !text-[10px] !px-2" />
        </div>

        {reward.description && (
          <p className="text-gray-500 leading-snug line-clamp-1 text-xs">{reward.description}</p>
        )}

        <div className="flex items-end justify-between gap-2 border-t border-gray-100 mt-auto pt-1.5 sm:pt-2">
          <div className="min-w-0">
            <p className={`font-bold tabular-nums leading-none text-sm sm:text-base ${canAfford && !stock.outOfStock ? "text-navy-600" : "text-gray-500"}`}>
              {reward.pointCost.toLocaleString()}
              <span className="font-medium ml-1 text-xs">pts</span>
            </p>
            <p className={`text-[11px] mt-1 truncate ${secondaryLine.className}`}>{secondaryLine.text}</p>
          </div>
          <span className="hidden sm:inline text-xs font-semibold text-navy-600 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 motion-safe:transition-opacity">
            View reward
          </span>
        </div>
      </div>
    </div>
  );
}
