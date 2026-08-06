"use client";

import { useState } from "react";

export function PlayerAvatar({ name, url }: { name: string; url: string | null }) {
  const [errored, setErrored] = useState(false);
  if (url && !errored) {
    return <img src={url} alt={name} className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-md" onError={() => setErrored(true)} />;
  }
  return (
    <div className="w-24 h-24 rounded-full bg-navy-500 flex items-center justify-center text-white font-bold text-3xl ring-4 ring-white shadow-md">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
