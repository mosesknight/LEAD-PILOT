"use client";

import * as React from "react";
import {
  Banknote,
  Bot,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  History,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useLeadActions } from "@/hooks/use-lead-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_META, STAGE_ORDER } from "@/lib/constants";
import { deleteLead, fetchLeadActivities, logNote, moveLeadStage, updateLead } from "@/lib/data";
import { notifyLeadsChanged } from "@/lib/events";
import { formatCurrency, formatDateTime, formatRelativeTime } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { Activity, ActivityType, Lead, LeadStage } from "@/lib/types";

const activityMeta: Record<
  ActivityType,
  { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }
> = {
  lead_created: { icon: UserRound, tone: "text-sky-300", label: "Lead created" },
  lead_imported: { icon: UserRound, tone: "text-sky-300", label: "Imported" },
  ai_audit: { icon: Bot, tone: "text-emerald-300", label: "AI audit" },
  email_sent: { icon: Mail, tone: "text-violet-300", label: "Email sent" },
  whatsapp_opened: { icon: MessageCircle, tone: "text-emerald-300", label: "WhatsApp" },
  stage_change: { icon: ChevronRight, tone: "text-amber-300", label: "Stage change" },
  pitch_saved: { icon: Save, tone: "text-emerald-300", label: "Pitch saved" },
  note_added: { icon: History, tone: "text-muted-foreground", label: "Note" },
  proposal_sent: { icon: Banknote, tone: "text-orange-300", label: "Proposal" },
  deal_won: { icon: Star, tone: "text-teal-300", label: "Deal won" },
};

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="text-xs text-foreground">{children}</div>
      </div>
    </div>
  );
}

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (lead: Lead) => void;
  onDeleted?: (id: string) => void;
}

function detailFormFrom(value: Lead) {
  return {
    business_name: value.business_name,
    niche: value.niche ?? "",
    website: value.website ?? "",
    email: value.email ?? "",
    phone: value.phone ?? "",
    location: value.location ?? "",
    deal_value: value.deal_value != null ? String(value.deal_value) : "",
    notes: value.notes ?? "",
  };
}

function pitchFormFrom(value: Lead) {
  return {
    identifiedProblem: value.problem ?? "",
    opportunity: value.opportunity ?? "",
    emailSubject: value.email_subject ?? "",
    emailBody: value.email_body ?? "",
    whatsappText: value.whatsapp_message ?? "",
  };
}

export function LeadDetailDialog(props: LeadDetailDialogProps) {
  if (!props.open || !props.lead) return null;
  return <LeadDetailContent key={props.lead.id} {...props} lead={props.lead} />;
}

