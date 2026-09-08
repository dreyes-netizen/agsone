"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { videoPosterUrl } from "@/lib/cloudinary/videoUrl";

/**
 * Rendered post video — edge-to-edge, matching PostImages' single-image
 * treatment (natural ratio, capped height, letterboxed on a neutral backdrop).
 *
 * Click-to-play is deliberate, not a nicety. Mounting a <video> per post would
 * have every card in the feed opening a connection and buffering on scroll;
 * bandwidth is the recurring cost on Cloudinary and it scales with viewers ×
 * posts. Until someone presses play this is one ~30 KB JPEG.
 */
export function PostVideo({ url, authorName }: { url: string; authorName?: string }) {
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  if (playing) {
    return (
      <div className="flex w-full items-center justify-center bg-black">
        <video
          src={url}
          poster={posterFailed ? undefined : videoPosterUrl(url)}
          className="max-h-[520px] w-auto max-w-full h-auto"
          controls
          autoPlay
          playsInline
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group/vid relative flex w-full items-center justify-center overflow-hidden bg-gray-900 focus:outline-none"
      aria-label={authorName ? `Play video shared by ${authorName}` : "Play video"}
    >
      {posterFailed ? (
        // The poster is a derived Cloudinary asset; if it 404s (very large
        // source, transcode still catching up) fall back to a plain backdrop
        // rather than a broken-image icon.
        <div className="w-full aspect-video" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={videoPosterUrl(url)}
          alt=""
          className="max-h-[520px] w-auto max-w-full h-auto object-contain"
          draggable={false}
          onError={() => setPosterFailed(true)}
        />
      )}
      <span className="absolute inset-0 bg-black/10 group-hover/vid:bg-black/25 transition-colors" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="bg-black/60 backdrop-blur-sm rounded-full p-4 group-hover/vid:scale-105 transition-transform">
          <Play className="w-6 h-6 text-white fill-white" />
        </span>
      </span>
    </button>
  );
}
