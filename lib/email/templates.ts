const APP_NAME = "AGS One";
const BRAND_COLOR = "#4f46e5"; // indigo-600

function layout(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:20px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <img src="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/agslogo.png" alt="${APP_NAME}" width="36" height="36"
                       style="display:block;border-radius:6px;background:#ffffff;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#ffffff;font-size:18px;font-weight:700;line-height:1;">${APP_NAME}</span><br/>
                  <span style="color:rgba(255,255,255,0.7);font-size:11px;">Alliance Global Solutions</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              This is an automated message from ${APP_NAME}. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function welcomeEmail(displayName: string) {
  return {
    subject: `Welcome to ${APP_NAME}! 🎮`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Welcome, ${displayName}! 👋</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">
        You've been added to <strong>${APP_NAME}</strong> — your company's rewards and recognition platform.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">
        Here's what you can do:
      </p>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;color:#4b5563;line-height:2;">
        <li>Earn points for attendance, performance, and recognition</li>
        <li>Redeem points in the rewards marketplace</li>
        <li>Climb the leaderboard and track your progress</li>
        <li>Celebrate your colleagues in the activity feed</li>
      </ul>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/dashboard"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        Go to Dashboard →
      </a>
    `),
  };
}

export function pointsReceivedEmail(displayName: string, amount: number, fromName: string, note: string, newBalance: number) {
  return {
    subject: `You received ${amount.toLocaleString()} points! 🎉`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">You've earned points! 🎉</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Hi ${displayName},</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
        <span style="font-size:40px;font-weight:800;color:#16a34a;">+${amount.toLocaleString()}</span>
        <p style="margin:4px 0 0;font-size:14px;color:#15803d;">points received</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:13px;color:#9ca3af;">From</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
            <span style="font-size:13px;color:#111827;font-weight:500;">${fromName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:13px;color:#9ca3af;">Note</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
            <span style="font-size:13px;color:#111827;">${note}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;">
            <span style="font-size:13px;color:#9ca3af;">New Balance</span>
          </td>
          <td style="padding:10px 0;text-align:right;">
            <span style="font-size:14px;color:${BRAND_COLOR};font-weight:700;">${newBalance.toLocaleString()} pts</span>
          </td>
        </tr>
      </table>

      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/marketplace"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        Browse the Marketplace →
      </a>
    `),
  };
}

export function redemptionStatusEmail(
  displayName: string,
  rewardName: string,
  status: "APPROVED" | "REJECTED" | "FULFILLED",
  adminNote?: string | null,
  pointsRefunded?: number,
) {
  const configs = {
    APPROVED: {
      subject: `Your redemption was approved! ✅`,
      icon: "✅",
      heading: "Redemption Approved!",
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      message: `Great news! Your redemption for <strong>${rewardName}</strong> has been approved. HR will be in touch to arrange delivery.`,
    },
    REJECTED: {
      subject: `Redemption update for ${rewardName}`,
      icon: "❌",
      heading: "Redemption Rejected",
      color: "#dc2626",
      bg: "#fef2f2",
      border: "#fecaca",
      message: `Your redemption for <strong>${rewardName}</strong> was not approved.${pointsRefunded ? ` <strong>${pointsRefunded.toLocaleString()} points</strong> have been refunded to your balance.` : ""}`,
    },
    FULFILLED: {
      subject: `Your reward has been delivered! 📦`,
      icon: "📦",
      heading: "Reward Delivered!",
      color: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
      message: `Your <strong>${rewardName}</strong> has been delivered. We hope you enjoy it!`,
    },
  };

  const c = configs[status];

  return {
    subject: c.subject,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">${c.icon} ${c.heading}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Hi ${displayName},</p>

      <div style="background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:${c.color};line-height:1.6;">${c.message}</p>
      </div>

      ${adminNote ? `
      <div style="background:#f9fafb;border-left:4px solid #e5e7eb;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">Note from HR: ${adminNote}</p>
      </div>` : ""}

      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/marketplace"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        View Marketplace →
      </a>
    `),
  };
}

const categoryLabel: Record<string, string> = {
  COMPENSATION_BENEFITS: "Compensation & Benefits",
  WORK_LIFE_BALANCE:     "Work-Life Balance",
  COMPANY_CULTURE:       "Company Culture",
  TEAM_DYNAMICS:         "Team Dynamics",
  PROCESSES_TOOLS:       "Processes & Tools",
  RECOGNITION:           "Recognition",
  OTHER:                 "Other",
};

export function newFeedbackEmail(
  category: string,
  title: string,
  body: string,
  isAnonymous: boolean,
  submitterName: string | null,
) {
  const catLabel = categoryLabel[category] ?? category;
  const fromLine = isAnonymous
    ? `<span style="font-size:13px;color:#6b7280;font-style:italic;">Anonymous submission</span>`
    : `<span style="font-size:13px;color:#111827;font-weight:500;">${submitterName ?? "Unknown"}</span>`;

  return {
    subject: `New Feedback: ${title}`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">📬 New Employee Feedback</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A new feedback submission has been received on AGS One.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 16px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;width:120px;">Category</td>
          <td style="padding:10px 16px;font-size:13px;color:#111827;">${catLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">From</td>
          <td style="padding:10px 16px;border-top:1px solid #e5e7eb;">${fromLine}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 16px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #e5e7eb;">Title</td>
          <td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-top:1px solid #e5e7eb;">${title}</td>
        </tr>
      </table>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${body}</p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/admin/feedback"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        View in Admin Panel →
      </a>
    `),
  };
}

export function notificationEmail(displayName: string, title: string, body: string) {
  return {
    subject: title,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">${title}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Hi ${displayName},</p>
      <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.6;">${body}</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/dashboard"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        Go to Dashboard →
      </a>
    `),
  };
}
