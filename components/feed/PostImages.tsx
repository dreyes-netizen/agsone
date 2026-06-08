"use client";

import { ZoomIn } from "lucide-react";

export function PostImages({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  if (urls.length === 0) return null;

  const shown = urls.slice(0, 3);
  const extra = urls.length - 3;
  const cols = urls.length === 2 ? "grid grid-cols-2 gap-1" : "grid grid-cols-3 gap-1";
  const containerWidth = urls.length === 2 ? "w-full sm:w-[80%]" : "w-full";

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
          <img src={urls[0]} alt="Post image" className="w-full h-full object-cover" draggable={false} />
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
              alt={`Post image ${i + 1}`}
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
