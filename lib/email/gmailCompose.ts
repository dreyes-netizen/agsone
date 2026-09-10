// Builds a Gmail web-compose URL instead of a `mailto:` link. AGS doesn't use
// Outlook, so `mailto:` would hand off to whatever default mail client is
// registered on the device (often nothing, or Outlook) rather than Gmail.
// This opens Gmail's own compose window directly, pre-filled — the employee
// still reviews and clicks send themselves, nothing is sent on their behalf.
export function buildGmailComposeUrl({
  to,
  cc,
  subject,
  body,
}: {
  to: string;
  cc?: string;
  subject?: string;
  body?: string;
}): string {
  const params = new URLSearchParams({ view: "cm", fs: "1", to });
  if (cc) params.set("cc", cc);
  if (subject) params.set("su", subject);
  if (body) params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
