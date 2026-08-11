"use client";

import { useState } from "react";
import type { Player, Employee } from "./types";

export function Avatar({ player, size = 40 }: { player: Player | Employee; size?: number }) {
  const [errored, setErrored] = useState(false);
  const s = `${size}px`;
  return player.avatarUrl && !errored ? (
    <img src={player.avatarUrl} alt={player.displayName} style={{ width: s, height: s }} className="rounded-full object-cover shrink-0" onError={() => setErrored(true)} />
  ) : (
    <div style={{ width: s, height: s }} className="rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold shrink-0" >
      {player.displayName[0]}
    </div>
  );
}
