import "server-only";

import { createHmac } from "node:crypto";

/**
 * Derive opaque channel names for confidentiality-sensitive invalidations.
 * The authorized API returns the relevant topic after its normal Firebase/
 * role checks; the HMAC key never reaches the browser.
 */
export function confidentialRealtimeTopic(scope: string, id = "global"): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "realtime-disabled";
  const digest = createHmac("sha256", key)
    .update(`${scope}:${id}`)
    .digest("base64url")
    .slice(0, 32);
  return `confidential:${digest}`;
}
