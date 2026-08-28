import { findHrRequestType } from "@/lib/constants/hrRequests";

/**
 * Keeps a half-filled HR request across a refresh. An SSS loan query or a COE
 * with several fields takes real effort to fill in, and losing it to a stray
 * reload is the kind of thing that sends people back to writing a bare email.
 *
 * Every read and write is wrapped: `localStorage` throws outright in Safari
 * private mode and on quota, and a crashed HR page is a far worse outcome than
 * a lost draft.
 */

const KEY = "ags-one:hr-request-draft:v1";

/** Beyond this, a restored draft is more likely to confuse than to help. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type HrRequestDraft = {
  categoryId: string;
  typeId: string;
  values: Record<string, string>;
  notes: string;
  savedAt: number;
};

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

export function loadDraft(now: number = Date.now()): HrRequestDraft | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { categoryId, typeId, values, notes, savedAt } = parsed as Partial<HrRequestDraft>;
    if (typeof categoryId !== "string" || typeof typeId !== "string") return null;
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
    if (!isRecordOfStrings(values)) return null;
    if (now - savedAt > MAX_AGE_MS) return null;

    // A draft whose type was retired from the catalog would restore into a form
    // that can't render or submit it, so treat it as absent.
    if (!findHrRequestType(typeId)) return null;

    return { categoryId, typeId, values, notes: typeof notes === "string" ? notes : "", savedAt };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<HrRequestDraft, "savedAt">, now: number = Date.now()): void {
  // Nothing filled in yet: writing an empty draft would only produce a
  // "Draft restored" bar that restores nothing.
  const hasContent =
    Boolean(draft.typeId) &&
    (Object.values(draft.values).some((v) => v.trim()) || draft.notes.trim().length > 0);
  if (!hasContent) return;

  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: now }));
  } catch {
    // Quota exceeded or storage disabled — the form keeps working regardless.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the draft simply expires on its own.
  }
}
