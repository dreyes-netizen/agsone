import Link from "next/link";
import { CheckCircle2, ShoppingBag, Pill, MessageSquareWarning } from "lucide-react";
import { timeAgo } from "@/lib/helpers/timeAgo";

export type ActionItem = {
  kind: "REDEMPTION" | "MEDICINE" | "REPORT";
  id: string;
  title: string;
  actorName: string | null;
  actorAvatar: string | null;
  meta: string | null;
  createdAt: string;
};

const KIND_META: Record<ActionItem["kind"], { icon: React.ElementType; iconColor: string; href: (id: string) => string }> = {
  REDEMPTION: { icon: ShoppingBag,          iconColor: "bg-blue-500",    href: () => "/admin/redemptions" },
  MEDICINE:   { icon: Pill,                 iconColor: "bg-emerald-500", href: () => "/admin/medicine" },
  REPORT:     { icon: MessageSquareWarning, iconColor: "bg-red-500",     href: (id) => `/admin/feedback/${id}` },
};

// Age drives colour: neutral under 3 days, amber 3-7, red past 7 — a visual
// cue that something has been sitting untouched too long.
function ageColor(createdAt: string): string {
  const days = (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
  if (days >= 7) return "text-red-500 bg-red-50";
  if (days >= 3) return "text-amber-600 bg-amber-50";
  return "text-gray-500 bg-gray-50";
}

export function ActionQueue({
  items, counts,
}: {
  items: ActionItem[];
  counts: { redemptions: number; medicine: number; reports: number };
}) {
  const total = counts.redemptions + counts.medicine + counts.reports;

  return (
    <div className="lg:col-span-2 bg-white rounded-card border border-table-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <p className="font-semibold text-gray-900 text-sm">Needs Your Attention</p>
        {total > 0 && (
          <span className="text-xs bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
            {total}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          <p className="text-sm text-gray-500">All clear</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => {
            const { icon: Icon, iconColor, href } = KIND_META[item.kind];
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={href(item.id)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500/30"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon aria-hidden="true" className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate leading-tight">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {item.actorName ?? "Anonymous"}
                      {item.meta && <> · {item.meta}</>}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${ageColor(item.createdAt)}`}>
                    {timeAgo(item.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(counts.redemptions > 0 || counts.medicine > 0 || counts.reports > 0) && (
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-50 text-xs">
          {counts.redemptions > 0 && (
            <Link href="/admin/redemptions" className="text-navy-600 hover:text-navy-800 font-medium transition-colors">
              {counts.redemptions} redemption{counts.redemptions !== 1 ? "s" : ""} →
            </Link>
          )}
          {counts.medicine > 0 && (
            <Link href="/admin/medicine" className="text-navy-600 hover:text-navy-800 font-medium transition-colors">
              {counts.medicine} medicine →
            </Link>
          )}
          {counts.reports > 0 && (
            <Link href="/admin/feedback" className="text-navy-600 hover:text-navy-800 font-medium transition-colors">
              {counts.reports} report{counts.reports !== 1 ? "s" : ""} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
