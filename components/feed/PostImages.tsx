"use client";

import { ZoomIn } from "lucide-react";

/**
 * Returns the Tailwind grid classes for the image container given how many
 * photos there are. Pure function so the layout decision is testable.
 *  1 -> single (natural aspect, height-capped, handled separately)
 *  2 -> two equal columns
 *  3 -> two columns (first tile spans both rows = "big + stack")
 *  4+ -> 2x2 grid
 */
export function photoGridClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1";
  if (count === 2) return "grid grid-cols-2 gap-1";
  if (count === 3) return "grid grid-cols-2 grid-rows-2 gap-1";
  return "grid grid-cols-2 gap-1"; // 4+
}

export function PostImages({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  if (urls.length === 0) return null;

  // ── Single image: natural aspect ratio, never cropped ──
  if (urls.length === 1) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden bg-black/5">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="group/img relative block w-full focus:outline-none"
          aria-label="View image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[0]}
            alt="Post image"
            className="w-full max-h-[480px] object-contain"
            draggable={false}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/15 transition-colors">
            <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm rounded-full p-2">
              <ZoomIn className="w-4 h-4 text-white" />
            </span>
          </span>
        </button>
      </div>
    );
  }

  // ── Multiple images: mosaic grid ──
  const shown = urls.slice(0, 4);
  const extra = urls.length - 4;

  return (
    <div className={`mt-3 rounded-xl overflow-hidden ${photoGridClass(urls.length)}`}>
      {shown.map((url, i) => {
        // For exactly 3 images, the first tile spans both rows on the left.
        const isHero = urls.length === 3 && i === 0;
        const spanClass = isHero ? "row-span-2" : "";
        const isLastWithExtra = i === 3 && extra > 0;
        return (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className={`group/img relative block w-full focus:outline-none ${spanClass}`}
            aria-label={`View image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Post image ${i + 1}`}
              className={`w-full object-cover ${isHero ? "h-full min-h-[160px]" : "h-40"}`}
              draggable={false}
            />
            {/* hover overlay — always rendered */}
            <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors" />
            {/* +N badge on top — only when there are more than 4 images */}
            {isLastWithExtra && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-xl font-semibold">
                +{extra}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
