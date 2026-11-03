import type { SupabaseClient } from "@supabase/supabase-js";

interface UserSecrets {
  gemini_api_key: string | null;
  resend_api_key: string | null;
  email_from: string | null;
}

export interface GeminiCredentials {
  apiKey: string | null;
  model: string;
  source: "user" | "workspace" | null;
}

export interface EmailCredentials {
  resendApiKey: string | null;
  from: string | null;
  source: "user" | "workspace" | "smtp" | null;
}

/**
 * Server-only helper. Reads the signed-in user's BYOK secrets. Never import this
 * from a client component: the selected values must stay on the server.
 */
export async function fetchUserSecrets(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSecrets | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("gemini_api_key, resend_api_key, email_from")
    .eq("user_id", userId)
    .maybeSingle<UserSecrets>();

  if (error) return null;
  return data;
}

export function resolveGeminiCredentials(secrets: UserSecrets | null): GeminiCredentials {
  const userKey = secrets?.gemini_api_key?.trim() || null;
  const workspaceKey = process.env.GEMINI_API_KEY?.trim() || null;

  return {
    apiKey: userKey ?? workspaceKey,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    source: userKey ? "user" : workspaceKey ? "workspace" : null,
  };
}

export function resolveEmailCredentials(secrets: UserSecrets | null): EmailCredentials {
  const userKey = secrets?.resend_api_key?.trim() || null;
  const workspaceKey = process.env.RESEND_API_KEY?.trim() || null;
  const resendApiKey = userKey ?? workspaceKey;

  const userFrom = secrets?.email_from?.trim() || null;
  const workspaceFrom = process.env.EMAIL_FROM?.trim() || null;
  const from = userKey
    ? userFrom ?? "LeadPilot <onboarding@resend.dev>"
    : workspaceFrom ?? (workspaceKey ? "LeadPilot <onboarding@resend.dev>" : null);

  const smtp = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );

  return {
    resendApiKey,
    from,
    source: userKey ? "user" : workspaceKey ? "workspace" : smtp ? "smtp" : null,
  };
}
