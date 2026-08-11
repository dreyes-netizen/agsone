"use client";

export function MedicineTabs({
  activeTab,
  onTabChange,
  pendingCount,
}: {
  activeTab: "catalog" | "inventory" | "requests";
  onTabChange: (tab: "catalog" | "inventory" | "requests") => void;
  pendingCount: number;
}) {
  return (
    <div role="tablist" aria-label="Medicine views" className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      {(["catalog", "inventory", "requests"] as const).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${
            activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab === "catalog" ? "Catalog" : tab === "inventory" ? "Inventory" : "Requests"}
          {tab === "requests" && pendingCount > 0 && (
            <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
