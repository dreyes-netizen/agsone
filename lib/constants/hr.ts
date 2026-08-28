// HR inbox used by the Email HR feature and Points of Contact fallback.
export const HR_EMAIL = "hr@allianceglobalsolutions.com";

// The request catalog that replaced the old flat COMMON_HR_REQUESTS subject
// presets lives in lib/constants/hrRequests.ts — those six strings only ever
// set a subject line, so HR had to ask for the details on every request.

// Static distribution list used for HR-bound notification emails. Kept as a
// belt-and-braces channel alongside in-app notifyRole delivery: it does not
// track who currently holds HR_ADMIN, so it must never be the only path.
export const HR_NOTIFICATION_EMAILS = [
  "hr.ags@allianceglobalsolutions.com",
  HR_EMAIL,
] as const;

/** The same list as a `to:` header value. */
export const HR_EMAILS_HEADER = HR_NOTIFICATION_EMAILS.join(", ");
