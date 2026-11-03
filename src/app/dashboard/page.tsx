"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Flame,
  KanbanSquare,
  Mail,
  MessageCircle,
  Plus,
  Radar,
  Send,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadActions } from "@/hooks/use-lead-actions";
import { DEFAULT_DAILY_QUOTA, STAGE_META, STAGE_ORDER } from "@/lib/constants";
import { fetchLeads, fetchRecentActivities } from "@/lib/data";
import { formatCurrency, formatRelativeTime, startOfToday } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Activity, Lead } from "@/lib/types";

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <span className={cn("text-muted-foreground/80 [&_svg]:size-4", accent)}>{icon}</span>
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QuotaRing({ used, quota }: { used: number; quota: number }) {
  const ratio = Math.min(1, quota ? used / quota : 0);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative flex size-[120px] items-center justify-center">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="text-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{used}</span>
        <span className="text-[10px] text-muted-foreground">of {quota}</span>
      </div>
    </div>
  );
}

const activityIcon = (type: string) => {
  switch (type) {
    case "ai_audit":
      return <Sparkles className="size-3.5 text-emerald-300" />;
    case "email_sent":
      return <Mail className="size-3.5 text-violet-300" />;
    case "whatsapp_opened":
      return <MessageCircle className="size-3.5 text-emerald-300" />;
    case "stage_change":
      return <KanbanSquare className="size-3.5 text-amber-300" />;
    case "lead_imported":
      return <Users className="size-3.5 text-sky-300" />;
    case "lead_created":
      return <Plus className="size-3.5 text-sky-300" />;
    default:
      return <CheckCircle2 className="size-3.5 text-muted-foreground" />;
  }
};

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [emailCount, setEmailCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);

  const quota = profile?.daily_quota ?? DEFAULT_DAILY_QUOTA;

  const load = React.useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      const [leadRows, activityRows, emailResult] = await Promise.all([
        fetchLeads(supabase, user.id),
        fetchRecentActivities(supabase, user.id, 8),
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("type", "email_sent"),
      ]);
      setLeads(leadRows);
      setActivities(activityRows);
      setEmailCount(emailResult.count ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleCreated = React.useCallback((lead: Lead) => {
    setLeads((current) => [lead, ...current]);
  }, []);

  const { openWhatsApp } = useLeadActions();

  const todayCount = leads.filter(
    (lead) => new Date(lead.created_at).getTime() >= startOfToday().getTime(),
  ).length;
  const openLeads = leads.filter((lead) => lead.stage !== "closed_won");
  const wonLeads = leads.filter((lead) => lead.stage === "closed_won");
  const pipelineValue = openLeads.reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const wonValue = wonLeads.reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const audited = leads.filter((lead) => lead.ai_generated_at).length;
  const highTicket = openLeads.filter((lead) => lead.high_ticket).slice(0, 4);

  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: leads.filter((lead) => lead.stage === stage).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((item) => item.count));

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const focus = [
    {
      label: "Ingest today's leads",
      detail: `${todayCount}/${quota} added`,
      done: todayCount >= quota,
      href: "/dashboard/leads",
    },
    {
      label: "Run AI audits",
      detail: `${audited} pitch${audited === 1 ? "" : "es"} generated`,
      done: audited >= Math.min(5, leads.length) && leads.length > 0,
      href: "/dashboard/leads",
    },
    {
      label: "Send outreach",
      detail: `${emailCount} email${emailCount === 1 ? "" : "s"} sent`,
      done: emailCount >= Math.min(20, leads.length) && leads.length > 0,
      href: "/dashboard/leads",
    },
    {
      label: "Work the pipeline",
      detail: `${openLeads.length} active deal${openLeads.length === 1 ? "" : "s"}`,
      done: false,
      href: "/dashboard/pipeline",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command center"
        title={`Welcome back, ${firstName}.`}
        description="Your daily outbound loop at a glance. Ingest leads, run audits, hit both channels, and push deals forward."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/discover">
                <Radar />
                Discover
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/pipeline">
                <KanbanSquare />
                Pipeline
              </Link>
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              Add lead
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card">
            <CardContent className="flex items-center gap-5 p-5">
              <QuotaRing used={todayCount} quota={quota} />
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Daily quota
                </p>
                <p className="text-lg font-semibold leading-tight">
                  {todayCount >= quota
                    ? "Target hit."
                    : `${quota - todayCount} leads to go.`}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {todayCount >= quota
                    ? "Now spend the rest of the hour on follow-ups and high-ticket WhatsApp."
                    : "Consistency beats volume. Add leads, audit the best five, then send."}
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/leads">
                    Open lead manager
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Open pipeline"
              value={formatCurrency(pipelineValue)}
              hint={`${openLeads.length} active deals`}
              icon={<Target />}
              accent="text-sky-300/80"
            />
            <StatCard
              label="Cold emails sent"
              value={String(emailCount)}
              hint="Resend + SMTP combined"
              icon={<Mail />}
              accent="text-violet-300/80"
            />
            <StatCard
              label="Won revenue"
              value={formatCurrency(wonValue)}
              hint={`${wonLeads.length} closed deal${wonLeads.length === 1 ? "" : "s"}`}
              icon={<Banknote />}
              accent="text-primary"
            />
          </div>
        </div>
      )}

      {!loading && leads.length === 0 ? (
        <EmptyState
          icon={<Zap />}
          title="Let's load your first 50 leads"
          description="Ask the discovery agent to find prospects, add them one by one, or import a CSV. LeadPilot will audit each site, write the pitch, and keep your pipeline organized."
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
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/leads">
                  Import CSV <ArrowUpRight />
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-4 text-primary" /> Today&apos;s focus
                </CardTitle>
                <Badge variant="secondary">{todayCount}/{quota} leads</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {focus.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 transition-colors hover:border-primary/25 hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        item.done
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border text-transparent",
                      )}
                    >
                      <CheckCircle2 className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                    </div>
                    <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <KanbanSquare className="size-4 text-primary" /> Pipeline breakdown
                </CardTitle>
                <Link
                  href="/dashboard/pipeline"
                  className="text-[10px] text-muted-foreground transition-colors hover:text-primary"
                >
                  Open board
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {stageCounts.map(({ stage, count }) => {
                  const meta = STAGE_META[stage];
                  return (
                    <div key={stage} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className={cn("size-1.5 rounded-full", meta.dot)} />
                          {meta.label}
                        </span>
                        <span className="font-mono text-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", meta.bar)}
                          style={{ width: `${(count / maxStage) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Flame className="size-4 text-orange-400" /> High-ticket targets
                </CardTitle>
                <Badge variant="hot">{openLeads.filter((lead) => lead.high_ticket).length}</Badge>
              </CardHeader>
              <CardContent>
                {highTicket.length ? (
                  <div className="space-y-2">
                    {highTicket.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 p-2.5"
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-orange-400/20 bg-orange-400/10 text-[9px] font-semibold text-orange-300">
                          {lead.business_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{lead.business_name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {lead.niche || "Uncategorized"}
                            {lead.deal_value ? ` · ${formatCurrency(lead.deal_value)}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-emerald-300"
                          title="Open WhatsApp"
                          onClick={() => openWhatsApp(lead)}
                          disabled={!lead.phone}
                        >
                          <MessageCircle />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/dashboard/pipeline">
                        Review all targets <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                    No high-ticket leads yet. Flag a prospect when adding or editing it to unlock
                    the WhatsApp deep link.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Send className="size-4 text-primary" /> Recent activity
                </CardTitle>
                <span className="text-[10px] text-muted-foreground">Last 8 events</span>
              </CardHeader>
              <CardContent>
                {activities.length ? (
                  <ol className="space-y-3">
                    {activities.map((activity) => (
                      <li key={activity.id} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                          {activityIcon(activity.type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] leading-relaxed text-foreground">
                            {activity.description}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {formatRelativeTime(activity.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[11px] text-muted-foreground">
                    Activity will appear here as you audit, email, and move deals.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!loading && leads.length > 0 ? (
        <Card className="border-primary/15 bg-primary/[0.03]">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-xs font-medium">Next best action</p>
                <p className="text-[11px] text-muted-foreground">
                  {openLeads.length
                    ? `Audit and pitch your highest-value lead, then follow up within 48 hours.`
                    : "You closed everything. Import a fresh batch and repeat the loop."}
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/dashboard/pipeline">
                Work the pipeline <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
        todayCount={todayCount}
        quota={quota}
      />
    </div>
  );
}
