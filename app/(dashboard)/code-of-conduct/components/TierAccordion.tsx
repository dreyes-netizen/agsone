import { ChevronDown } from "lucide-react";
import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";
import { tierClassification, tierStyle } from "./tierStyles";
import { matchingExamples } from "./searchMatch";
import { DisciplinaryProgression } from "./DisciplinaryProgression";
import { OffenseList } from "./OffenseList";

interface TierAccordionProps {
  tier: CodeOfConduct["tiers"][number];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  query: string;
  sectionRef: (el: HTMLDivElement | null) => void;
}

export function TierAccordion({ tier, index, isOpen, onToggle, query, sectionRef }: TierAccordionProps) {
  const style = tierStyle(index);
  // If the query only matched this tier's label (e.g. "grave"), fall back to
  // showing every example rather than an empty list.
  const filteredExamples = matchingExamples(tier, query);
  const examples = query && filteredExamples.length === 0 ? tier.examples : filteredExamples;
  const panelId = `tier-panel-${tier.key}`;
  const headerId = `tier-header-${tier.key}`;

  return (
    <div
      id={`type-${tier.key.toLowerCase()}`}
      ref={sectionRef}
      className="rounded-card border border-table-border bg-white overflow-hidden scroll-mt-4"
    >
      <h3>
        <button
          id={headerId}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-400"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${style.badgeClass}`}>
              {tierClassification(tier.label)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                Type {tier.key} — {tier.label}
              </p>
              <p className="text-xs text-gray-500">
                Cleansing period: {tier.cleansingPeriodMonths} month{tier.cleansingPeriodMonths !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      {isOpen && (
        <div id={panelId} role="region" aria-labelledby={headerId} className="px-5 pb-5 pt-1 border-t border-black/5">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 pt-4">
            <DisciplinaryProgression steps={tier.steps} />
            <OffenseList examples={examples} query={query} />
          </div>
        </div>
      )}
    </div>
  );
}
