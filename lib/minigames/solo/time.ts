import type { ManilaRankKeys } from "./types";

const MANILA_TIME_ZONE = "Asia/Manila";
const WEEK_START_DAY_INDEX = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getManilaDateParts(now: Date) {
  const parts = dateFormatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("Unable to resolve Manila date parts");
  }

  return { year, month, day };
}

function toDateKey(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function getManilaRankKeys(now: Date): ManilaRankKeys {
  const { year, month, day } = getManilaDateParts(now);
  const rankDate = toDateKey(year, month, day);
  const localMidnightUtc = Date.UTC(year, month - 1, day);
  const localDayIndex = new Date(localMidnightUtc).getUTCDay();
  const daysSinceMonday = (localDayIndex - WEEK_START_DAY_INDEX + 7) % 7;
  const weekStartDate = new Date(localMidnightUtc - (daysSinceMonday * DAY_MS));

  return {
    rankDate,
    weekStart: toDateKey(
      weekStartDate.getUTCFullYear(),
      weekStartDate.getUTCMonth() + 1,
      weekStartDate.getUTCDate(),
    ),
  };
}
