"use client";

import { auth } from "@/lib/firebase/client";

// A route returning `{ error: parsed.error.flatten() }` on a zod validation
// failure (the convention across ~30 API routes' safeParse error branches)
// used to reach here as a non-string `error`, so the generic fallback below
// fired even though the server sent a specific, useful reason. This pulls
// that reason back out instead of discarding it.
type ZodFlattenedError = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };

function isZodFlattenedError(value: unknown): value is ZodFlattenedError {
  return typeof value === "object" && value !== null && ("formErrors" in value || "fieldErrors" in value);
}

export function extractErrorMessage(err: unknown, status: number): string {
  const parsed = err as { error?: unknown; message?: unknown };
  if (typeof parsed.error === "string") return parsed.error;
  if (isZodFlattenedError(parsed.error)) {
    const fieldMessage = Object.values(parsed.error.fieldErrors ?? {})
      .flat()
      .find((m): m is string => Boolean(m));
    if (fieldMessage) return fieldMessage;
    const formMessage = parsed.error.formErrors?.find((m) => Boolean(m));
    if (formMessage) return formMessage;
  }
  if (typeof parsed.message === "string") return parsed.message;
  return `Request failed (${status})`;
}

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
    throw new Error(extractErrorMessage(err, res.status));
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
    throw new Error(extractErrorMessage(err, res.status));
  }

  return res;
}

export function useApiClient() {
  return { apiFetch, streamFetch };
}