function LeadDetailContent({
  lead,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: LeadDetailDialogProps & { lead: Lead }) {
  const { user } = useAuth();
  const [current, setCurrent] = React.useState<Lead>(lead);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = React.useState(true);
  const [tab, setTab] = React.useState("overview");

  const [detailForm, setDetailForm] = React.useState(() => detailFormFrom(lead));
  const [pitchForm, setPitchForm] = React.useState(() => pitchFormFrom(lead));
  const [savingDetails, setSavingDetails] = React.useState(false);
  const [savingPitch, setSavingPitch] = React.useState(false);
  const [changingStage, setChangingStage] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

  const hydrate = React.useCallback((value: Lead) => {
    setCurrent(value);
    setDetailForm(detailFormFrom(value));
    setPitchForm(pitchFormFrom(value));
  }, []);

  const loadActivities = React.useCallback(async (leadId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      setActivities(await fetchLeadActivities(supabase, leadId));
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadActivities(lead.id), 0);
    return () => window.clearTimeout(timer);
  }, [lead.id, loadActivities]);

  const handleUpdated = React.useCallback(
    (next: Lead) => {
      hydrate(next);
      onUpdated(next);
      setLoadingActivities(true);
      void loadActivities(next.id);
    },
    [hydrate, loadActivities, onUpdated],
  );

  const { generate, sendEmail, openWhatsApp, generatingId, sendingId } =
    useLeadActions(handleUpdated);

  const supabase = getSupabaseBrowserClient();
  const stage = STAGE_META[current.stage];
  const isGenerating = generatingId === current.id;
  const isSending = sendingId === current.id;
  const whatsappLink = current.phone
    ? buildWhatsAppLink(
        current.phone,
        current.whatsapp_message ||
          `Hi ${current.business_name}, quick idea about your online presence — worth a 10-minute chat?`,
      )
    : null;

  async function saveDetails() {
    if (!supabase || !user) return;
    if (!detailForm.business_name.trim()) {
      toast.error("Business name is required.");
      return;
    }
    setSavingDetails(true);
    try {
      const updated = await updateLead(supabase, user.id, current.id, {
        business_name: detailForm.business_name.trim(),
        niche: detailForm.niche.trim() || null,
        website: detailForm.website.trim() || null,
        email: detailForm.email.trim() || null,
        phone: detailForm.phone.trim() || null,
        location: detailForm.location.trim() || null,
        notes: detailForm.notes.trim() || null,
        deal_value: detailForm.deal_value ? Number(detailForm.deal_value) : null,
      });
      hydrate(updated);
      onUpdated(updated);
      notifyLeadsChanged();
      toast.success("Lead details saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function savePitch() {
    if (!supabase || !user) return;
    setSavingPitch(true);
    try {
      const updated = await updateLead(supabase, user.id, current.id, {
        problem: pitchForm.identifiedProblem || null,
        opportunity: pitchForm.opportunity || null,
        email_subject: pitchForm.emailSubject || null,
        email_body: pitchForm.emailBody || null,
        whatsapp_message: pitchForm.whatsappText || null,
      });
      await supabase.from("activities").insert({
        user_id: user.id,
        lead_id: updated.id,
        type: "pitch_saved",
        description: `Pitch edited for ${updated.business_name}`,
      });
      handleUpdated(updated);
      notifyLeadsChanged();
      toast.success("Pitch saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the pitch.");
    } finally {
      setSavingPitch(false);
    }
  }

  async function changeStage(next: LeadStage) {
    if (!supabase || !user || next === current.stage) return;
    setChangingStage(true);
    try {
      const updated = await moveLeadStage(supabase, user.id, current, next);
      hydrate(updated);
      onUpdated(updated);
      notifyLeadsChanged();
      void loadActivities(updated.id);
      if (next === "closed_won") toast.success("Deal closed. Nice work.");
      else toast.success(`Moved to ${STAGE_META[next].label}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move the stage.");
    } finally {
      setChangingStage(false);
    }
  }

  async function toggleHighTicket() {
    if (!supabase || !user) return;
    try {
      const updated = await updateLead(supabase, user.id, current.id, {
        high_ticket: !current.high_ticket,
      });
      hydrate(updated);
      onUpdated(updated);
      notifyLeadsChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update.");
    }
  }

  async function handleAddNote() {
    if (!supabase || !user || !note.trim()) return;
    setSavingNote(true);
    try {
      await logNote(supabase, user.id, current.id, note.trim());
      setNote("");
      void loadActivities(current.id);
      toast.success("Note added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDelete() {
    if (!supabase || !user) return;
    setDeleting(true);
    try {
      await deleteLead(supabase, user.id, current.id);
      onDeleted?.(current.id);
      notifyLeadsChanged();
      toast.success("Lead deleted.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <div className="border-b border-border/70 p-5 pb-4">
          <DialogHeader>
            <div className="flex flex-wrap items-start gap-2 pr-6">
              <DialogTitle className="text-xl">{current.business_name}</DialogTitle>
              <Badge className={stage.badge}>{stage.label}</Badge>
              {current.high_ticket ? (
                <Badge variant="hot">
                  <Flame /> High-ticket
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{current.niche || "Uncategorized"}</span>
              {current.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {current.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <History className="size-3" /> Added {formatRelativeTime(current.created_at)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void generate(current)} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {current.ai_generated_at ? "Regenerate pitch" : "Generate pitch"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void sendEmail(current)}
              disabled={isSending || !current.email}
              title={current.email ? "Send cold email" : "No email on file"}
            >
              {isSending ? <Loader2 className="animate-spin" /> : <Send />}
              Send email
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openWhatsApp(current)}
              disabled={!current.phone}
              className={cn(
                current.high_ticket &&
                  "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 hover:bg-emerald-400/10",
              )}
            >
              <MessageCircle />
              WhatsApp
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={current.stage}
                onValueChange={(value) => void changeStage(value as LeadStage)}
                disabled={changingStage}
              >
                <SelectTrigger size="sm" className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_ORDER.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STAGE_META[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon-sm"
                variant={current.high_ticket ? "secondary" : "ghost"}
                onClick={() => void toggleHighTicket()}
                title="Toggle high-ticket"
                className={current.high_ticket ? "text-orange-300" : undefined}
              >
                <Star className={current.high_ticket ? "fill-current" : undefined} />
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="gap-0">
          <div className="border-b border-border/70 px-5 py-2">
            <TabsList className="bg-transparent p-0">
              <TabsTrigger value="overview" className="data-[state=active]:bg-secondary">
                Overview
              </TabsTrigger>
              <TabsTrigger value="pitch" className="data-[state=active]:bg-secondary">
                AI pitch
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-secondary">
                Activity
                {activities.length ? (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">
                    {activities.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[62dvh] overflow-y-auto p-5">
            <TabsContent value="overview" className="mt-0 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-business">Business name</Label>
                  <Input
                    id="detail-business"
                    value={detailForm.business_name}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, business_name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-niche">Niche</Label>
                  <Input
                    id="detail-niche"
                    value={detailForm.niche}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, niche: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-email">Email</Label>
                  <Input
                    id="detail-email"
                    type="email"
                    value={detailForm.email}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, email: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-phone">Phone / WhatsApp</Label>
                  <Input
                    id="detail-phone"
                    value={detailForm.phone}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, phone: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-website">Website</Label>
                  <Input
                    id="detail-website"
                    value={detailForm.website}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, website: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-location">Location</Label>
                  <Input
                    id="detail-location"
                    value={detailForm.location}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, location: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-value">Deal value (USD)</Label>
                  <Input
                    id="detail-value"
                    type="number"
                    min="0"
                    step="100"
                    value={detailForm.deal_value}
                    onChange={(event) =>
                      setDetailForm((form) => ({ ...form, deal_value: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => void saveDetails()} disabled={savingDetails} className="w-full">
                    {savingDetails ? <Loader2 className="animate-spin" /> : <Save />}
                    Save details
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="detail-notes">Notes</Label>
                <Textarea
                  id="detail-notes"
                  value={detailForm.notes}
                  onChange={(event) =>
                    setDetailForm((form) => ({ ...form, notes: event.target.value }))
                  }
                  rows={3}
                  placeholder="Context, objections, best time to call…"
                />
              </div>

              <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-1">
                <DetailRow icon={<Mail className="size-3.5" />} label="Email">
                  {current.email ? (
                    <a href={`mailto:${current.email}`} className="hover:text-primary">
                      {current.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not on file</span>
                  )}
                </DetailRow>
                <Separator />
                <DetailRow icon={<Phone className="size-3.5" />} label="Phone">
                  {current.phone ? current.phone : <span className="text-muted-foreground">Not on file</span>}
                </DetailRow>
                <Separator />
                <DetailRow icon={<Globe className="size-3.5" />} label="Website">
                  {current.website ? (
                    <a
                      href={current.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      {current.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No website — good angle.</span>
                  )}
                </DetailRow>
                <Separator />
                <DetailRow icon={<Banknote className="size-3.5" />} label="Deal value">
                  {formatCurrency(current.deal_value)}
                </DetailRow>
                <Separator />
                <DetailRow icon={<History className="size-3.5" />} label="Last contact">
                  {current.last_contacted_at
                    ? formatDateTime(current.last_contacted_at)
                    : "Never contacted"}
                </DetailRow>
              </div>

              <div className="rounded-lg border border-destructive/20 bg-destructive/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">Delete this lead</p>
                    <p className="text-[10px] text-muted-foreground">
                      Removes the lead and its activity history permanently.
                    </p>
                  </div>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                        <X /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                      >
                        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                      <Trash2 /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pitch" className="mt-0 space-y-4">
              {!current.ai_generated_at ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">No pitch yet</p>
                    <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                      Run the AI audit. LeadPilot checks the website for conversion gaps and writes
                      a problem-to-solution email plus a short WhatsApp opener.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void generate(current)} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    Generate pitch
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pitch-problem">Identified problem</Label>
                  <Textarea
                    id="pitch-problem"
                    value={pitchForm.identifiedProblem}
                    onChange={(event) =>
                      setPitchForm((form) => ({ ...form, identifiedProblem: event.target.value }))
                    }
                    rows={4}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pitch-opportunity">Proposed solution</Label>
                  <Textarea
                    id="pitch-opportunity"
                    value={pitchForm.opportunity}
                    onChange={(event) =>
                      setPitchForm((form) => ({ ...form, opportunity: event.target.value }))
                    }
                    rows={4}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pitch-subject">Email subject</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {pitchForm.emailSubject.length}/60
                  </span>
                </div>
                <Input
                  id="pitch-subject"
                  value={pitchForm.emailSubject}
                  onChange={(event) =>
                    setPitchForm((form) => ({ ...form, emailSubject: event.target.value }))
                  }
                  placeholder="quick question about your booking flow"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pitch-body">Email body</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {pitchForm.emailBody.split(/\s+/).filter(Boolean).length} words
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(pitchForm.emailBody);
                        toast.success("Email body copied.");
                      }}
                      title="Copy email body"
                    >
                      <Copy />
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="pitch-body"
                  value={pitchForm.emailBody}
                  onChange={(event) =>
                    setPitchForm((form) => ({ ...form, emailBody: event.target.value }))
                  }
                  rows={9}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pitch-whatsapp">WhatsApp opener</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {pitchForm.whatsappText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <Textarea
                  id="pitch-whatsapp"
                  value={pitchForm.whatsappText}
                  onChange={(event) =>
                    setPitchForm((form) => ({ ...form, whatsappText: event.target.value }))
                  }
                  rows={3}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void savePitch()} disabled={savingPitch}>
                  {savingPitch ? <Loader2 className="animate-spin" /> : <Save />}
                  Save pitch
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void sendEmail(current)}
                  disabled={isSending || !current.email}
                >
                  {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                  Send email
                </Button>
                {whatsappLink ? (
                  <Button
                    variant="outline"
                    onClick={() => openWhatsApp(current)}
                    className="border-emerald-400/30 text-emerald-300"
                  >
                    <MessageCircle />
                    Open WhatsApp
                  </Button>
                ) : null}
                {current.ai_generated_at ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Check className="size-3 text-primary" />
                    Generated {formatRelativeTime(current.ai_generated_at)}
                  </span>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Log a note — call outcome, objection, next step…"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleAddNote();
                    }
                  }}
                />
                <Button onClick={() => void handleAddNote()} disabled={savingNote || !note.trim()}>
                  {savingNote ? <Loader2 className="animate-spin" /> : <Save />}
                  Add
                </Button>
              </div>

              {loadingActivities ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : activities.length ? (
                <ol className="relative space-y-1 border-l border-border/70 pl-4">
                  {activities.map((activity) => {
                    const meta = activityMeta[activity.type] ?? activityMeta.note_added;
                    const Icon = meta.icon;
                    return (
                      <li key={activity.id} className="relative pb-4">
                        <span className="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border border-border bg-background">
                          <span className={cn("size-1.5 rounded-full bg-current", meta.tone)} />
                        </span>
                        <div className="flex items-start gap-2">
                          <Icon className={cn("mt-0.5 size-3.5 shrink-0", meta.tone)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-relaxed text-foreground">
                              {activity.description}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {meta.label} · {formatDateTime(activity.created_at)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                  No activity yet. Generate a pitch or send an email to start the timeline.
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
