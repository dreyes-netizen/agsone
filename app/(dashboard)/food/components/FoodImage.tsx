"use client";

import { useState } from "react";
import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";

interface FoodImageProps {
  src: string | undefined;
  alt: string;
  sizes: string;
  className?: string;
}

// The single place a food listing's photo gets rendered — grid card, detail
// dialog, and anywhere else a listing image is needed. Availability/hover/
// focus states must never dim this component's <img> itself (only text/
// badges should communicate state) — loading and error states are handled
// via a sibling overlay/fallback instead, so the photo always renders at
// full, true color. Unlike the marketplace's RewardImage (object-contain,
// since product photos crop awkwardly), food photos are cropped to fill the
// frame with object-cover per the Food Board design spec.
export function FoodImage({ src, alt, sizes, className = "" }: FoodImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || errored) {
    return (
      <div className={`relative flex items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-500 ${className}`}>
        <UtensilsCrossed className="w-10 h-10 text-white/70" aria-hidden="true" />
        {errored && <span className="sr-only">Image unavailable</span>}
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-50 ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gray-100" aria-hidden="true" />}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading="lazy"
        className="object-cover"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
