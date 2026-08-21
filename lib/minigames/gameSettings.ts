import { z } from "zod";

export const CHESS_TIME_CONTROLS = [5, 10] as const;

export type ChessSettings = {
  timeControlMinutes: (typeof CHESS_TIME_CONTROLS)[number];
};

const chessSettingsSchema = z.object({
  timeControlMinutes: z.union([z.literal(5), z.literal(10)]),
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
