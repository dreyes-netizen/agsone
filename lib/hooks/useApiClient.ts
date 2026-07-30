"use client";

import { auth } from "@/lib/firebase/client";

// Plain (non-hook) versions of the fetch wrappers below. Extracted so
// call sites that aren't React components — e.g. a zustand store shared
// across multiple mounted components — can issue authenticated requests
// without going through the `useApiClient()` hook. `useApiClient()` itself
// is unchanged for the ~30 components that already call it.

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  await auth.authStateReady();

  async function doFetch(forceRefresh = false) {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    const isFormData = options.body instanceof FormData;
    return fetch(url, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token ?? ""}`,
        ...options.headers,
      },
    });
  }

  let res = await doFetch();

  // On 401, force a token refresh and retry once
  if (res.status === 401) {
    res = await doFetch(true); // retry with fresh token
    if (res.status === 401) {
      // Only sign out if Firebase itself has no session; otherwise this is a
      // transient/endpoint error — surface it without logging the user out app-wide.
      if (!auth.currentUser) {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
        throw new Error("Session expired. Please sign in again.");
      }
      throw new Error("Request failed (401). Please try again.");
    }
  }

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

export async function streamFetch(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  await auth.authStateReady();

  async function doFetch(forceRefresh = false) {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    return fetch(url, {
      ...options,
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
        ...options.headers,
      },
    });
  }

  let res = await doFetch();

  // On 401, force a token refresh and retry once
  if (res.status === 401) {
    res = await doFetch(true); // retry with fresh token
    if (res.status === 401) {
      // Only sign out if Firebase itself has no session; otherwise this is a
      // transient/endpoint error — surface it without logging the user out app-wide.
      if (!auth.currentUser) {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
        throw new Error("Session expired. Please sign in again.");
      }
      throw new Error("Request failed (401). Please try again.");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    const msg = typeof err.error === "string"
      ? err.error
      : err.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return res;
}

export function useApiClient() {
  return { apiFetch, streamFetch };
}
