import { z } from "zod";

export const CHESS_TIME_CONTROLS = [5, 10] as const;

/** `0` means "no limit" — chess.ts never starts a clock for this value. */
export const CHESS_UNLIMITED_TIME_CONTROL = 0 as const;

export type ChessSettings = {
  timeControlMinutes:
    | (typeof CHESS_TIME_CONTROLS)[number]
    | typeof CHESS_UNLIMITED_TIME_CONTROL;
};

const chessSettingsSchema = z.object({
  timeControlMinutes: z.union([z.literal(0), z.literal(5), z.literal(10)]),
}).strict();

export function parseGameSettings(
  gameType: string,
  input: unknown,
): Record<string, unknown> {
  if (gameType !== "CHESS") return {};
  return chessSettingsSchema.parse(input);
}

export function asChessSettings(
  input: Record<string, unknown>,
): ChessSettings {
  return chessSettingsSchema.parse(input);
}
