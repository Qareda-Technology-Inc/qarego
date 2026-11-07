// Email through any SMTP server (e.g. Gmail with an app password, Zoho, Brevo).
// Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and optionally EMAIL_FROM. Without them,
// emails are skipped and logged, like SMS in development.
import nodemailer from "nodemailer";

let transporter = null;

export function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is SSL from the start; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
  });
  return transporter;
}

/** Send one email. Never throws: returns { success, error? } so callers can log and move on. */
export async function sendEmail({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { success: false, error: "no recipients" };
  if (!isEmailConfigured()) {
    console.log(`[email] not configured, skipped "${subject}" → ${recipients.join(", ")}`);
    return { success: false, error: "email not configured" };
  }
  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `QareGO <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject,
      text,
      ...(html ? { html } : {}),
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[email] send failed "${subject}":`, err?.message || err);
    return { success: false, error: err?.message || "send failed" };
  }
}
