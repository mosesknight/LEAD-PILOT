import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activities";
import { getEmailProviderStatus, sendOutreachEmail } from "@/lib/email";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead, Profile } from "@/lib/types";
import {
  fetchUserSecrets,
  resolveEmailCredentials,
} from "@/lib/user-integrations";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Add your keys to .env.local." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: { leadId?: string };
  try {
    body = (await request.json()) as { leadId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const secrets = await fetchUserSecrets(supabase, user.id);
  const email = resolveEmailCredentials(secrets);
  const provider = getEmailProviderStatus({
    resendApiKey: email.resendApiKey,
    from: email.from,
  });
  if (!provider.from) {
    return NextResponse.json(
      {
        error:
          "No email provider is available. Add your Resend key and sender email in Settings → API keys.",
      },
      { status: 503 },
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", body.leadId)
    .eq("user_id", user.id)
    .maybeSingle<Lead>();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json(
      { error: "This lead has no email address. Add one first." },
      { status: 400 },
    );
  }

  if (!lead.email_subject || !lead.email_body) {
    return NextResponse.json(
      { error: "Generate an AI pitch for this lead before sending." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  try {
    const result = await sendOutreachEmail(
      {
        to: lead.email,
        subject: lead.email_subject,
        text: lead.email_body,
        businessName: lead.business_name,
        niche: lead.niche,
        location: lead.location,
        replyTo: process.env.EMAIL_REPLY_TO || user.email || null,
      },
      { resendApiKey: email.resendApiKey, from: email.from },
    );

    const now = new Date().toISOString();
    const nextStage = lead.stage === "discovered" ? "email_pitched" : lead.stage;

    const { data: updated } = await supabase
      .from("leads")
      .update({
        stage: nextStage,
        last_contacted_at: now,
      })
      .eq("id", lead.id)
      .eq("user_id", user.id)
      .select("*")
      .single<Lead>();

    await logActivity(
      supabase,
      user.id,
      lead.id,
      "email_sent",
      `Cold email sent to ${lead.business_name} (${lead.email})`,
      {
        provider: result.provider,
        messageId: result.id,
        subject: lead.email_subject,
        sender: profile?.full_name ?? null,
      },
    );

    if (nextStage !== lead.stage) {
      await logActivity(
        supabase,
        user.id,
        lead.id,
        "stage_change",
        `${lead.business_name} moved to Email Pitched`,
        { from: lead.stage, to: nextStage },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      lead: updated ?? lead,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The email could not be sent.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
