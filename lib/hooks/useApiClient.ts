"use client";

import { auth } from "@/lib/firebase/client";

export function useApiClient() {
  async function apiFetch<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Always get a fresh token — avoids stale/null token on first mount
    const token = await auth.currentUser?.getIdToken();

    const isFormData = options.body instanceof FormData;
    const res = await fetch(url, {
      ...options,
      headers: {
        // Let the browser set Content-Type automatically for FormData (includes boundary)
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token ?? ""}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      const msg = typeof err.error === "string"
        ? err.error
        : err.message ?? `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return res.json();
  }

  return { apiFetch };
}
