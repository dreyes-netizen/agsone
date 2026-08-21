"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Loader2, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type {
  SoloGameType,
  SoloRankPeriod,
  SoloRankScope,
} from "@/lib/minigames/solo/types";

export type SoloLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  primaryScore: number;
  secondaryScore: number | null;
  completedAt: string;
  rank: number;
};
export type SoloSummary = {
  personalBest: SoloLeaderboardEntry | null;
  ranks: {
    week: Record<SoloRankScope, SoloLeaderboardEntry | null>;
    allTime: Record<SoloRankScope, SoloLeaderboardEntry | null>;
  };
};
export type Champion = {
  id: string;
  gameType: SoloGameType;
  weekStart: string;
  primaryScore: number;
  secondaryScore: number | null;
  user: { displayName: string; avatarUrl: string | null };
};
type ChampionResponse = {
  championships: Champion[];
  recentCompanyChampions?: Champion[];
};

const VISIBLE_TOP_ROWS = 10;

export function buildSoloLeaderboardUrl({
  gameType,
  scope,
  period,
}: {
  gameType: SoloGameType;
  scope: SoloRankScope;
  period: SoloRankPeriod;
}) {
  return `/api/minigames/solo/leaderboard?${new URLSearchParams({ gameType, period, scope }).toString()}`;
}

export function splitVisibleSoloRows(
  entries: SoloLeaderboardEntry[],
  currentUserId: string | undefined,
) {
  const topRows = entries.filter((entry) => entry.rank <= VISIBLE_TOP_ROWS);
  const currentUser = entries.find((entry) => entry.userId === currentUserId);
  return {
    topRows,
    pinnedCurrentUser:
      currentUser && currentUser.rank > VISIBLE_TOP_ROWS ? currentUser : null,
  };
}

export function formatSoloScore(gameType: SoloGameType, score: number) {
  if (gameType === "TYPING") return `${score} WPM`;
  if (gameType === "REACTION") return `${score} ms`;
  return `Level ${score}`;
}

export function formatSoloSecondaryScore(
  gameType: SoloGameType,
  score: number | null,
) {
  if (score === null) return null;
  if (gameType === "TYPING") return `Accuracy ${(score / 100).toFixed(2)}%`;
  return `Time ${(score / 1000).toFixed(1)}s`;
}

