"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, SearchX, TriangleAlert } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";
import { OffenseSearch } from "./components/OffenseSearch";
import { OffenseTypeOverview } from "./components/OffenseTypeOverview";
import { TierAccordion } from "./components/TierAccordion";
import { PromotionEffects } from "./components/PromotionEffects";
import { tierMatchesQuery } from "./components/searchMatch";

export default function CodeOfConductPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [coc, setCoc] = useState<CodeOfConduct | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasAppliedHash = useRef(false);

  async function load() {
    setError(false);
    try {
      const res = await apiFetch<{ data: CodeOfConduct; updatedAt: string | null }>("/api/code-of-conduct");
      setCoc(res.data);
      setUpdatedAt(res.updatedAt);
    } catch (err) {
      console.error(err);
      setError(true);
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

  const query = search.trim();
  const isSearching = query.length > 0;

  const visibleTiers = useMemo(
    () => (coc ? coc.tiers.filter((t) => tierMatchesQuery(t, query)) : []),
    [coc, query]
  );

  // While searching, which tiers are open is fully derived from the query —
  // no need to sync it into state. Manual expand/collapse only applies once
  // the search is cleared again.
  const effectiveExpandedKeys = isSearching ? new Set(visibleTiers.map((t) => t.key)) : expandedKeys;

  // Deep-link support: /code-of-conduct#type-b opens and scrolls to Type B.
  // Deferred a microtask so the setState calls don't run synchronously
  // inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!coc || hasAppliedHash.current) return;
    hasAppliedHash.current = true;
    const hash = window.location.hash.replace("#type-", "").toUpperCase();
    const match = coc.tiers.find((t) => t.key.toUpperCase() === hash);
    if (!match) return;
    queueMicrotask(() => {
      setExpandedKeys((prev) => new Set(prev).add(match.key));
      sectionRefs.current.get(match.key)?.scrollIntoView({ block: "start" });
    });
  }, [coc]);

  function toggleTier(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function goToTier(key: string) {
    setExpandedKeys((prev) => new Set(prev).add(key));
    sectionRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const lastUpdatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Code of Conduct</h1>
          {lastUpdatedLabel && <p className="text-xs text-gray-500">Last updated: {lastUpdatedLabel}</p>}
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Understand offense classifications, disciplinary actions, and cleansing periods.
        </p>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
        </div>
      ) : error || !coc ? (
        <div className="flex flex-col items-center justify-center gap-2 p-12 bg-white rounded-card border border-table-border text-center">
          <TriangleAlert className="w-8 h-8 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">Couldn&apos;t load the Code of Conduct.</p>
          <button onClick={load} className="text-sm font-medium text-navy-600 hover:text-navy-800">
            Try again
          </button>
        </div>
      ) : (
        <>
          <OffenseSearch value={search} onChange={setSearch} />

          <OffenseTypeOverview tiers={coc.tiers} onSelect={goToTier} />

          {isSearching && visibleTiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 bg-white rounded-card border border-table-border text-center">
              <SearchX className="w-8 h-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">No offenses found for &ldquo;{query}&rdquo;.</p>
              <button onClick={() => setSearch("")} className="text-sm font-medium text-navy-600 hover:text-navy-800">
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {coc.tiers.map((tier, i) => {
                if (!visibleTiers.includes(tier)) return null;
                return (
                  <TierAccordion
                    key={tier.key}
                    tier={tier}
                    index={i}
                    isOpen={effectiveExpandedKeys.has(tier.key)}
                    onToggle={() => toggleTier(tier.key)}
                    query={query}
                    sectionRef={(el) => {
                      if (el) sectionRefs.current.set(tier.key, el);
                      else sectionRefs.current.delete(tier.key);
                    }}
                  />
                );
              })}
            </div>
          )}

          <PromotionEffects effects={coc.promotionEffects} />
        </>
      )}
    </div>
  );
}
