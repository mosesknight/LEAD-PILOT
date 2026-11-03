import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Activity,
  Lead,
  LeadInput,
  LeadStage,
  Pitch,
  UserSettingsInput,
  UserSettingsStatus,
} from "@/lib/types";
import { normalizeWebsite, startOfToday } from "@/lib/format";

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("No data returned.");
  return data;
}

export async function fetchUserSettingsStatus(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, email_from, gemini_configured, resend_configured, updated_at")
    .eq("user_id", userId)
    .maybeSingle<UserSettingsStatus>();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  input: UserSettingsInput,
) {
  const row: Record<string, string | null> = { user_id: userId };

  if (input.gemini_api_key !== undefined) {
    row.gemini_api_key = input.gemini_api_key?.trim() || null;
  }
  if (input.resend_api_key !== undefined) {
    row.resend_api_key = input.resend_api_key?.trim() || null;
  }
  if (input.email_from !== undefined) {
    row.email_from = input.email_from?.trim() || null;
  }

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(row, { onConflict: "user_id" })
    .select("user_id, email_from, gemini_configured, resend_configured, updated_at")
    .single<UserSettingsStatus>();

  return unwrap(data, error);
}

export async function fetchLeads(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

export async function fetchTodayLeadCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday().toISOString());

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchLeadActivities(supabase: SupabaseClient, leadId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Activity[];
}

export async function fetchRecentActivities(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
) {
  const { data, error } = await supabase
    .from("activities")
    .select("*, leads(id, business_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Activity[];
}

function toRow(input: LeadInput) {
  return {
    business_name: input.business_name.trim(),
    niche: input.niche?.trim() || null,
    website: normalizeWebsite(input.website),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    high_ticket: Boolean(input.high_ticket),
    deal_value: input.deal_value ?? null,
  };
}

export async function createLead(
  supabase: SupabaseClient,
  userId: string,
  input: LeadInput,
) {
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...toRow(input), user_id: userId })
    .select("*")
    .single();

  return unwrap(data as Lead | null, error);
}

export async function createManyLeads(
  supabase: SupabaseClient,
  userId: string,
  inputs: LeadInput[],
) {
  const rows = inputs.map((input) => ({ ...toRow(input), user_id: userId }));

  const { data, error } = await supabase.from("leads").insert(rows).select("*");
  return unwrap(data as Lead[] | null, error);
}

export async function updateLead(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  patch: Partial<Lead>,
) {
  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  return unwrap(data as Lead | null, error);
}

export async function updatePitch(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  pitch: Pitch,
) {
  return updateLead(supabase, userId, leadId, {
    problem: pitch.identifiedProblem,
    opportunity: pitch.opportunity,
    email_subject: pitch.emailSubject,
    email_body: pitch.emailBody,
    whatsapp_message: pitch.whatsappText,
  });
}

export async function deleteLead(supabase: SupabaseClient, userId: string, leadId: string) {
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function moveLeadStage(
  supabase: SupabaseClient,
  userId: string,
  lead: Lead,
  stage: LeadStage,
) {
  if (lead.stage === stage) return lead;

  const updated = await updateLead(supabase, userId, lead.id, { stage });

  await supabase.from("activities").insert({
    user_id: userId,
    lead_id: lead.id,
    type: "stage_change",
    description: `${lead.business_name} moved to ${stage.replaceAll("_", " ")}`,
    metadata: { from: lead.stage, to: stage },
  });

  return updated;
}

export async function logNote(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  note: string,
) {
  const { error } = await supabase.from("activities").insert({
    user_id: userId,
    lead_id: leadId,
    type: "note_added",
    description: note,
  });
  if (error) throw new Error(error.message);
}
