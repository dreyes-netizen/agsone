"use client";

import { auth } from "@/lib/firebase/client";

export function useApiClient() {
  async function apiFetch<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    await auth.authStateReady();
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

    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  async function streamFetch(url: string, options: RequestInit = {}): Promise<Response> {
    await auth.authStateReady();
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
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
    return res;
  }

  return { apiFetch, streamFetch };
}
