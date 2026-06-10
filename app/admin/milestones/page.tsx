"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";

type MilestoneType =
  | "BIRTHDAY"
  | "WORK_ANNIVERSARY_1"
  | "WORK_ANNIVERSARY_3"
  | "WORK_ANNIVERSARY_5"
  | "WORK_ANNIVERSARY_10";

type MilestoneConfig = {
  type: MilestoneType;
  pointsReward: number;
  isActive: boolean;
};

const DEFAULTS: MilestoneConfig[] = [
  { type: "BIRTHDAY",            pointsReward: 500,  isActive: true },
  { type: "WORK_ANNIVERSARY_1",  pointsReward: 200,  isActive: true },
  { type: "WORK_ANNIVERSARY_3",  pointsReward: 500,  isActive: true },
  { type: "WORK_ANNIVERSARY_5",  pointsReward: 1000, isActive: true },
  { type: "WORK_ANNIVERSARY_10", pointsReward: 2000, isActive: true },
];

const TYPE_LABELS: Record<MilestoneType, string> = {
  BIRTHDAY:            "Birthday",
  WORK_ANNIVERSARY_1:  "1-Year Work Anniversary",
  WORK_ANNIVERSARY_3:  "3-Year Work Anniversary",
  WORK_ANNIVERSARY_5:  "5-Year Work Anniversary",
  WORK_ANNIVERSARY_10: "10-Year Work Anniversary",
};

export default function MilestonesPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [configs, setConfigs] = useState<MilestoneConfig[]>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: MilestoneConfig[] }>("/api/admin/milestones")
      .then((res) => {
        if (res.data.length > 0) {
          const merged = DEFAULTS.map((d) => {
            const found = res.data.find((c) => c.type === d.type);
            return found ?? d;
          });
          setConfigs(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  function updatePoints(type: MilestoneType, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setConfigs((prev) =>
      prev.map((c) => (c.type === type ? { ...c, pointsReward: num } : c))
    );
  }

  function toggleActive(type: MilestoneType) {
    setConfigs((prev) =>
      prev.map((c) => (c.type === type ? { ...c, isActive: !c.isActive } : c))
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/admin/milestones", {
        method: "PUT",
        body: JSON.stringify({ configs }),
      });
      setSuccess("Milestone rewards saved!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const thClass = "text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const tdClass = "px-6 py-4";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Milestone Rewards</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure automatic point awards for birthdays and work anniversaries.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Milestone Configuration</h2>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save All"}
          </button>
        </div>

        {success && (
          <div className="mx-6 mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>Milestone</th>
                <th className={thClass}>Points Awarded</th>
                <th className={thClass}>Active</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => (
                <tr key={cfg.type} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                  <td className={`${tdClass} font-medium text-gray-900`}>
                    {TYPE_LABELS[cfg.type]}
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={cfg.pointsReward}
                      onChange={(e) => updatePoints(cfg.type, e.target.value)}
                      className="w-28 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white"
                    />
                  </td>
                  <td className={tdClass}>
                    <button
                      onClick={() => toggleActive(cfg.type)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        cfg.isActive ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          cfg.isActive ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Awards fire daily at 1 AM UTC. Employees need a birthday or hire date set to receive awards.
        Each milestone is awarded once per year (birthday) or once per qualifying anniversary year.
      </p>
    </div>
  );
}
