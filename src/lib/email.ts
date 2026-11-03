import nodemailer from "nodemailer";
import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  businessName?: string;
  niche?: string | null;
  location?: string | null;
  replyTo?: string | null;
}

export interface EmailProviderStatus {
  resend: boolean;
  smtp: boolean;
  from: string | null;
}

export interface EmailOverrides {
  resendApiKey?: string | null;
  from?: string | null;
}

export function getEmailProviderStatus(overrides: EmailOverrides = {}): EmailProviderStatus {
  const resendKey = overrides.resendApiKey?.trim() || process.env.RESEND_API_KEY;
  const resend = Boolean(resendKey);
  const smtp = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  const from =
    overrides.from?.trim() ||
    process.env.EMAIL_FROM ||
    (resend ? "LeadPilot <onboarding@resend.dev>" : null);
  return { resend, smtp, from };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export async function sendOutreachEmail(input: SendEmailInput, overrides: EmailOverrides = {}) {
  const status = getEmailProviderStatus(overrides);
  if (!status.from) {
    throw new Error(
      "No email provider configured. Add your Resend key in Settings → API keys, or configure a workspace provider.",
    );
  }

  const footer = `You're receiving this because I came across ${input.businessName ?? "your business"}${
    input.niche ? ` while looking at ${input.niche.toLowerCase()} businesses` : ""
  }${input.location ? ` in ${input.location}` : ""}. Reply "no" and I won't follow up.`;

  const html = `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#18181b;max-width:560px">${textToHtml(
    input.text,
  )}<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 12px" /><p style="font-size:11px;line-height:1.5;color:#a1a1aa;margin:0">${escapeHtml(
    footer,
  )}</p></div>`;

  const plain = `${input.text}\n\n---\n${footer}`;

  if (status.resend) {
    const resendKey = overrides.resendApiKey?.trim() || process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error("Resend API key is missing.");
    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: status.from,
      to: [input.to],
      subject: input.subject,
      text: plain,
      html,
      replyTo: input.replyTo ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { provider: "resend" as const, id: data?.id ?? null };
  }

  if (status.smtp) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    const info = await transporter.sendMail({
      from: status.from,
      to: input.to,
      subject: input.subject,
      text: plain,
      html,
      replyTo: input.replyTo ?? undefined,
    });
    return { provider: "smtp" as const, id: info.messageId ?? null };
  }

  throw new Error("No email provider configured.");
}
