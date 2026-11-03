import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activities";
import { generatePitch } from "@/lib/gemini";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Lead, Profile } from "@/lib/types";
import {
  fetchUserSecrets,
  resolveGeminiCredentials,
} from "@/lib/user-integrations";
import { auditWebsite } from "@/lib/website-audit";

export const maxDuration = 60;

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
  const gemini = resolveGeminiCredentials(secrets);
  if (!gemini.apiKey) {
    return NextResponse.json(
      {
        error:
          "No Gemini API key is available. Add your free key in Settings → API keys to generate pitches.",
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  try {
    const audit = await auditWebsite(lead.website);
    const pitch = await generatePitch(lead, profile ?? null, audit, {
      apiKey: gemini.apiKey,
      model: gemini.model,
    });

    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update({
        problem: pitch.identifiedProblem,
        opportunity: pitch.opportunity,
        email_subject: pitch.emailSubject,
        email_body: pitch.emailBody,
        whatsapp_message: pitch.whatsappText,
        ai_generated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .eq("user_id", user.id)
      .select("*")
      .single<Lead>();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "The pitch was generated but could not be saved. Try again." },
        { status: 500 },
      );
    }

    await logActivity(
      supabase,
      user.id,
      lead.id,
      "ai_audit",
      `AI audit generated for ${lead.business_name}`,
      {
        reachable: audit.reachable,
        signals: audit.signals,
      },
    );

    return NextResponse.json({
      lead: updated,
      pitch,
      audit: {
        reachable: audit.reachable,
        signals: audit.signals,
        notes: audit.notes,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pitch generation failed. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
