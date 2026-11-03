"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Radar,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api-client";
import {
  DEFAULT_DAILY_QUOTA,
  DISCOVERY_DEFAULT_COUNT,
  DISCOVERY_EXAMPLES,
  DISCOVERY_MAX_COUNT,
  DISCOVERY_MIN_COUNT,
  NICHES,
  STAGE_META,
} from "@/lib/constants";
import { createManyLeads, fetchTodayLeadCount } from "@/lib/data";
import { notifyLeadsChanged } from "@/lib/events";
import { normalizeWebsite } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DiscoveredLead, Lead, LeadInput } from "@/lib/types";

interface DiscoveryResponse {
  leads: DiscoveredLead[];
  notice: string | null;
}

interface PitchResponse {
  lead: Lead;
}

interface EmailResponse {
  lead: Lead;
}

function websiteLabel(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function buildImportNotes(lead: DiscoveredLead, niche: string, location: string) {
  const parts: string[] = [];
  if (lead.notes) parts.push(lead.notes);
  const target = niche || "your target niche";
  parts.push(`Found via AI discovery for ${target}${location ? ` in ${location}` : ""}.`);
  if (lead.source) parts.push(`Source: ${lead.source}`);
  return parts.join(" ").slice(0, 1200);
}

export default function DiscoverPage() {
  const { user, profile } = useAuth();
  const [niche, setNiche] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [count, setCount] = React.useState(String(DISCOVERY_DEFAULT_COUNT));
  const [prompt, setPrompt] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<DiscoveredLead[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [importing, setImporting] = React.useState(false);
  const [imported, setImported] = React.useState<Lead[]>([]);
  const [todayCount, setTodayCount] = React.useState<number | null>(null);
  const [bulkAction, setBulkAction] = React.useState<"draft" | "send" | null>(null);
  const [actionProgress, setActionProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);

  const quota = profile?.daily_quota ?? DEFAULT_DAILY_QUOTA;
  const remaining = Math.max(0, quota - (todayCount ?? 0));
  const selectedCount = selected.size;

  const loadCount = React.useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      setTodayCount(await fetchTodayLeadCount(supabase, user.id));
    } catch {
      setTodayCount(0);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadCount(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCount]);

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === results.length ? new Set() : new Set(results.map((_, index) => index)),
    );
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNiche = niche.trim();
    const trimmedPrompt = prompt.trim();

    if (!trimmedNiche && !trimmedPrompt) {
      toast.error("Enter a niche or describe your ideal customer.");
      return;
    }

    const requested = Number.parseInt(count, 10);
    const targetCount = Number.isFinite(requested)
      ? Math.min(DISCOVERY_MAX_COUNT, Math.max(DISCOVERY_MIN_COUNT, requested))
      : DISCOVERY_DEFAULT_COUNT;

    setSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setNotice(null);
    setResults([]);
    setSelected(new Set());

    try {
      const payload = await apiPost<DiscoveryResponse>("/api/discover-leads", {
        niche: trimmedNiche,
        location: location.trim(),
        count: targetCount,
        prompt: trimmedPrompt,
      });

      setResults(payload.leads);
      setSelected(new Set(payload.leads.map((_, index) => index)));
      setNotice(payload.notice);
      if (payload.leads.length) {
        toast.success(
          `${payload.leads.length} lead${payload.leads.length === 1 ? "" : "s"} found.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lead discovery failed.";
      setSearchError(message);
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }

  async function handleImport() {
    const chosen = results.filter((_, index) => selected.has(index));
    if (!chosen.length) {
      toast.error("Select at least one lead to import.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) {
      toast.error("You need to be signed in.");
      return;
    }

    setImporting(true);
    try {
      const { data: existingRows, error: existingError } = await supabase
        .from("leads")
        .select("business_name, email, website, location")
        .eq("user_id", user.id);
      if (existingError) throw new Error(existingError.message);

      const existing = (existingRows ?? []) as Array<{
        business_name: string;
        email: string | null;
        website: string | null;
        location: string | null;
      }>;

      const existingEmails = new Set<string>();
      const existingWebsites = new Set<string>();
      const existingNames = new Set<string>();

      for (const row of existing) {
        if (row.email) existingEmails.add(row.email.trim().toLowerCase());
        if (row.website) {
          const key = normalizeWebsite(row.website)?.toLowerCase().replace(/\/$/, "");
          if (key) existingWebsites.add(key);
        }
        if (row.business_name) {
          const locationKey = (row.location ?? "").trim().toLowerCase();
          existingNames.add(`${row.business_name.trim().toLowerCase()}|${locationKey}`);
        }
      }

      const unique = chosen.filter((lead) => {
        const emailKey = lead.email?.trim().toLowerCase();
        const websiteKey = lead.website
          ? normalizeWebsite(lead.website)?.toLowerCase().replace(/\/$/, "")
          : null;
        const nameKey = `${lead.business_name.trim().toLowerCase()}|${(lead.location ?? "")
          .trim()
          .toLowerCase()}`;

        if (emailKey && existingEmails.has(emailKey)) return false;
        if (websiteKey && existingWebsites.has(websiteKey)) return false;
        if (existingNames.has(nameKey)) return false;
        return true;
      });

      const duplicates = chosen.length - unique.length;
      if (!unique.length) {
        toast.error("Every selected lead is already in your pipeline.");
        return;
      }

      if (remaining <= 0) {
        toast.error("Today's quota is full. Raise it in Settings or continue tomorrow.");
        return;
      }
      if (unique.length > remaining) {
        toast.error(
          `Only ${remaining} lead slot${remaining === 1 ? "" : "s"} left today. Select fewer.`,
        );
        return;
      }

      const inputs: LeadInput[] = unique.map((lead) => ({
        business_name: lead.business_name,
        niche: lead.niche,
        website: lead.website,
        email: lead.email,
        phone: lead.phone,
        location: lead.location,
        notes: buildImportNotes(lead, niche.trim(), location.trim()),
      }));

      const created = await createManyLeads(supabase, user.id, inputs);
      const importedSet = new Set(unique);

      await supabase.from("activities").insert({
        user_id: user.id,
        lead_id: null,
        type: "lead_imported",
        description: `Imported ${created.length} lead${created.length === 1 ? "" : "s"} from AI discovery`,
        metadata: {
          count: created.length,
          duplicatesSkipped: duplicates,
          source: "ai_discovery",
          niche: niche.trim() || null,
          location: location.trim() || null,
        },
      });

      setImported((current) => [...created, ...current]);
      setTodayCount((current) => (current ?? 0) + created.length);
      setResults((current) => current.filter((lead) => !importedSet.has(lead)));
      setSelected(new Set());
      notifyLeadsChanged();
      toast.success(
        `${created.length} lead${created.length === 1 ? "" : "s"} imported into your pipeline.`,
      );
      if (duplicates) {
        toast.message(
          `${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped because they already exist in your pipeline.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const draftTargets = imported.filter((lead) => !lead.email_subject);
  const sendTargets = imported.filter(
    (lead) => Boolean(lead.email && lead.email_subject && lead.email_body),
  );

  async function draftPitches() {
    const targets = imported.filter((lead) => !lead.email_subject);
    if (!targets.length) {
      toast.message("Every imported lead already has a pitch.");
      return;
    }

    setBulkAction("draft");
    setActionProgress({ done: 0, total: targets.length });
    let succeeded = 0;
    let failed = 0;

    for (const [index, lead] of targets.entries()) {
      try {
        const result = await apiPost<PitchResponse>("/api/generate-pitch", {
          leadId: lead.id,
        });
        setImported((current) =>
          current.map((item) => (item.id === result.lead.id ? result.lead : item)),
        );
        succeeded += 1;
      } catch {
        failed += 1;
      }
      setActionProgress({ done: index + 1, total: targets.length });
    }

    setBulkAction(null);
    setActionProgress(null);
    notifyLeadsChanged();

    if (failed) {
      toast.error(
        `Drafted ${succeeded} pitch${succeeded === 1 ? "" : "es"}. ${failed} failed — check your Gemini key and website URLs.`,
      );
    } else {
      toast.success(`Drafted ${succeeded} pitch${succeeded === 1 ? "" : "es"}.`);
    }
  }

  async function sendPitches() {
    const targets = imported.filter(
      (lead) => Boolean(lead.email && lead.email_subject && lead.email_body),
    );
    if (!targets.length) {
      toast.error("No imported lead has both a public email and a generated pitch yet.");
      return;
    }

    const skipped = imported.length - targets.length;
    const confirmed = window.confirm(
      `Send ${targets.length} cold email${targets.length === 1 ? "" : "s"} now?${
        skipped
          ? ` ${skipped} lead${skipped === 1 ? "" : "s"} will be skipped for missing email or pitch.`
          : ""
      }`,
    );
    if (!confirmed) return;

    setBulkAction("send");
    setActionProgress({ done: 0, total: targets.length });
    let succeeded = 0;
    let failed = 0;

    for (const [index, lead] of targets.entries()) {
      try {
        const result = await apiPost<EmailResponse>("/api/send-email", {
          leadId: lead.id,
        });
        setImported((current) =>
          current.map((item) => (item.id === result.lead.id ? result.lead : item)),
        );
        succeeded += 1;
      } catch {
        failed += 1;
      }
      setActionProgress({ done: index + 1, total: targets.length });
    }

    setBulkAction(null);
    setActionProgress(null);
    notifyLeadsChanged();

    if (failed) {
      toast.error(`Sent ${succeeded} email${succeeded === 1 ? "" : "s"}. ${failed} failed.`);
    } else {
      toast.success(`Sent ${succeeded} email${succeeded === 1 ? "" : "s"}.`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI prospecting"
        title="Find your next customers"
        description="Describe your ideal customer. The discovery agent searches the live web with Gemini and Google Search (with an OpenStreetMap fallback), then imports verified prospects straight into your pipeline."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/leads">
              <Users />
              Lead manager
            </Link>
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="size-4 text-primary" /> Discovery brief
            </CardTitle>
            <CardDescription>
              The more specific the brief, the better the prospects. Niche or a written brief is
              required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="discovery-niche">Niche / industry</Label>
                  <Input
                    id="discovery-niche"
                    list="discovery-niches"
                    value={niche}
                    onChange={(event) => setNiche(event.target.value)}
                    placeholder="Dental clinic"
                  />
                  <datalist id="discovery-niches">
                    {NICHES.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discovery-location">Location</Label>
                  <Input
                    id="discovery-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Austin, TX"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="discovery-count">How many leads</Label>
                  <Input
                    id="discovery-count"
                    type="number"
                    min={DISCOVERY_MIN_COUNT}
                    max={DISCOVERY_MAX_COUNT}
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                  />
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Between {DISCOVERY_MIN_COUNT} and {DISCOVERY_MAX_COUNT}. Each result is verified
                  against live search results; the agent returns fewer rather than inventing leads.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="discovery-prompt">Describe your ideal customer (optional)</Label>
                <Textarea
                  id="discovery-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                  placeholder="Independent dental clinics with no online booking and a dated website. Prefer owner-operated practices with a public email."
                />
                <div className="flex flex-wrap gap-1.5">
                  {DISCOVERY_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setPrompt(example)}
                      className="rounded-full border border-border/80 bg-background/40 px-2 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Uses your Gemini key with Google Search grounding, plus a free OpenStreetMap
                  fallback when Gemini is unavailable. Contact details are only included when
                  publicly listed — verify before sending.
                </p>
                <Button type="submit" disabled={searching} className="shrink-0">
                  {searching ? <Loader2 className="animate-spin" /> : <Search />}
                  {searching ? "Searching the web…" : "Find leads"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" /> Today&apos;s quota
              </CardTitle>
              <CardDescription>Imports count toward your daily lead target.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Leads added today</span>
                <span className="font-mono">
                  {todayCount ?? "—"}
                  <span className="text-muted-foreground">/{quota}</span>
                </span>
              </div>
              <Progress
                value={quota ? ((todayCount ?? 0) / quota) * 100 : 0}
                indicatorClassName="bg-sky-400"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {remaining > 0
                  ? `${remaining} slot${remaining === 1 ? "" : "s"} left today.`
                  : "Quota reached. Import tomorrow or raise it in Settings."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> How the agent works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  title: "Search",
                  detail:
                    "Gemini runs live Google Search queries across your niche and location, with an OpenStreetMap fallback.",
                },
                {
                  title: "Verify",
                  detail:
                    "Only real businesses found in results survive. Contact details must be public.",
                },
                {
                  title: "Import",
                  detail:
                    "Selected prospects land in Discovered, ready for the existing pitch and email flow.",
                },
              ].map((step, index) => (
                <div key={step.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[9px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[11px] font-medium">{step.title}</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {searchError ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-xs font-medium text-destructive">Discovery failed</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{searchError}</p>
          </div>
        </div>
      ) : null}

      {searching ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Searching the live web for matching businesses…
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              This can take up to a minute. The agent is verifying results, not guessing.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hasSearched && !searching && !searchError && results.length === 0 && imported.length === 0 ? (
        <EmptyState
          icon={<Radar />}
          title="No prospects to review"
          description={
            notice ?? "Try a broader niche, a nearby location, or fewer constraints in your brief."
          }
          action={
            <Button size="sm" variant="outline" onClick={() => setHasSearched(false)}>
              Adjust the brief
            </Button>
          }
        />
      ) : null}

      {results.length ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" /> Review discovered leads
              </CardTitle>
              <CardDescription>
                {notice ??
                  `${results.length} prospect${results.length === 1 ? "" : "s"} found. Uncheck anything that looks off, then import.`}
              </CardDescription>
            </div>
            <Badge variant="info" className="shrink-0">
              {results.length} found
            </Badge>
          </CardHeader>

          <div className="flex items-center justify-between border-y border-border/70 bg-background/30 px-4 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-emerald-400"
                checked={results.length > 0 && selectedCount === results.length}
                onChange={toggleAll}
              />
              Select all
            </label>
            <span className="text-[10px] text-muted-foreground">
              {selectedCount} selected
            </span>
          </div>

          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {results.map((lead, index) => (
                <div
                  key={`${lead.business_name}-${index}`}
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.business_name}`}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-emerald-400"
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium">{lead.business_name}</p>
                      {lead.niche ? <Badge variant="secondary">{lead.niche}</Badge> : null}
                      {lead.email ? null : (
                        <Badge variant="warning">
                          <Mail /> No email
                        </Badge>
                      )}
                      {lead.website ? (
                        <Badge variant="outline">
                          <Globe /> Site
                        </Badge>
                      ) : null}
                    </div>
                    {lead.notes ? (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {lead.notes}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      {lead.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {lead.location}
                        </span>
                      ) : null}
                      {lead.email ? <span className="truncate">{lead.email}</span> : null}
                      {lead.phone ? <span>{lead.phone}</span> : null}
                      {lead.website ? (
                        <span className="truncate">{websiteLabel(lead.website)}</span>
                      ) : null}
                      {lead.source ? (
                        <a
                          href={lead.source}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Globe className="size-3" /> source
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {remaining > 0
                  ? `${remaining} slot${remaining === 1 ? "" : "s"} left today. Imported leads land in Discovered with the discovery context attached as notes.`
                  : "Today's quota is full. You can still review results, but importing is disabled."}
              </p>
              <Button
                onClick={() => void handleImport()}
                disabled={
                  importing || selectedCount === 0 || remaining === 0 || selectedCount > remaining
                }
                className="shrink-0"
              >
                {importing ? <Loader2 className="animate-spin" /> : <Users />}
                Import {selectedCount || ""} lead{selectedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasSearched && !searching && !searchError && results.length === 0 && imported.length > 0 ? (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            <p className="text-[11px] text-muted-foreground">
              Every discovered lead has been imported. Keep them moving in the outreach queue
              below.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {imported.length ? (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Send className="size-4 text-primary" /> Outreach queue
                </CardTitle>
                <CardDescription>
                  Draft pitches with Gemini, then send through your Resend account. Only leads with
                  a public email and a pitch are emailed.
                </CardDescription>
              </div>
              <Badge variant="success" className="shrink-0">
                {imported.length} imported
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void draftPitches()}
                disabled={bulkAction !== null || draftTargets.length === 0}
              >
                {bulkAction === "draft" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                Draft pitches ({draftTargets.length})
              </Button>
              <Button
                size="sm"
                onClick={() => void sendPitches()}
                disabled={bulkAction !== null || sendTargets.length === 0}
              >
                {bulkAction === "send" ? <Loader2 className="animate-spin" /> : <Send />}
                Send emails ({sendTargets.length})
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/dashboard/leads">
                  Lead manager <ArrowRight />
                </Link>
              </Button>
            </div>

            {actionProgress ? (
              <div className="space-y-1.5 pt-1">
                <Progress
                  value={
                    actionProgress.total
                      ? (actionProgress.done / actionProgress.total) * 100
                      : 0
                  }
                  indicatorClassName={bulkAction === "send" ? "bg-violet-400" : "bg-sky-400"}
                />
                <p className="text-[10px] text-muted-foreground">
                  {bulkAction === "send" ? "Sending" : "Drafting"} {actionProgress.done} of{" "}
                  {actionProgress.total}…
                </p>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-2">
            {imported.map((lead) => {
              const stage = STAGE_META[lead.stage];
              const hasPitch = Boolean(lead.email_subject && lead.email_body);
              return (
                <div
                  key={lead.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-medium">{lead.business_name}</p>
                      <Badge className={stage.badge}>{stage.short}</Badge>
                      {lead.email ? null : (
                        <Badge variant="warning">
                          <Mail /> No email
                        </Badge>
                      )}
                      {hasPitch ? (
                        <Badge variant="success">
                          <Sparkles /> Pitch ready
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No pitch</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {lead.email || "No public email found"}
                      {lead.location ? ` · ${lead.location}` : ""}
                    </p>
                  </div>
                  {hasPitch && lead.email ? (
                    <Badge variant="info" className="shrink-0">
                      <CheckCircle2 /> Ready to send
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
