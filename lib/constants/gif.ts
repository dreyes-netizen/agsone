/**
 * External GIF-comment provider allowlist. GIPHY is the only supported
 * provider today (Tenor's public API was fully discontinued by Google in
 * 2026) — kept as an array/enum rather than a literal so a second provider
 * can be added later without touching the zod schema shape.
 */
export const GIF_PROVIDERS = ["giphy"] as const;
export type GifProvider = (typeof GIF_PROVIDERS)[number];

// GIPHY ids are short alphanumeric strings. This is a format guard against a
// client submitting something that isn't a plausible provider id — it does
// not confirm the id actually exists on GIPHY (rendering resolves that live).
export const GIF_ID_PATTERN = /^[a-zA-Z0-9]{1,64}$/;
