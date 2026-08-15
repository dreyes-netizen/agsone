import { ShoppingBag, Receipt } from "lucide-react";
import type { MarketplaceView } from "../types";

interface MarketplaceTabsProps {
  view: MarketplaceView;
  onChange: (view: MarketplaceView) => void;
  requestCount?: number;
}

export function MarketplaceTabs({ view, onChange, requestCount }: MarketplaceTabsProps) {
  return (
    <div role="tablist" aria-label="Marketplace views" className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
      <button
        role="tab"
        id="tab-browse"
        aria-selected={view === "browse"}
        aria-controls="panel-browse"
        onClick={() => onChange("browse")}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-command-black ${
          view === "browse" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"
        }`}
      >
        <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
        Browse
      </button>
      <button
        role="tab"
        id="tab-requests"
        aria-selected={view === "requests"}
        aria-controls="panel-requests"
        onClick={() => onChange("requests")}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-command-black ${
          view === "requests" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"
        }`}
      >
        <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
        My Requests
        {typeof requestCount === "number" && requestCount > 0 && (
          <span className={`text-xs tabular-nums ${view === "requests" ? "text-gray-500" : "text-gray-400"}`}>{requestCount}</span>
        )}
      </button>
    </div>
  );
}
