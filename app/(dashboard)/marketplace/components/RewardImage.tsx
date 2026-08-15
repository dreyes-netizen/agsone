"use client";

import { useState } from "react";
import Image from "next/image";
import { REWARD_CATEGORY_CONFIG, type RewardCategory } from "@/lib/constants/rewardCategories";

interface RewardImageProps {
  src: string | undefined;
  alt: string;
  category: RewardCategory;
  sizes: string;
  className?: string;
}

// The single place a reward's photo gets rendered — grid card, detail dialog,
// and anywhere else a reward image is needed. Affordability, availability,
// hover, and focus states must never touch this component's opacity/filters:
// the previous bug was exactly that (a parent card's `opacity-70` "can't
// afford" treatment faded its child <img> along with it). Loading and error
// states are handled with a sibling overlay/fallback instead of dimming the
// image itself, so the photo always renders at full, true color.
export function RewardImage({ src, alt, category, sizes, className = "" }: RewardImageProps) {
  const [errored, setErrored] = useState(false);
  const cfg = REWARD_CATEGORY_CONFIG[category] ?? REWARD_CATEGORY_CONFIG.PHYSICAL;
  const [loaded, setLoaded] = useState(false);

  if (!src || errored) {
    return (
      <div className={`relative flex items-center justify-center bg-gradient-to-br ${cfg.accent} ${className}`}>
        <cfg.icon className="w-10 h-10 text-white/70" aria-hidden="true" />
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
        className="object-contain"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
