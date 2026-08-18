"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Network, Maximize } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import type { OrgChartUser } from "@/lib/orgChart/buildTree";
import { OrgChartCanvas, type OrgChartCanvasApi } from "@/components/org-chart/OrgChartCanvas";
import { OrgChartSearch } from "@/components/org-chart/OrgChartSearch";
import { OrgChartLevelSelector } from "@/components/org-chart/OrgChartLevelSelector";

export default function OrgChartPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [nodes, setNodes] = useState<OrgChartUser[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasApiRef = useRef<OrgChartCanvasApi | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Org Chart</h1>
        <p className="text-gray-500 text-sm mt-1">Explore teams, departments, and reporting relationships.</p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 bg-white rounded-card border border-table-border px-4 py-3">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-400" /> HR & Compliance</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-100 border border-teal-400" /> Quality & Training</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white border border-gray-300" /> Operations / Staff</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0 border-t-2 border-dashed border-gray-400" /> Dotted-line / Support reporting</span>
      </div>

      {!loading && nodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <OrgChartSearch nodes={nodes} onSelect={(id) => canvasApiRef.current?.focusNode(id)} />
          <div className="flex items-center gap-2">
            <OrgChartLevelSelector onSelectLevel={(level) => canvasApiRef.current?.setCollapseLevel(level)} />
            <button
              type="button"
              onClick={() => canvasApiRef.current?.fitAll()}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
            >
              <Maximize className="w-4 h-4" aria-hidden="true" />
              Fit
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12">
            <Network className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">The org chart hasn&apos;t been set up yet.</p>
          </div>
        ) : (
          <OrgChartCanvas nodes={nodes} onReady={(api) => (canvasApiRef.current = api)} />
        )}
      </div>
    </div>
  );
}