function formatSoloResult(
  gameType: SoloGameType,
  primaryScore: number,
  secondaryScore: number | null,
) {
  return [
    formatSoloScore(gameType, primaryScore),
    formatSoloSecondaryScore(gameType, secondaryScore),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function createSoloChampionRequestLifecycle<T>(
  request: (userId: string) => Promise<T[]>,
  onChampions: (champions: T[]) => void,
  onError: () => void = () => {},
) {
  const requestedUserIds: string[] = [];
  return {
    requestedUserIds,
    start(userId: string) {
      let active = true;
      requestedUserIds.push(userId);
      void request(userId)
        .then((champions) => {
          if (active) onChampions(champions);
        })
        .catch(() => {
          if (active) onError();
        });
      return () => {
        active = false;
      };
    },
  };
}

export function SoloLeaderboardPanel() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [gameType, setGameType] = useState<SoloGameType>("TYPING");
  const [scope, setScope] = useState<SoloRankScope>("company");
  const [period, setPeriod] = useState<SoloRankPeriod>("week");
  const [entries, setEntries] = useState<SoloLeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<SoloSummary | null>(null);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const currentUserId = dbUser?.id;
  const currentUserName = dbUser?.displayName ?? user?.displayName ?? "You";
  const championLifecycle = useMemo(
    () =>
      createSoloChampionRequestLifecycle<Champion>(
        async () =>
          (
            await apiFetch<{ data: ChampionResponse }>(
              "/api/minigames/solo/champions?includeRecentCompany=true",
            )
          ).data.recentCompanyChampions ?? [],
        setChampions,
        () => setChampions([]),
      ),
    [apiFetch],
  );

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoadingBoard(true);
        setBoardError(null);
      }
    });
    void apiFetch<{ data: SoloLeaderboardEntry[] }>(
      buildSoloLeaderboardUrl({ gameType, scope, period }),
    )
      .then((response) => {
        if (active) setEntries(response.data);
      })
      .catch(() => {
        if (active) {
          setEntries([]);
          setBoardError("Unable to load this leaderboard. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoadingBoard(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, authLoading, gameType, period, scope, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setLoadingSummary(true);
    });
    void apiFetch<{ data: SoloSummary }>(
      `/api/minigames/solo/summary?gameType=${gameType}`,
    )
      .then((response) => {
        if (active) setSummary(response.data);
      })
      .catch(() => {
        if (active) setSummary(null);
      })
      .finally(() => {
        if (active) setLoadingSummary(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, authLoading, gameType, user]);

  useEffect(() => {
    if (authLoading || !user || !currentUserId) return;
    return championLifecycle.start(currentUserId);
  }, [authLoading, championLifecycle, currentUserId, user]);

  return (
    <section aria-labelledby="solo-rankings-heading" className="space-y-4">
      <div className="rounded-xl border border-table-border bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="solo-rankings-heading"
              className="flex items-center gap-2 text-lg font-bold text-gray-900"
            >
              <Trophy className="size-5 text-amber-600" aria-hidden="true" />{" "}
              Solo rankings
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your best valid ranked run sets your place on each board.
            </p>
          </div>
          <label className="text-sm font-medium text-gray-700">
            Game
            <select
              value={gameType}
              onChange={(event) =>
                setGameType(event.target.value as SoloGameType)
              }
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy-500/30 sm:w-48"
            >
              {Object.values(SOLO_GAME_REGISTRY).map((definition) => (
                <option key={definition.key} value={definition.key}>
                  {definition.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="group"
            aria-label="Solo leaderboard scope"
            className="flex w-full rounded-lg border border-gray-200 p-1 text-sm sm:w-auto"
          >
            <ToggleButton
              active={scope === "company"}
              onClick={() => setScope("company")}
            >
              Company
            </ToggleButton>
            <ToggleButton
              active={scope === "department"}
              disabled={!dbUser?.department}
              onClick={() => setScope("department")}
            >
              Department
            </ToggleButton>
          </div>
          <div
            role="group"
            aria-label="Solo leaderboard period"
            className="flex w-full rounded-lg border border-gray-200 p-1 text-sm sm:w-auto"
          >
            <ToggleButton
              active={period === "week"}
              onClick={() => setPeriod("week")}
            >
              This week
            </ToggleButton>
            <ToggleButton
              active={period === "alltime"}
              onClick={() => setPeriod("alltime")}
            >
              All-time
            </ToggleButton>
          </div>
        </div>
      </div>
      <SoloLeaderboardResults
        gameType={gameType}
        period={period}
        scope={scope}
        entries={entries}
        summary={summary}
        champions={champions}
        loadingBoard={loadingBoard}
        loadingSummary={loadingSummary}
        boardError={boardError}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </section>
  );
}

export function SoloLeaderboardResults({
  gameType,
  period,
  scope,
  entries,
  summary,
  champions,
  loadingBoard,
  loadingSummary,
  boardError,
  currentUserId,
  currentUserName,
}: {
  gameType: SoloGameType;
  period: SoloRankPeriod;
  scope: SoloRankScope;
  entries: SoloLeaderboardEntry[];
  summary: SoloSummary | null;
  champions: Champion[];
  loadingBoard: boolean;
  loadingSummary: boolean;
  boardError: string | null;
  currentUserId: string | undefined;
  currentUserName: string;
}) {
  const game = SOLO_GAME_REGISTRY[gameType];
  const { topRows, pinnedCurrentUser } = splitVisibleSoloRows(
    entries,
    currentUserId,
  );
  const summaryPeriod = period === "alltime" ? "allTime" : "week";
  const currentRank = summary?.ranks[summaryPeriod][scope] ?? null;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          label="Official PB"
          value={
            loadingSummary
              ? "Loading…"
              : summary?.personalBest
                ? formatSoloResult(
                    gameType,
                    summary.personalBest.primaryScore,
                    summary.personalBest.secondaryScore,
                  )
                : "No official PB yet"
          }
        />
        <Stat
          label={`${period === "week" ? "This week" : "All-time"} ${scope} rank`}
          value={
            loadingSummary
              ? "Loading…"
              : currentRank
                ? `#${currentRank.rank}`
                : "Not ranked yet"
          }
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-table-border bg-white">
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-bold text-gray-800">
            {game.label} · {scope === "company" ? "Company" : "Department"} ·{" "}
            {period === "week" ? "This week" : "All-time"}
          </p>
        </div>
        {loadingBoard ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-500"
          >
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />{" "}
            Loading rankings…
          </div>
        ) : boardError ? (
          <p
            role="alert"
            className="px-4 py-10 text-center text-sm text-rose-600"
          >
            {boardError}
          </p>
        ) : topRows.length === 0 && !pinnedCurrentUser ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            No valid ranked runs yet. Be the first!
          </p>
        ) : (
          <ol
            aria-label={`${game.label} rankings`}
            className="divide-y divide-gray-100"
          >
            {topRows.map((entry) => (
              <RankingRow
                key={entry.userId}
                entry={entry}
                gameType={gameType}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
              />
            ))}
          </ol>
        )}
        {pinnedCurrentUser && (
          <div className="border-t border-dashed border-gray-300 bg-navy-50 px-4 py-1 sm:px-5">
            <p className="py-2 text-xs font-medium text-navy-700">
              Your current position
            </p>
            <ol>
              <RankingRow
                entry={pinnedCurrentUser}
                gameType={gameType}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
              />
            </ol>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-table-border bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <Crown className="size-4 text-amber-600" aria-hidden="true" /> Recent
          weekly champions
        </h3>
        {champions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            Weekly champions will appear here after the first ranked week
            closes.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {champions.slice(0, 6).map((champion) => (
              <li
                key={champion.id}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                <p className="font-semibold text-gray-900">
                  {champion.user.displayName}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {SOLO_GAME_REGISTRY[champion.gameType]?.label ??
                    champion.gameType}{" "}
                  ·{" "}
                  {formatSoloResult(
                    champion.gameType,
                    champion.primaryScore,
                    champion.secondaryScore,
                  )}{" "}
                  · week of {formatWeek(champion.weekStart)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ToggleButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-600 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-command-black text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-navy-700">
        {value}
      </p>
    </div>
  );
}
function RankingRow({
  entry,
  gameType,
  currentUserId,
  currentUserName,
}: {
  entry: SoloLeaderboardEntry;
  gameType: SoloGameType;
  currentUserId: string | undefined;
  currentUserName: string;
}) {
  const isCurrentUser = entry.userId === currentUserId;
  const secondary = formatSoloSecondaryScore(gameType, entry.secondaryScore);
  return (
    <li
      aria-label={`Rank ${entry.rank}: ${isCurrentUser ? currentUserName : entry.displayName}, ${formatSoloResult(gameType, entry.primaryScore, entry.secondaryScore)}`}
      className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm sm:px-5 ${isCurrentUser ? "bg-navy-50" : ""}`}
    >
      <span className="font-bold tabular-nums text-gray-500">
        #{entry.rank}
      </span>
      <span className="min-w-0 truncate font-medium text-gray-900">
        {isCurrentUser ? `${currentUserName} (You)` : entry.displayName}
      </span>
      <span className="text-right font-bold tabular-nums text-navy-700">
        {formatSoloScore(gameType, entry.primaryScore)}
        {secondary && (
          <small className="block text-xs font-medium text-gray-500">
            {secondary}
          </small>
        )}
      </span>
    </li>
  );
}
function formatWeek(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}
