const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — these get read aloud to HR

/**
 * A short traceability code minted on the client, before the Gmail window
 * opens, so the drafted email and the stored row share one reference without
 * the form having to await the server first (an `await` before `window.open`
 * forfeits the user gesture and the popup is blocked).
 *
 * Doubles as the idempotency key: the unique constraint on HrRequest.clientRef
 * turns a double-click or a retry into the same row rather than two tickets.
 */
export function newClientRef(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `HRQ-${out}`;
}
