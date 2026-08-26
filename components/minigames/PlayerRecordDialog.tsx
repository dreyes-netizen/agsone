"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Crown, Gamepad2, Loader2, Swords } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/leaderboard/UserAvatar";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { GAME_TYPE_ICONS, GAME_TYPE_LABELS } from "@/lib/constants/gameTypes";
import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type { SoloGameType } from "@/lib/minigames/solo/types";
import { formatSoloScore } from "@/components/minigames/solo/SoloLeaderboardPanel";

type PlayerRecord = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    department: string | null;
  };
  isSelf: boolean;
  multiplayer: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
    winRate: number;
    perGame: Record<string, { w: number; l: number; d: number }>;
  };
  headToHead: { wins: number; losses: number; draws: number; total: number } | null;
  solo: {
    personalBests: Record<string, number | null>;
    weekRanks: Record<string, number | null>;
    championships: {
      id: string;
      gameType: SoloGameType;
      scope: string;
      weekStart: string;
      primaryScore: number;
      secondaryScore: number | null;
    }[];
  };
};

/**
 * The record card opened by clicking a player's name on either minigame
 * leaderboard. Fetches on open (like ReactionDetailsDialog) rather than making
 * every board row preload stats nobody may look at.
 *
 * Scope is deliberately narrow — game records only. Points, badges, bio and
 * shoutouts belong to /employees/[id], which the footer links out to.
 */
export function PlayerRecordDialog({
  userId,
  onClose,
}: {
  /** The player whose record to show, or null when the dialog is closed. */
  userId: string | null;
  onClose: () => void;
}) {
  const { apiFetch } = useApiClient();
  const [record, setRecord] = useState<PlayerRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Deferred rather than set synchronously in the effect body — same pattern
    // the solo leaderboard panel uses to enter its loading state without
    // triggering a cascading render.
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setRecord(null);
    });
    apiFetch<{ data: PlayerRecord }>(`/api/minigames/players/${userId}/record`)
      .then((res) => {
        if (active) setRecord(res.data);
      })
      .catch(() => {
        if (active) setError("Couldn't load this player's record.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const soloGames = record
    ? (Object.keys(SOLO_GAME_REGISTRY) as SoloGameType[]).filter(
        (gameType) => record.solo.personalBests[gameType] != null,
      )
    : [];
  const multiplayerGames = record ? Object.entries(record.multiplayer.perGame) : [];

  return (
    <Dialog
      open={userId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b border-gray-100">
          <DialogTitle>{record ? record.user.displayName : "Player record"}</DialogTitle>
          <DialogDescription>
            {record?.user.department ?? "Minigame records"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[160px]">
          {/* Also treated as loading before the deferred setLoading lands, so
              opening the dialog never flashes an empty body first. */}
          {loading || (userId !== null && !record && !error) ? (
            <div className="flex items-center justify-center py-14 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading player record…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-gray-500">
              <AlertCircle className="w-5 h-5 text-gray-400" aria-hidden="true" />
              {error}
            </div>
          ) : record ? (
            <>
              {/* Identity + overall multiplayer line */}
              <div className="flex items-center gap-3 px-4 py-4">
                <UserAvatar
                  name={record.user.displayName}
                  url={record.user.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">
                    {record.user.displayName}
                  </p>
                  {record.user.department && (
                    <p className="text-xs text-gray-500 truncate">
                      {record.user.department}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-600 tabular-nums">
                    {record.multiplayer.total > 0
                      ? `${record.multiplayer.wins}W · ${record.multiplayer.losses}L${
                          record.multiplayer.draws > 0
                            ? ` · ${record.multiplayer.draws}D`
                            : ""
                        } · ${record.multiplayer.winRate}% win rate`
                      : "No multiplayer games yet"}
                  </p>
                </div>
              </div>

              {/* Head-to-head vs the viewer */}
              {record.headToHead && record.headToHead.total > 0 && (
                <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2.5 text-sm">
                  <Swords className="w-4 h-4 text-navy-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-navy-800">You vs them</span>
                  <span className="ml-auto font-bold tabular-nums text-navy-700">
                    {record.headToHead.wins}W · {record.headToHead.losses}L
                    {record.headToHead.draws > 0 ? ` · ${record.headToHead.draws}D` : ""}
                  </span>
                </div>
              )}

              {/* Multiplayer per-game breakdown */}
              {multiplayerGames.length > 0 && (
                <Section title="Multiplayer">
                  {multiplayerGames.map(([gameType, r]) => {
                    const Icon = GAME_TYPE_ICONS[gameType] ?? Gamepad2;
                    return (
                      <li
                        key={gameType}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
                      >
                        <Icon
                          className="w-4 h-4 text-gray-500 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="flex-1 min-w-0 truncate text-gray-700">
                          {GAME_TYPE_LABELS[gameType] ?? gameType}
                        </span>
                        <span className="font-semibold tabular-nums text-gray-900">
                          {r.w}W · {r.l}L{r.d > 0 ? ` · ${r.d}D` : ""}
                        </span>
                      </li>
                    );
                  })}
                </Section>
              )}

              {/* Solo Arcade personal bests + this week's company rank */}
              {soloGames.length > 0 && (
                <Section title="Solo Arcade">
                  {soloGames.map((gameType) => {
                    const best = record.solo.personalBests[gameType] as number;
                    const rank = record.solo.weekRanks[gameType] ?? null;
                    return (
                      <li
                        key={gameType}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
                      >
                        <span className="flex-1 min-w-0 truncate text-gray-700">
                          {SOLO_GAME_REGISTRY[gameType].label}
                        </span>
                        <span className="font-semibold tabular-nums text-gray-900">
                          {formatSoloScore(gameType, best)}
                        </span>
                        <span className="w-16 text-right text-xs tabular-nums text-gray-500">
                          {rank ? `#${rank} this wk` : "Unranked"}
                        </span>
                      </li>
                    );
                  })}
                </Section>
              )}

              {/* Weekly championships */}
              {record.solo.championships.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                    <Crown className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    {record.solo.championships.length} weekly{" "}
                    {record.solo.championships.length === 1 ? "title" : "titles"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {[
                      ...new Set(
                        record.solo.championships.map(
                          (c) => SOLO_GAME_REGISTRY[c.gameType]?.label ?? c.gameType,
                        ),
                      ),
                    ].join(" · ")}
                  </p>
                </div>
              )}

              {multiplayerGames.length === 0 && soloGames.length === 0 && (
                <p className="px-4 pb-6 text-center text-sm text-gray-500">
                  No minigame records yet.
                </p>
              )}
            </>
          ) : null}
        </div>

        {record && (
          <div className="border-t border-gray-100 px-4 py-3">
            <Link
              href={`/employees/${record.user.id}`}
              onClick={onClose}
              className="block text-center text-sm font-semibold text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded py-1"
            >
              View full profile →
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100">
      <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <ul className="divide-y divide-gray-50">{children}</ul>
    </div>
  );
}
