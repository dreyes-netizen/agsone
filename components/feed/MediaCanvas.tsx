"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { useImageZoomPan } from "@/lib/hooks/useImageZoomPan";
import { MediaZoomControls } from "@/components/feed/MediaZoomControls";

export type MediaCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
};

/**
 * The dark, zoomable/pannable media area of the viewer. Owns per-image
 * loading/error state (reset whenever `src` changes) and multi-image
 * prev/next navigation; all zoom/pan mechanics live in useImageZoomPan so
 * this stays focused on layout, loading, and the surrounding chrome. Exposes
 * zoomIn/zoomOut/fit imperatively so MediaViewer's keyboard shortcuts
 * (+/-/0) can reach into a hook instance that lives inside this component.
 */
export const MediaCanvas = forwardRef<MediaCanvasHandle, {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  authorName?: string;
}>(function MediaCanvas({ images, index, onIndexChange, authorName }, ref) {
  const src = images[index];
  const zoom = useImageZoomPan(src);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  useImperativeHandle(ref, () => ({
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    fit: zoom.fit,
  }), [zoom.zoomIn, zoom.zoomOut, zoom.fit]);

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const alt = authorName ? `Photo ${index + 1} of ${images.length} shared by ${authorName}` : `Photo ${index + 1} of ${images.length}`;

  return (
    <div className="relative flex-1 min-w-0 bg-neutral-950 flex flex-col">
      <div
        ref={zoom.containerRef}
        className="relative flex-1 min-h-0 overflow-hidden select-none"
      >
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading image…</span>
          </div>
        )}

        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 px-6 text-center">
            <ImageOff className="w-8 h-8" aria-hidden="true" />
            <p className="text-sm">This image couldn&apos;t be loaded.</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            ref={zoom.imageRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(e) => { zoom.onImageLoad(e); setStatus("loaded"); }}
            onError={() => setStatus("error")}
            className={`absolute top-1/2 left-1/2 max-w-none max-h-none transition-opacity duration-150 ${status === "loaded" ? "opacity-100" : "opacity-0"} ${
              zoom.isPanning ? "cursor-grabbing" : zoom.canPan ? "cursor-grab" : "cursor-default"
            }`}
            style={{
              transform: `translate(-50%, -50%) ${zoom.transformStyle.transform}`,
              touchAction: "none",
            }}
            {...zoom.imageHandlers}
          />
        )}

        {images.length > 1 && (
          <>
            {hasPrev && (
              <button
                type="button"
                onClick={() => onIndexChange(index - 1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={() => onIndexChange(index + 1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-current={i === index}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/40 hover:bg-white/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {status === "loaded" && (
        <div className="absolute bottom-4 right-4 z-10">
          <MediaZoomControls
            zoomPercent={zoom.zoomPercent}
            isFit={zoom.isFit}
            canZoomIn={zoom.canZoomIn}
            canZoomOut={zoom.canZoomOut}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onFit={zoom.fit}
            onZoomTo100={zoom.zoomTo100}
          />
        </div>
      )}
    </div>
  );
});
