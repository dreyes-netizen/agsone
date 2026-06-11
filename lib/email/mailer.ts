import nodemailer from "nodemailer";

function createTransport() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST ?? "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

type SendMailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: SendMailParams) {
  const transport = createTransport();
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
