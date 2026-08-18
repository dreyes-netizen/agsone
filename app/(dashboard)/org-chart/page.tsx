"use client";

import { useEffect, useState } from "react";
import { Loader2, Network } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { buildOrgChartTree, type OrgChartUser } from "@/lib/orgChart/buildTree";
import { OrgChartTree } from "@/components/org-chart/OrgChartTree";

export default function OrgChartPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<OrgChartUser[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await apiFetch<{ data: OrgChartUser[] }>("/api/org-chart");
      setNodes(res.data);
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

  useRealtimeChannel(realtimeTopics.orgChart, load, { debounceMs: 200 });

  const roots = buildOrgChartTree(nodes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Org Chart</h1>
        <p className="text-gray-500 text-sm mt-1">Click a name to view their profile.</p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 bg-white rounded-card border border-table-border px-4 py-3">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-400" /> HR & Compliance</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-100 border border-teal-400" /> Quality & Training</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white border border-gray-300" /> Operations / Staff</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0 border-t-2 border-dashed border-gray-400" /> Dotted-line / Support reporting</span>
      </div>

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12">
            <Network className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">The org chart hasn&apos;t been set up yet.</p>
          </div>
        ) : (
          <OrgChartTree roots={roots} />
        )}
      </div>
    </div>
  );
}
