"use client";

import { PointsTimeline } from "@/components/profile/PointsTimeline";
import type { PointsData } from "@/lib/hooks/useProfileActions";

export function PointsTab({
  pointsData,
  visibleCount,
  setVisibleCount,
}: {
  pointsData: PointsData;
  visibleCount: number;
  setVisibleCount: (value: number | ((prev: number) => number)) => void;
}) {
  return (
    <>
      {/* Balance card */}
      <div className="bg-white rounded-card border border-table-border p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Balance</p>
            <p className="text-4xl font-black text-navy-600 leading-none mt-1">
              {pointsData.balance.toLocaleString()}
              <span className="text-lg font-semibold text-gray-500 ml-1">pts</span>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-navy-100 text-navy-700 text-xs font-bold px-3 py-1 rounded-full">
              Level {pointsData.level}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Total earned:{" "}
              <span className="font-semibold text-gray-700">
                {pointsData.totalEarned.toLocaleString()} pts
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Unified timeline */}
      <PointsTimeline
        transactions={pointsData.transactions}
        redemptions={pointsData.redemptions}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
      />
    </>
  );
}
