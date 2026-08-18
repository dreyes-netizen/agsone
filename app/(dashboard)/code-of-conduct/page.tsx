"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";

const TIER_COLOR: Record<string, string> = {
  A: "border-amber-300 bg-amber-50",
  B: "border-orange-300 bg-orange-50",
  C: "border-red-300 bg-red-50",
};

export default function CodeOfConductPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [coc, setCoc] = useState<CodeOfConduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ data: CodeOfConduct }>("/api/code-of-conduct");
      setCoc(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useRealtimeChannel(realtimeTopics.codeOfConduct, load, { debounceMs: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Code of Conduct</h1>
        <p className="text-gray-500 text-sm mt-1">Offense tiers, disciplinary steps, and cleansing periods.</p>
      </div>

      {loading || !coc ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {coc.tiers.map((tier) => {
              const isOpen = expanded === tier.key;
              return (
                <div key={tier.key} className={`rounded-card border-2 ${TIER_COLOR[tier.key] ?? "border-gray-200 bg-white"} overflow-hidden`}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : tier.key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-gray-500" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-gray-900">Type {tier.key} — {tier.label}</p>
                        <p className="text-xs text-gray-500">Cleansing period: {tier.cleansingPeriodMonths} month{tier.cleansingPeriodMonths !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 grid sm:grid-cols-2 gap-4 border-t border-black/5">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Disciplinary Steps</p>
                        <ol className="space-y-1 text-sm text-gray-700 list-decimal list-inside">
                          {tier.steps.sort((a, b) => a.order - b.order).map((s) => <li key={s.order}>{s.description}</li>)}
                        </ol>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Example Offenses</p>
                        <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                          {tier.examples.map((ex) => <li key={ex}>{ex}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-card border border-table-border p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Effects on Promotion</h2>
            <p className="text-xs text-gray-500 mb-4">Active warnings can defer eligibility for promotion.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {coc.promotionEffects.map((e) => (
                <div key={e.warningType} className="flex items-center justify-between text-sm border-b border-gray-100 py-1.5">
                  <span className="text-gray-700">{e.warningType}</span>
                  <span className="text-gray-500">{e.deferralMonths}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
