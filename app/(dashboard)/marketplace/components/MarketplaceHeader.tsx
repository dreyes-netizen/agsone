import Link from "next/link";
import { Coins } from "lucide-react";

interface MarketplaceHeaderProps {
  balance: number;
}

export function MarketplaceHeader({ balance }: MarketplaceHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
        <p className="text-gray-500 text-sm mt-1">Spend your points on something nice</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-medium text-gray-500">Your balance</p>
        <p className="flex items-center justify-end gap-1.5 font-black text-xl sm:text-2xl tabular-nums text-navy-600 leading-tight mt-0.5">
          <Coins className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
          {balance.toLocaleString()}
          <span className="text-xs sm:text-sm font-semibold text-gray-500">pts</span>
        </p>
        <Link
          href="/profile?tab=points"
          className="text-xs font-medium text-navy-600 hover:text-navy-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-navy-500 rounded"
        >
          View points history
        </Link>
      </div>
    </div>
  );
}
