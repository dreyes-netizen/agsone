"use client";

import { useState } from "react";
import Image from "next/image";
import { Pill } from "lucide-react";

interface MedicineImageProps {
  src: string | undefined;
  alt: string;
  sizes: string;
  className?: string;
  showFallbackLabel?: boolean;
}

// The single place a medicine's photo gets rendered — grid card and detail
// dialog. Deliberately flatter than Food/Marketplace's colorful gradient
// fallback: a plain neutral background and muted icon, since a company
// medicine cabinet shouldn't read as a colorful storefront. Loading/error
// states are handled with a sibling overlay/fallback instead of dimming the
// image itself, so the photo always renders at full, true color.
export function MedicineImage({ src, alt, sizes, className = "", showFallbackLabel = false }: MedicineImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || errored) {
    return (
      <div className={`relative flex flex-col items-center justify-center gap-1.5 bg-gray-50 ${className}`}>
        <Pill className="w-8 h-8 text-gray-300" aria-hidden="true" />
        {showFallbackLabel ? (
          <span className="text-[11px] text-gray-400">No image available</span>
        ) : (
          <span className="sr-only">No image available</span>
        )}
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
        className="object-contain p-2"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
