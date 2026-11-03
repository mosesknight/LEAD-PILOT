"use client";

import * as React from "react";
import {
  ChevronRight,
  Flame,
  KanbanSquare,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadActions } from "@/hooks/use-lead-actions";
import { DEFAULT_DAILY_QUOTA, STAGE_META, STAGE_ORDER } from "@/lib/constants";
import { fetchLeads, moveLeadStage } from "@/lib/data";
import { formatCompact, formatCurrency, initials, startOfToday, truncate } from "@/lib/format";
import { notifyLeadsChanged } from "@/lib/events";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Lead, LeadStage } from "@/lib/types";

export default function PipelinePage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [hotOnly, setHotOnly] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<LeadStage | null>(null);

  const quota = profile?.daily_quota ?? DEFAULT_DAILY_QUOTA;

  const load = React.useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      setLeads(await fetchLeads(supabase, user.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the pipeline.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleUpdated = React.useCallback((updated: Lead) => {
    setLeads((current) => current.map((lead) => (lead.id === updated.id ? updated : lead)));
    setSelected((current) => (current?.id === updated.id ? updated : current));
  }, []);

  const handleCreated = React.useCallback((lead: Lead) => {
    setLeads((current) => [lead, ...current]);
  }, []);

  const handleDeleted = React.useCallback((id: string) => {
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setSelected(null);
  }, []);

  const { openWhatsApp } = useLeadActions(handleUpdated);

  const todayCount = React.useMemo(
    () =>
      leads.filter((lead) => new Date(lead.created_at).getTime() >= startOfToday().getTime())
        .length,
    [leads],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (hotOnly && !lead.high_ticket) return false;
      if (!query) return true;
      return [lead.business_name, lead.niche, lead.email, lead.location]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [leads, search, hotOnly]);

  const byStage = React.useMemo(() => {
    const map = new Map<LeadStage, Lead[]>();
    for (const stage of STAGE_ORDER) map.set(stage, []);
    for (const lead of filtered) map.get(lead.stage)?.push(lead);
    return map;
  }, [filtered]);

  const pipelineValue = leads
    .filter((lead) => lead.stage !== "closed_won")
    .reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const wonValue = leads
    .filter((lead) => lead.stage === "closed_won")
    .reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const wonCount = leads.filter((lead) => lead.stage === "closed_won").length;
  const activeCount = leads.filter((lead) => lead.stage !== "closed_won").length;

  async function handleDrop(stage: LeadStage) {
    setDragOverStage(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.stage === stage) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;

    const previous = lead.stage;
    setLeads((current) =>
      current.map((item) => (item.id === id ? { ...item, stage } : item)),
    );

    try {
      const updated = await moveLeadStage(supabase, user.id, lead, stage);
      handleUpdated(updated);
      notifyLeadsChanged();
      if (stage === "closed_won") toast.success(`${lead.business_name} closed. Nice.`);
    } catch (error) {
      setLeads((current) =>
        current.map((item) => (item.id === id ? { ...item, stage: previous } : item)),
      );
      toast.error(error instanceof Error ? error.message : "Could not move the lead.");
    }
  }

  function advance(lead: Lead) {
    const index = STAGE_ORDER.indexOf(lead.stage);
    const next = STAGE_ORDER[index + 1];
    if (next) void handleDropFor(lead, next);
  }

  async function handleDropFor(lead: Lead, stage: LeadStage) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || lead.stage === stage) return;
    setLeads((current) =>
      current.map((item) => (item.id === lead.id ? { ...item, stage } : item)),
    );
    try {
      const updated = await moveLeadStage(supabase, user.id, lead, stage);
      handleUpdated(updated);
      notifyLeadsChanged();
    } catch (error) {
      void load();
      toast.error(error instanceof Error ? error.message : "Could not move the lead.");
    }
  }

  function openDetail(lead: Lead) {
    setSelected(lead);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM pipeline"
        title="Deal board"
        description="Drag cards between stages. Every move is logged automatically, so you always know the last touch and the next step."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            Add lead
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open pipeline</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(pipelineValue)}</p>
            </div>
            <Target className="size-5 text-sky-300/70" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Won revenue</p>
              <p className="mt-1 text-xl font-semibold text-primary">{formatCurrency(wonValue)}</p>
            </div>
            <Sparkles className="size-5 text-primary/70" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active deals</p>
              <p className="mt-1 text-xl font-semibold">{activeCount}</p>
            </div>
            <KanbanSquare className="size-5 text-violet-300/70" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win rate</p>
              <p className="mt-1 text-xl font-semibold">
                {leads.length ? Math.round((wonCount / Math.max(1, leads.length)) * 100) : 0}%
              </p>
            </div>
            <Flame className="size-5 text-orange-300/70" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter the board…"
            className="pl-8"
          />
        </div>
        <Button
          size="sm"
          variant={hotOnly ? "default" : "outline"}
          onClick={() => setHotOnly((value) => !value)}
          className={hotOnly ? "bg-orange-400/15 text-orange-300 hover:bg-orange-400/20" : undefined}
        >
          <Flame />
          High-ticket only
        </Button>
        <p className="text-[10px] text-muted-foreground sm:ml-auto">
          {formatCompact(filtered.length)} of {formatCompact(leads.length)} leads ·{" "}
          {formatCurrency(pipelineValue + wonValue)} total value
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare />}
          title="Your pipeline is empty"
          description="Add leads or import a CSV, then drag them across the board as conversations progress."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add your first lead
            </Button>
          }
        />
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {STAGE_ORDER.map((stage) => {
            const meta = STAGE_META[stage];
            const stageLeads = byStage.get(stage) ?? [];
            const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
            return (
              <div
                key={stage}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setDragOverStage((current) => (current === stage ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDrop(stage);
                }}
                className={cn(
                  "flex w-[290px] shrink-0 flex-col rounded-xl border border-border/70 bg-card/30 transition-colors",
                  dragOverStage === stage && "drag-over border-primary/40",
                )}
              >
                <div className={cn("h-0.5 w-full rounded-t-xl bg-gradient-to-r to-transparent", meta.kanban)} />
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    <span className="truncate text-xs font-semibold">{meta.label}</span>
                    <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                  {stageValue > 0 ? (
                    <span className="text-[10px] text-muted-foreground">{formatCompact(stageValue)}</span>
                  ) : null}
                </div>

                <div className="flex min-h-[140px] flex-1 flex-col gap-2 px-2.5 pb-3">
                  {stageLeads.map((lead) => (
                    <article
                      key={lead.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggingId(lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                      onClick={() => openDetail(lead)}
                      className={cn(
                        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/25 hover:shadow-md active:cursor-grabbing",
                        lead.high_ticket ? "border-orange-400/25" : "border-border/80",
                        draggingId === lead.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-300/20 to-teal-500/10 text-[9px] font-semibold text-primary">
                          {initials(lead.business_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{lead.business_name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {lead.niche || "Uncategorized"}
                          </p>
                        </div>
                        {lead.high_ticket ? (
                          <Flame className="mt-0.5 size-3 shrink-0 text-orange-400" />
                        ) : null}
                      </div>

                      {lead.problem ? (
                        <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                          {truncate(lead.problem, 90)}
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {lead.email ? (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                            Email
                          </Badge>
                        ) : null}
                        {lead.phone ? (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                            Phone
                          </Badge>
                        ) : null}
                        {lead.whatsapp_message ? (
                          <Badge variant="success" className="px-1.5 py-0 text-[9px]">
                            Pitch
                          </Badge>
                        ) : null}
                        {lead.deal_value ? (
                          <span className="ml-auto text-[10px] font-medium text-muted-foreground">
                            {formatCurrency(lead.deal_value)}
                          </span>
                        ) : null}
                      </div>

                      <div
                        className="mt-2 flex items-center justify-end gap-0.5 border-t border-border/60 pt-1.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {lead.high_ticket && lead.phone ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-6 text-emerald-300"
                            title="Open WhatsApp"
                            onClick={() => openWhatsApp(lead)}
                          >
                            <MessageCircle className="size-3.5" />
                          </Button>
                        ) : null}
                        {stage !== "closed_won" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-6"
                            title="Advance stage"
                            onClick={() => advance(lead)}
                          >
                            <ChevronRight className="size-3.5" />
                          </Button>
                        ) : (
                          <Sparkles className="mr-1 size-3 text-teal-300/70" />
                        )}
                      </div>
                    </article>
                  ))}

                  {stageLeads.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 px-3 py-6 text-center">
                      <p className="text-[10px] text-muted-foreground/70">
                        Drop a lead here
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Loader2 className="size-3" />
        Stage changes are saved instantly and logged to each lead&apos;s activity history.
      </div>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
        todayCount={todayCount}
        quota={quota}
      />
      <LeadDetailDialog
        lead={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
