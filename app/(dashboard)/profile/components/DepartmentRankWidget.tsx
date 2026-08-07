import Link from "next/link";
import type { UserProfile } from "../types";

interface DepartmentRankWidgetProps {
  department: UserProfile["department"];
  deptRank: { rank: number; total: number } | null;
}

export function DepartmentRankWidget({ department, deptRank }: DepartmentRankWidgetProps) {
  return (
    <Link href="/leaderboard">
      <div className="bg-white rounded-card border border-table-border px-5 py-4 hover:border-gray-300 transition-colors">
        <p className="text-xs text-gray-500 font-medium mb-2">Department Rank</p>
        {department && deptRank ? (
          <>
            <p className="text-2xl font-black text-navy-600">#{deptRank.rank}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              in {department.name} · of {deptRank.total}
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-400">No department assigned</p>
        )}
      </div>
    </Link>
  );
}
