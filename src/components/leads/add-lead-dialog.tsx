"use client";

import * as React from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLead } from "@/lib/data";
import { notifyLeadsChanged } from "@/lib/events";
import { NICHES } from "@/lib/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";

const emptyForm = {
  business_name: "",
  niche: "",
  website: "",
  email: "",
  phone: "",
  location: "",
  notes: "",
  high_ticket: false,
  deal_value: "",
};

export function AddLeadDialog({
  open,
  onOpenChange,
  onCreated,
  todayCount,
  quota,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lead: Lead) => void;
  todayCount: number;
  quota: number;
}) {
  const { user } = useAuth();
  const [form, setForm] = React.useState(emptyForm);
  const [pending, setPending] = React.useState(false);

  const remaining = Math.max(0, quota - todayCount);

  function handleOpenChange(next: boolean) {
    if (!next) setForm(emptyForm);
    onOpenChange(next);
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.business_name.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (todayCount >= quota) {
      toast.error(`Daily quota reached (${quota}). Raise it in Settings or continue tomorrow.`);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) {
      toast.error("You need to be signed in.");
      return;
    }

    setPending(true);
    try {
      const lead = await createLead(supabase, user.id, {
        business_name: form.business_name,
        niche: form.niche || null,
        website: form.website || null,
        email: form.email || null,
        phone: form.phone || null,
        location: form.location || null,
        notes: form.notes || null,
        high_ticket: form.high_ticket,
        deal_value: form.deal_value ? Number(form.deal_value) : null,
      });

      await supabase.from("activities").insert({
        user_id: user.id,
        lead_id: lead.id,
        type: "lead_created",
        description: `${lead.business_name} added to the pipeline`,
        metadata: { niche: lead.niche, high_ticket: lead.high_ticket },
      });

      onCreated(lead);
      notifyLeadsChanged();
      toast.success(`${lead.business_name} added.`);
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the lead.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>
            {remaining > 0
              ? `${remaining} of ${quota} slots left today. Add the details you have — the AI audit fills in the angle.`
              : "You've hit today's quota. You can still update existing leads."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="business_name">
                Business name <span className="text-primary">*</span>
              </Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(event) => update("business_name", event.target.value)}
                placeholder="Bright Smile Dental"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="niche">Niche</Label>
              <Input
                id="niche"
                list="niche-options"
                value={form.niche}
                onChange={(event) => update("niche", event.target.value)}
                placeholder="Dental Clinic"
              />
              <datalist id="niche-options">
                {NICHES.map((niche) => (
                  <option key={niche} value={niche} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="Austin, TX"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
                placeholder="brightsmile.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="hello@brightsmile.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone / WhatsApp</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal_value">Potential deal value (USD)</Label>
              <Input
                id="deal_value"
                type="number"
                min="0"
                step="100"
                value={form.deal_value}
                onChange={(event) => update("deal_value", event.target.value)}
                placeholder="4500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="No online booking visible. Runs promos through Instagram DMs."
                rows={3}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => update("high_ticket", !form.high_ticket)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              form.high_ticket
                ? "border-orange-400/30 bg-orange-400/[0.06]"
                : "border-border bg-card/40 hover:border-border/80",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-4 items-center justify-center rounded border",
                form.high_ticket
                  ? "border-orange-400 bg-orange-400 text-orange-950"
                  : "border-border bg-transparent",
              )}
            >
              {form.high_ticket ? <Sparkles className="size-3" /> : null}
            </span>
            <span className="space-y-0.5">
              <span className="block text-xs font-medium text-foreground">
                Flag as high-ticket
              </span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">
                Enables the 1-click WhatsApp deep link and a manual, high-touch outreach badge.
              </span>
            </span>
          </button>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || todayCount >= quota}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
