"use client";

import * as React from "react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { moveLeadStage } from "@/lib/data";
import { notifyLeadsChanged } from "@/lib/events";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";
import { buildWhatsAppLink } from "@/lib/whatsapp";

interface PitchResponse {
  lead: Lead;
}

interface EmailResponse {
  lead: Lead;
  provider: "resend" | "smtp";
}

export function useLeadActions(onUpdated?: (lead: Lead) => void) {
  const { user } = useAuth();
  const [generating, setGenerating] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState<string | null>(null);

  const generate = React.useCallback(
    async (lead: Lead) => {
      if (generating) return null;
      setGenerating(lead.id);
      const toastId = toast.loading(`Auditing ${lead.business_name}…`);
      try {
        const result = await apiPost<PitchResponse>("/api/generate-pitch", {
          leadId: lead.id,
        });
        onUpdated?.(result.lead);
        notifyLeadsChanged();
        toast.success("Pitch ready.", { id: toastId });
        return result.lead;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Pitch generation failed.", {
          id: toastId,
        });
        return null;
      } finally {
        setGenerating(null);
      }
    },
    [generating, onUpdated],
  );

  const sendEmail = React.useCallback(
    async (lead: Lead) => {
      if (sending) return null;
      if (!lead.email) {
        toast.error("This lead has no email address.");
        return null;
      }
      if (!lead.email_subject || !lead.email_body) {
        toast.error("Generate an AI pitch before sending.");
        return null;
      }
      setSending(lead.id);
      const toastId = toast.loading(`Sending email to ${lead.business_name}…`);
      try {
        const result = await apiPost<EmailResponse>("/api/send-email", { leadId: lead.id });
        onUpdated?.(result.lead);
        notifyLeadsChanged();
        toast.success("Email sent.", { id: toastId });
        return result.lead;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Email failed.", { id: toastId });
        return null;
      } finally {
        setSending(null);
      }
    },
    [sending, onUpdated],
  );

  const openWhatsApp = React.useCallback(
    (lead: Lead) => {
      if (!lead.phone) {
        toast.error("This lead has no phone number.");
        return;
      }
      const message =
        lead.whatsapp_message ||
        `Hi ${lead.business_name}, I took a look at your site and had one quick idea that could help you win more customers. Worth a 10-minute chat this week?`;
      const link = buildWhatsAppLink(lead.phone, message);
      if (!link) {
        toast.error("That phone number doesn't look valid for WhatsApp.");
        return;
      }

      window.open(link, "_blank", "noopener,noreferrer");

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !user) return;

      void (async () => {
        try {
          let updated = lead;
          if (lead.stage === "discovered") {
            updated = await moveLeadStage(supabase, user.id, lead, "whatsapp_pitched");
          }
          await supabase.from("activities").insert({
            user_id: user.id,
            lead_id: lead.id,
            type: "whatsapp_opened",
            description: `WhatsApp chat opened for ${lead.business_name}`,
            metadata: { phone: lead.phone },
          });
          if (updated !== lead) onUpdated?.(updated);
          notifyLeadsChanged();
        } catch {
          toast.error("WhatsApp opened, but the stage update failed.");
        }
      })();
    },
    [onUpdated, user],
  );

  return {
    generate,
    sendEmail,
    openWhatsApp,
    generatingId: generating,
    sendingId: sending,
  };
}
