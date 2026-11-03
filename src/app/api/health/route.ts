import { connection } from "next/server";

export async function GET() {
  await connection();

  return Response.json({
    supabase: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    smtp: Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    ),
    emailFrom: Boolean(process.env.EMAIL_FROM),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  });
}
