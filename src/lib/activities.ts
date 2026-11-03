import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityType } from "@/lib/types";

export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  leadId: string | null,
  type: ActivityType,
  description: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("activities").insert({
    user_id: userId,
    lead_id: leadId,
    type,
    description,
    metadata,
  });
  return error;
}
