"use client";

import { useEffect, useRef, useState } from "react";
import { getGifsByIds, type GifResult } from "@/lib/giphy/client";

export type GifMapEntry = GifResult | "error" | undefined;

/**
 * Resolves gif ids referenced by currently-rendered comments to renderable
 * GIF data, batched into one GIPHY call per set of newly-seen ids —
 * comments only ever store {gifProvider, gifId} (see SocialComment in
 * schema.prisma), never a media URL, so rendering always re-resolves live.
 */
export function useGifResolution(ids: string[]): Record<string, GifMapEntry> {
  const [map, setMap] = useState<Record<string, GifMapEntry>>({});
  const requested = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = ids.filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));

    getGifsByIds(missing).then((resolved) => {
      setMap((prev) => {
        const next = { ...prev };
        for (const id of missing) next[id] = resolved[id] ?? "error";
        return next;
      });
    });
  }, [ids]);

  return map;
}
