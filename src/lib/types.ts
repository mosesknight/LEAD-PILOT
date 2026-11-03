export const LEAD_STAGES = [
  "discovered",
  "email_pitched",
  "whatsapp_pitched",
  "follow_up",
  "proposal_sent",
  "closed_won",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export interface Lead {
  id: string;
  user_id: string;
  business_name: string;
  niche: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  notes: string | null;
  stage: LeadStage;
  high_ticket: boolean;
  deal_value: number | null;
  problem: string | null;
  opportunity: string | null;
  email_subject: string | null;
  email_body: string | null;
  whatsapp_message: string | null;
  ai_generated_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityType =
  | "lead_created"
  | "lead_imported"
  | "ai_audit"
  | "email_sent"
  | "whatsapp_opened"
  | "stage_change"
  | "pitch_saved"
  | "note_added"
  | "proposal_sent"
  | "deal_won";

export interface Activity {
  id: string;
  user_id: string;
  lead_id: string | null;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  leads?: Pick<Lead, "id" | "business_name"> | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  sender_title: string | null;
  default_niche: string | null;
  daily_quota: number;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: string;
  gemini_api_key: string | null;
  resend_api_key: string | null;
  email_from: string | null;
  gemini_configured: boolean;
  resend_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsStatus {
  user_id: string;
  email_from: string | null;
  gemini_configured: boolean;
  resend_configured: boolean;
  updated_at: string;
}

export interface UserSettingsInput {
  gemini_api_key?: string | null;
  resend_api_key?: string | null;
  email_from?: string | null;
}

export interface Pitch {
  identifiedProblem: string;
  opportunity: string;
  emailSubject: string;
  emailBody: string;
  whatsappText: string;
}

export interface LeadInput {
  business_name: string;
  niche?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  notes?: string | null;
  high_ticket?: boolean;
  deal_value?: number | null;
}

export interface DiscoveryCriteria {
  niche: string;
  location: string;
  count: number;
  prompt: string;
}

export interface DiscoveredLead {
  business_name: string;
  niche: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  notes: string | null;
  source: string | null;
}
