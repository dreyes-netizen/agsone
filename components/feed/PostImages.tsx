"use client";

import { ZoomIn } from "lucide-react";

/**
 * Shared layout for an N-image mosaic: 1 image sits at a fixed proportion of
 * the card so it doesn't stretch across an oversized empty card, 2 images
 * split the width evenly, 3+ fall back to a full-width 3-column grid with a
 * "+N" overlay on the last tile. Used by both the post-card image grid
 * (below) and the composer's upload preview, so the two never drift apart.
 */
export function imageGridClasses(count: number) {
  if (count <= 1) return { container: "w-full sm:w-[40%]", grid: "" };
  if (count === 2) return { container: "w-full sm:w-[80%]", grid: "grid grid-cols-2 gap-1" };
  return { container: "w-full", grid: "grid grid-cols-3 gap-1" };
}

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

  const shown = urls.slice(0, 3);
  const extra = urls.length - 3;
  const { container: containerWidth, grid: cols } = imageGridClasses(urls.length);

  // Single image: full-width on mobile, 40% on desktop
  if (urls.length === 1) {
    return (
      <div className="mt-3 w-full sm:w-[40%]">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="group/img relative block w-full aspect-square rounded-lg overflow-hidden focus:outline-none"
          aria-label="View image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[0]} alt={authorName ? `Photo shared by ${authorName}` : "Post photo"} className="w-full h-full object-cover" draggable={false} />
          <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
            <span className="bg-black/50 backdrop-blur-sm rounded-full p-2">
              <ZoomIn className="w-4 h-4 text-white" />
            </span>
          </span>
        </button>
      </div>
    );
  }

  // 2 or 3+ images: proportional grid
  return (
    <div className={`mt-3 ${containerWidth} ${cols}`}>
      {shown.map((url, i) => {
        const isLastWithExtra = i === 2 && extra > 0;
        return (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className="group/img relative block w-full aspect-square rounded-lg overflow-hidden focus:outline-none"
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
