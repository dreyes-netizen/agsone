"use client";

import { useEffect, useState } from "react";

/** Debounces a fast-changing value (e.g. search-as-you-type input) so
 * dependent effects only fire once typing pauses. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
