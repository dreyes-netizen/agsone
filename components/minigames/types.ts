export type Player = { id: string; displayName: string; avatarUrl: string | null };
export type Role = "host" | "guest" | "spectator";
export type Employee = { id: string; displayName: string; avatarUrl: string | null };

export type Session = {
  id: string;
  gameType: string;
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  state: Record<string, unknown>;
  currentTurn: string | null;
  winnerId: string | null;
  pointsWager: number;
  host: Player;
  guest: Player | null;
  myRole: Role;
  updatedAt: string;
};
