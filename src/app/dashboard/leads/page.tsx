"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Flame,
  Inbox,
  Loader2,
  MessageCircle,
  Plus,
  Radar,
  Search,
  Send,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadActions } from "@/hooks/use-lead-actions";
import { STAGE_META, STAGE_ORDER, DEFAULT_DAILY_QUOTA } from "@/lib/constants";
import { fetchLeads } from "@/lib/data";
import { initials, startOfToday } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";

export default function LeadsPage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<string>("all");
  const [nicheFilter, setNicheFilter] = React.useState<string>("all");
  const [hotOnly, setHotOnly] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const quota = profile?.daily_quota ?? DEFAULT_DAILY_QUOTA;

  const load = React.useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      setLeads(await fetchLeads(supabase, user.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    const timer = window.setTimeout(() => {
      setAddOpen(true);
      window.history.replaceState({}, "", "/dashboard/leads");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const todayCount = React.useMemo(
    () =>
      leads.filter((lead) => new Date(lead.created_at).getTime() >= startOfToday().getTime())
        .length,
    [leads],
  );

  const niches = React.useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.niche).filter(Boolean) as string[])).sort(),
    [leads],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (nicheFilter !== "all" && lead.niche !== nicheFilter) return false;
      if (hotOnly && !lead.high_ticket) return false;
      if (!query) return true;
      return [
        lead.business_name,
        lead.niche,
        lead.email,
        lead.phone,
        lead.location,
        lead.notes,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [leads, stageFilter, nicheFilter, hotOnly, search]);

  const contacted = leads.filter((lead) => lead.stage !== "discovered").length;
  const hot = leads.filter((lead) => lead.high_ticket).length;
  const won = leads.filter((lead) => lead.stage === "closed_won").length;

  const handleUpdated = React.useCallback((updated: Lead) => {
    setLeads((current) => current.map((lead) => (lead.id === updated.id ? updated : lead)));
    setSelected((current) => (current?.id === updated.id ? updated : current));
  }, []);

  const handleCreated = React.useCallback((lead: Lead) => {
    setLeads((current) => [lead, ...current]);
  }, []);

  const handleImported = React.useCallback((created: Lead[]) => {
    setLeads((current) => [...created, ...current]);
  }, []);

  const handleDeleted = React.useCallback((id: string) => {
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setSelected(null);
  }, []);

  const { generate, sendEmail, openWhatsApp, generatingId, sendingId } =
    useLeadActions(handleUpdated);

  function openDetail(lead: Lead) {
    setSelected(lead);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead manager"
        title="Your daily prospect list"
        description="Import, filter, and work up to 50 leads per day. Every lead keeps its pitch, contact history, and pipeline stage in one place."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/discover">
                <Radar />
                Discover
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              Add lead
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Today&apos;s quota</span>
              <span className="font-mono text-foreground">
                {todayCount}/{quota}
              </span>
            </div>
            <Progress value={quota ? (todayCount / quota) * 100 : 0} />
            <p className="text-[10px] text-muted-foreground">
              {todayCount >= quota ? "Quota complete for today." : `${quota - todayCount} slots open`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total leads</p>
              <p className="mt-1 text-xl font-semibold">{leads.length}</p>
            </div>
            <Users className="size-5 text-sky-300/70" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contacted</p>
              <p className="mt-1 text-xl font-semibold">{contacted}</p>
            </div>
            <Send className="size-5 text-violet-300/70" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">High-ticket / won</p>
              <p className="mt-1 text-xl font-semibold">
                {hot}
                <span className="text-muted-foreground"> / {won}</span>
              </p>
            </div>
            <Flame className="size-5 text-orange-300/70" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border/70 p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, email, location…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGE_ORDER.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {STAGE_META[stage].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={nicheFilter} onValueChange={setNicheFilter}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue placeholder="Niche" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All niches</SelectItem>
                {niches.map((niche) => (
                  <SelectItem key={niche} value={niche}>
                    {niche}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={hotOnly ? "default" : "outline"}
              onClick={() => setHotOnly((value) => !value)}
              className={hotOnly ? "bg-orange-400/15 text-orange-300 hover:bg-orange-400/20" : undefined}
            >
              <Flame />
              High-ticket
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Inbox />}
                title={leads.length ? "No leads match these filters" : "No leads yet"}
                description={
                  leads.length
                    ? "Clear the filters or search for a different business."
                    : "Let the AI discovery agent find prospects, add one manually, or import a CSV."
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" asChild>
                      <Link href="/dashboard/discover">
                        <Radar /> Discover leads
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                      <Plus /> Add lead
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload /> Import CSV
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,2.2fr)_1.1fr_1.2fr_0.8fr_0.9fr_auto] gap-3 border-b border-border/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
                <span>Business</span>
                <span>Niche</span>
                <span>Contact</span>
                <span>Pitch</span>
                <span>Stage</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-border/60">
                {filtered.map((lead) => {
                  const stage = STAGE_META[lead.stage];
                  const isGenerating = generatingId === lead.id;
                  const isSending = sendingId === lead.id;
                  return (
                    <div
                      key={lead.id}
                      className="grid cursor-pointer grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-accent/40 lg:grid-cols-[minmax(0,2.2fr)_1.1fr_1.2fr_0.8fr_0.9fr_auto] lg:items-center"
                      onClick={() => openDetail(lead)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-300/20 to-teal-500/10 text-[10px] font-semibold text-primary">
                          {initials(lead.business_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-medium">{lead.business_name}</p>
                            {lead.high_ticket ? (
                              <Flame className="size-3 shrink-0 text-orange-400" />
                            ) : null}
                          </div>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {lead.website?.replace(/^https?:\/\//, "") ||
                              lead.location ||
                              "No website"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="lg:hidden text-[10px] uppercase tracking-wider">Niche:</span>
                        <span className="truncate">{lead.niche || "—"}</span>
                      </div>

                      <div className="min-w-0 text-[11px] text-muted-foreground">
                        <p className="truncate">{lead.email || "No email"}</p>
                        <p className="truncate text-[10px]">{lead.phone || "No phone"}</p>
                      </div>

                      <div>
                        {lead.email_subject ? (
                          <Badge variant="success">
                            <Sparkles /> Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No pitch</Badge>
                        )}
                      </div>

                      <div>
                        <Badge className={stage.badge}>{stage.short}</Badge>
                      </div>

                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Generate AI pitch"
                          onClick={() => void generate(lead)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={lead.email ? "Send cold email" : "No email on file"}
                          onClick={() => void sendEmail(lead)}
                          disabled={isSending || !lead.email}
                        >
                          {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={lead.phone ? "Open WhatsApp" : "No phone on file"}
                          onClick={() => openWhatsApp(lead)}
                          disabled={!lead.phone}
                          className={lead.high_ticket ? "text-emerald-300" : undefined}
                        >
                          <MessageCircle />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Open lead"
                          onClick={() => openDetail(lead)}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground">
        Showing {filtered.length} of {leads.length} leads ·{" "}
        <Link href="/dashboard/pipeline" className="text-primary hover:underline">
          Open pipeline
        </Link>
      </p>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
        todayCount={todayCount}
        quota={quota}
      />
      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
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
