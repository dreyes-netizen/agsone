"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";

export default function AdminCodeOfConductPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [coc, setCoc] = useState<CodeOfConduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: CodeOfConduct }>("/api/admin/code-of-conduct")
      .then((res) => setCoc(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  function updateTier(key: string, patch: Partial<CodeOfConduct["tiers"][number]>) {
    setCoc((prev) => prev && { ...prev, tiers: prev.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
  }

  function addStep(tierKey: string) {
    setCoc((prev) => prev && {
      ...prev,
      tiers: prev.tiers.map((t) =>
        t.key !== tierKey ? t : { ...t, steps: [...t.steps, { order: t.steps.length + 1, description: "" }] }
      ),
    });
  }

  function updateStep(tierKey: string, order: number, description: string) {
    setCoc((prev) => prev && {
      ...prev,
      tiers: prev.tiers.map((t) =>
        t.key !== tierKey ? t : { ...t, steps: t.steps.map((s) => (s.order === order ? { ...s, description } : s)) }
      ),
    });
  }

  function removeStep(tierKey: string, order: number) {
    setCoc((prev) => prev && {
      ...prev,
      tiers: prev.tiers.map((t) =>
        t.key !== tierKey ? t : { ...t, steps: t.steps.filter((s) => s.order !== order).map((s, i) => ({ ...s, order: i + 1 })) }
      ),
    });
  }

  function addExample(tierKey: string) {
    setCoc((prev) => prev && {
      ...prev,
      tiers: prev.tiers.map((t) => (t.key !== tierKey ? t : { ...t, examples: [...t.examples, ""] })),
    });
  }

  function updateExample(tierKey: string, index: number, value: string) {
    setCoc((prev) => prev && {
      ...prev,
      tiers: prev.tiers.map((t) =>
        t.key !== tierKey ? t : { ...t, examples: t.examples.map((e, i) => (i === index ? value : e)) }
      ),
    });
  }

  function removeExample(tierKey: string, index: number) {
    setCoc((prev) => prev && {
      ...prev,
      tiers: prev.tiers.map((t) => (t.key !== tierKey ? t : { ...t, examples: t.examples.filter((_, i) => i !== index) })),
    });
  }

  function addPromotionEffect() {
    setCoc((prev) => prev && { ...prev, promotionEffects: [...prev.promotionEffects, { warningType: "", deferralMonths: "" }] });
  }

  function updatePromotionEffect(index: number, patch: Partial<CodeOfConduct["promotionEffects"][number]>) {
    setCoc((prev) => prev && {
      ...prev,
      promotionEffects: prev.promotionEffects.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  }

  function removePromotionEffect(index: number) {
    setCoc((prev) => prev && { ...prev, promotionEffects: prev.promotionEffects.filter((_, i) => i !== index) });
  }

  async function save() {
    if (!coc) return;
    setSaving(true);
    try {
      await apiFetch("/api/admin/code-of-conduct", { method: "PATCH", body: JSON.stringify(coc) });
      toast.success("Code of Conduct updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !coc) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Code of Conduct</h1>
          <p className="text-gray-500 text-sm mt-1">Edit offense tiers, disciplinary steps, and examples.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {coc.tiers.map((tier) => (
        <div key={tier.key} className="bg-white rounded-card border border-table-border p-6 space-y-4">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier {tier.key} Label</label>
              <input
                type="text"
                value={tier.label}
                onChange={(e) => updateTier(tier.key, { label: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cleansing period (months)</label>
              <input
                type="number"
                min={1}
                value={tier.cleansingPeriodMonths}
                onChange={(e) => updateTier(tier.key, { cleansingPeriodMonths: Math.max(1, Number(e.target.value) || 1) })}
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disciplinary Steps</p>
              {tier.steps.map((s) => (
                <div key={s.order} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{s.order}.</span>
                  <input
                    type="text"
                    value={s.description}
                    onChange={(e) => updateStep(tier.key, s.order, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                  <button onClick={() => removeStep(tier.key, s.order)} className="text-gray-400 hover:text-red-500" aria-label="Remove step">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addStep(tier.key)} className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-800">
                <Plus className="w-3.5 h-3.5" /> Add step
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Example Offenses</p>
              {tier.examples.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ex}
                    onChange={(e) => updateExample(tier.key, i, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                  />
                  <button onClick={() => removeExample(tier.key, i)} className="text-gray-400 hover:text-red-500" aria-label="Remove example">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addExample(tier.key)} className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-800">
                <Plus className="w-3.5 h-3.5" /> Add example
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-white rounded-card border border-table-border p-6 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Effects on Promotion</p>
        {coc.promotionEffects.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={e.warningType}
              onChange={(ev) => updatePromotionEffect(i, { warningType: ev.target.value })}
              placeholder="Warning type"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
            <input
              type="text"
              value={e.deferralMonths}
              onChange={(ev) => updatePromotionEffect(i, { deferralMonths: ev.target.value })}
              placeholder="Effect"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
            <button onClick={() => removePromotionEffect(i)} className="text-gray-400 hover:text-red-500" aria-label="Remove row">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={addPromotionEffect} className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-800">
          <Plus className="w-3.5 h-3.5" /> Add row
        </button>
      </div>
    </div>
  );
}
