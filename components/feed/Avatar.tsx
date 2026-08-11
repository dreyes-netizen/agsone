"use client";

import { useState } from "react";

export function Avatar({ name, url, size = "sm" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const [errored, setErrored] = useState(false);
  const dim = size === "md" ? "w-12 h-12 text-lg" : "w-10 h-10 text-base";
  if (url && !errored) return <img src={url} alt={name} className={`${dim} rounded-full object-cover shrink-0`} onError={() => setErrored(true)} />;
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
