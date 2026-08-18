import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";

interface PromotionEffectsProps {
  effects: CodeOfConduct["promotionEffects"];
}

export function PromotionEffects({ effects }: PromotionEffectsProps) {
  return (
    <div className="bg-white rounded-card border border-table-border p-5">
      <h2 className="font-semibold text-gray-900">How Active Warnings Affect Promotion</h2>
      <p className="text-xs text-gray-500 mt-1 mb-4">Active warnings can defer eligibility for promotion.</p>
      <dl>
        {effects.map((e, i) => {
          const onHold = e.deferralMonths.toLowerCase().includes("hold");
          return (
            <div
              key={e.warningType}
              className={`flex items-center justify-between gap-4 py-2.5 ${i < effects.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <dt className="text-sm text-gray-700">{e.warningType}</dt>
              <dd className={`text-sm text-right ${onHold ? "font-medium text-amber-700" : "text-gray-500"}`}>
                {e.deferralMonths}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
