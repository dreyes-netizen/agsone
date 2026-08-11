import Link from "next/link";
import { PackageCheck } from "lucide-react";

export type StockItem = {
  kind: "REWARD" | "MEDICINE";
  id: string;
  name: string;
  stockQuantity: number;
};

const KIND_LABEL: Record<StockItem["kind"], { label: string; href: string }> = {
  REWARD:   { label: "Reward",   href: "/admin/rewards" },
  MEDICINE: { label: "Medicine", href: "/admin/medicine" },
};

export function StockAlerts({ items }: { items: StockItem[] }) {
  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <p className="font-semibold text-gray-900 text-sm">Stock Alerts</p>
        {items.length > 0 && (
          <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <PackageCheck className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          <p className="text-sm text-gray-500">Everything in stock</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => {
            const { label, href } = KIND_LABEL[item.kind];
            const outOfStock = item.stockQuantity === 0;
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate leading-tight">{item.name}</p>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    outOfStock ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {outOfStock ? "Out of stock" : `${item.stockQuantity} left`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
