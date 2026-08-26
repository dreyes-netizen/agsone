"use client";

import { useState } from "react";

/**
 * The circular player avatar used by every leaderboard in the app.
 *
 * Deliberately a plain `<img>` with an `onError` fallback rather than the
 * shadcn/Radix `ui/avatar` primitive: Cloudinary URLs on deactivated or
 * re-uploaded profiles 404 fairly often, and the initial-in-a-gradient-circle
 * fallback below is the look every board already shipped with. This file is the
 * single copy — `minigames/stats`, the solo panel, and the points leaderboard
 * all render through it so they can't drift apart again.
 */
export function UserAvatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [errored, setErrored] = useState(false);
  const cls =
    size === "lg"
      ? "w-16 h-16 text-2xl"
      : size === "sm"
        ? "w-9 h-9 text-xs"
        : "w-11 h-11 text-sm";

  if (url && !errored) {
    return (
      <img
        src={url}
        alt={name}
        className={`${cls} rounded-full object-cover shrink-0`}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white font-bold shrink-0`}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
