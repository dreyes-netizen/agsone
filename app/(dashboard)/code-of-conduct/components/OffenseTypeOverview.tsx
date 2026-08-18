import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";
import { tierClassification, tierStyle } from "./tierStyles";

interface OffenseTypeOverviewProps {
  tiers: CodeOfConduct["tiers"];
  onSelect: (key: string) => void;
}

export function OffenseTypeOverview({ tiers, onSelect }: OffenseTypeOverviewProps) {
  return (
    <div role="group" aria-label="Jump to an offense type" className="grid sm:grid-cols-3 gap-3">
      {tiers.map((tier, i) => {
        const style = tierStyle(i);
        return (
          <a
            key={tier.key}
            href={`#type-${tier.key.toLowerCase()}`}
            onClick={(e) => {
              e.preventDefault();
              onSelect(tier.key);
            }}
            className={`block rounded-lg border border-table-border bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${style.ringClass}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">Type {tier.key}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badgeClass}`}>
                {tierClassification(tier.label)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {tier.cleansingPeriodMonths}-month cleansing period
            </p>
          </a>
        );
      })}
    </div>
  );
}
