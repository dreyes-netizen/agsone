"use client";

import { useSyncExternalStore } from "react";
import type { GifMapEntry } from "@/lib/hooks/useGifResolution";

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

/**
 * Renders a GIF comment's media given the resolved gif data (or its loading/
 * error state) from useGifResolution. Reserves its box via width/height +
 * aspect-ratio before the image loads (no layout shift), lazy-loads offscreen
 * (native `loading="lazy"`), and swaps to a static still under
 * prefers-reduced-motion instead of forcing autoplaying motion on everyone.
 */
export function GifCommentMedia({ gif }: { gif: GifMapEntry }) {
  const reducedMotion = usePrefersReducedMotion();

  if (gif === "error") {
    return (
      <div className="mt-1.5 flex items-center justify-center h-20 w-[220px] max-w-full rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-400">
        GIF unavailable
      </div>
    );
  }

  if (!gif) {
    return <div className="mt-1.5 w-[220px] max-w-full aspect-video rounded-xl bg-gray-100 animate-pulse" />;
  }

  const src = reducedMotion ? gif.stillUrl : gif.animatedUrl;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- animated GIF; next/image would strip animation frames
    <img
      src={src}
      alt={gif.altText}
      loading="lazy"
      width={gif.width || undefined}
      height={gif.height || undefined}
      style={gif.width && gif.height ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined}
      className="mt-1.5 w-full max-w-[280px] sm:max-w-[320px] rounded-xl border border-gray-100 object-cover"
    />
  );
}
