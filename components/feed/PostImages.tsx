"use client";

import { ZoomIn } from "lucide-react";

/**
 * Shared grid-width logic for the composer's upload preview (a padded,
 * floating editing UI — deliberately NOT edge-to-edge like the rendered
 * post below, since it lives inside the compose box, not a finished card).
 */
export function imageGridClasses(count: number) {
  if (count <= 1) return { container: "w-full sm:w-[40%]", grid: "" };
  if (count === 2) return { container: "w-full sm:w-[80%]", grid: "grid grid-cols-2 gap-1" };
  return { container: "w-full", grid: "grid grid-cols-3 gap-1" };
}

/**
 * Rendered post media — edge-to-edge (no horizontal padding; the card's own
 * `rounded-card overflow-hidden` clips the corners). A single image keeps
 * its natural aspect ratio and is only capped by a max-height so portrait,
 * landscape, and square photos are never cropped or stretched; anything
 * taller/wider than the cap is letterboxed on a subtle neutral backdrop
 * instead. 2-and-3+ images fall back to a tight square-tile mosaic, which
 * doesn't have a "natural ratio" to preserve per-tile anyway.
 */
export function PostImages({
  urls,
  onOpen,
  authorName,
}: {
  urls: string[];
  onOpen: (index: number) => void;
  authorName?: string;
}) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="group/img relative flex w-full items-center justify-center overflow-hidden bg-gray-50 focus:outline-none"
        aria-label="View image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt={authorName ? `Photo shared by ${authorName}` : "Post photo"}
          className="max-h-[520px] w-auto max-w-full h-auto object-contain"
          draggable={false}
        />
        <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
          <span className="bg-black/50 backdrop-blur-sm rounded-full p-2">
            <ZoomIn className="w-4 h-4 text-white" />
          </span>
        </span>
      </button>
    );
  }

  const shown = urls.slice(0, 3);
  const extra = urls.length - 3;
  const cols = urls.length === 2 ? "grid grid-cols-2 gap-0.5" : "grid grid-cols-3 gap-0.5";

  return (
    <div className={`w-full ${cols}`}>
      {shown.map((url, i) => {
        const isLastWithExtra = i === 2 && extra > 0;
        return (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className="group/img relative block w-full aspect-square overflow-hidden focus:outline-none"
            aria-label={`View image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={authorName ? `Photo ${i + 1} shared by ${authorName}` : `Post photo ${i + 1}`}
              className="w-full h-full object-cover"
              draggable={false}
            />
            <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors" />
            {isLastWithExtra ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-xl font-semibold">
                +{extra}
              </span>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                <span className="bg-black/50 backdrop-blur-sm rounded-full p-2">
                  <ZoomIn className="w-4 h-4 text-white" />
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
