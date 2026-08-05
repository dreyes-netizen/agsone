import nodemailer, { Transporter } from "nodemailer";

// Built once and reused across calls (and, under Fluid Compute, across
// invocations in the same warm instance) instead of opening a fresh SMTP
// connection per email — call sites fire one sendMail() per recipient in a
// loop (e.g. attendance award), so per-call transports meant N sequential
// TCP+TLS handshakes for one bulk operation. `pool: true` keeps a small set
// of connections open and reuses them; the timeouts bound a stalled SMTP
// handshake instead of leaving it to hang indefinitely.
const globalForMailer = globalThis as unknown as { mailTransport?: Transporter | null };

function getTransport() {
  if (globalForMailer.mailTransport !== undefined) return globalForMailer.mailTransport;

  const transport = (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)
    ? null
    : nodemailer.createTransport({
        host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
        port: Number(process.env.EMAIL_PORT ?? 587),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 10_000,
        socketTimeout: 10_000,
      });

  globalForMailer.mailTransport = transport;
  return transport;
}

type SendMailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: SendMailParams) {
  const transport = getTransport();
  if (!transport) {
    // Email not configured — log and skip silently (to address omitted to avoid logging PII)
    console.log('[email skipped — not configured]', { subject });
    return;
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
}
