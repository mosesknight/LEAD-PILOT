"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Gauge,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Plug,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_DAILY_QUOTA, NICHES } from "@/lib/constants";
import { fetchUserSettingsStatus, saveUserSettings } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile, UserSettingsInput, UserSettingsStatus } from "@/lib/types";

interface HealthStatus {
  supabase: boolean;
  gemini: boolean;
  resend: boolean;
  smtp: boolean;
  emailFrom: boolean;
  model: string;
}

interface ProfileForm {
  full_name: string;
  company_name: string;
  sender_title: string;
  default_niche: string;
  daily_quota: string;
}

const EMPTY_FORM: ProfileForm = {
  full_name: "",
  company_name: "",
  sender_title: "",
  default_niche: "none",
  daily_quota: String(DEFAULT_DAILY_QUOTA),
};

function toForm(profile: Profile | null): ProfileForm {
  if (!profile) return EMPTY_FORM;
  return {
    full_name: profile.full_name ?? "",
    company_name: profile.company_name ?? "",
    sender_title: profile.sender_title ?? "",
    default_niche: profile.default_niche ?? "none",
    daily_quota: String(profile.daily_quota ?? DEFAULT_DAILY_QUOTA),
  };
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[11px]">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusRow({
  label,
  detail,
  ok,
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={ok ? "success" : "outline"} className="shrink-0">
        {ok ? "Ready" : "Missing"}
      </Badge>
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [form, setForm] = React.useState<ProfileForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [health, setHealth] = React.useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [keyStatus, setKeyStatus] = React.useState<UserSettingsStatus | null>(null);
  const [keysLoading, setKeysLoading] = React.useState(true);
  const [keysError, setKeysError] = React.useState<string | null>(null);
  const [savingKeys, setSavingKeys] = React.useState(false);
  const [clearingKey, setClearingKey] = React.useState<"gemini" | "resend" | null>(null);
  const [keys, setKeys] = React.useState({ gemini: "", resend: "", emailFrom: "" });

  React.useEffect(() => {
    const timer = window.setTimeout(() => setForm(toForm(profile)), 0);
    return () => window.clearTimeout(timer);
  }, [profile]);

  const loadHealth = React.useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Health check failed.");
      setHealth((await response.json()) as HealthStatus);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadHealth(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHealth]);

  const loadKeys = React.useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      const status = await fetchUserSettingsStatus(supabase, user.id);
      setKeyStatus(status);
      setKeys((current) => ({ ...current, emailFrom: status?.email_from ?? "" }));
      setKeysError(null);
    } catch {
      setKeysError("Run the updated supabase/schema.sql to enable personal API keys.");
    } finally {
      setKeysLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadKeys(), 0);
    return () => window.clearTimeout(timer);
  }, [loadKeys]);

  async function handleSaveKeys(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const patch: UserSettingsInput = { email_from: keys.emailFrom.trim() || null };
    if (keys.gemini.trim()) patch.gemini_api_key = keys.gemini.trim();
    if (keys.resend.trim()) patch.resend_api_key = keys.resend.trim();

    setSavingKeys(true);
    try {
      const status = await saveUserSettings(supabase, user.id, patch);
      setKeyStatus(status);
      setKeys({ gemini: "", resend: "", emailFrom: status.email_from ?? "" });
      setKeysError(null);
      toast.success("API keys saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save API keys.");
    } finally {
      setSavingKeys(false);
    }
  }

  async function handleClearKey(field: "gemini" | "resend") {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setClearingKey(field);
    try {
      const status = await saveUserSettings(
        supabase,
        user.id,
        field === "gemini" ? { gemini_api_key: null } : { resend_api_key: null },
      );
      setKeyStatus(status);
      toast.success(field === "gemini" ? "Gemini key removed." : "Resend key removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the key.");
    } finally {
      setClearingKey(null);
    }
  }

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      toast.error("Supabase is not configured. Add your environment variables first.");
      return;
    }

    const quota = Number.parseInt(form.daily_quota, 10);
    if (!Number.isFinite(quota) || quota < 1 || quota > 500) {
      toast.error("Daily quota must be between 1 and 500.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: form.full_name.trim() || null,
      company_name: form.company_name.trim() || null,
      sender_title: form.sender_title.trim() || null,
      default_niche: form.default_niche === "none" ? null : form.default_niche,
      daily_quota: quota,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await refreshProfile();
    toast.success("Settings saved.");
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  const userGemini = Boolean(keyStatus?.gemini_configured);
  const userResend = Boolean(keyStatus?.resend_configured);
  const effectiveResend = userResend || Boolean(health?.resend);
  const effectiveFrom = Boolean(keyStatus?.email_from || health?.emailFrom || effectiveResend);
  const emailReady = Boolean((effectiveResend || health?.smtp) && effectiveFrom);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Workspace" title="Settings" description="Loading your workspace…" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-96 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Tune your sender identity, daily target, and integration health. These details feed every AI pitch."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4 text-primary" /> Sender profile
            </CardTitle>
            <CardDescription>
              Used to personalize audits and cold emails. Keep it short and human.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="full_name">
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(event) => update("full_name", event.target.value)}
                    placeholder="Moses Okoro"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Company" htmlFor="company_name" hint="Shown in the email signature.">
                  <Input
                    id="company_name"
                    value={form.company_name}
                    onChange={(event) => update("company_name", event.target.value)}
                    placeholder="LeadPilot Studio"
                    autoComplete="organization"
                  />
                </Field>
              </div>

              <Field
                label="Sender title"
                htmlFor="sender_title"
                hint="e.g. Conversion strategist. AI uses this to frame your authority."
              >
                <Input
                  id="sender_title"
                  value={form.sender_title}
                  onChange={(event) => update("sender_title", event.target.value)}
                  placeholder="Web growth strategist"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default niche" hint="Pre-fills new leads and pitch context.">
                  <Select
                    value={form.default_niche}
                    onValueChange={(value) => update("default_niche", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a niche" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default</SelectItem>
                      {NICHES.map((niche) => (
                        <SelectItem key={niche} value={niche}>
                          {niche}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Daily lead quota"
                  htmlFor="daily_quota"
                  hint="Enforced in add/import dialogs. 50 keeps quality high."
                >
                  <div className="relative">
                    <Gauge className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="daily_quota"
                      type="number"
                      min={1}
                      max={500}
                      value={form.daily_quota}
                      onChange={(event) => update("daily_quota", event.target.value)}
                      className="pl-8"
                    />
                  </div>
                </Field>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium">Personalization preview</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {form.full_name || "Your name"}
                      {form.sender_title ? `, ${form.sender_title}` : ""}
                      {form.company_name ? ` at ${form.company_name}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {form.default_niche === "none" ? "All niches" : form.default_niche}
                </Badge>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" /> Your API keys
            </CardTitle>
            <CardDescription>
              Bring your own keys. Personal keys are used before workspace defaults, so this
              account can run independently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {keysLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {keysError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {keysError}
                    </p>
                  </div>
                ) : null}

                <form onSubmit={handleSaveKeys} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gemini_key" className="text-[11px]">
                        Gemini API key
                      </Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={userGemini ? "success" : "outline"}>
                          {userGemini ? "Saved" : "Not set"}
                        </Badge>
                        {userGemini ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => void handleClearKey("gemini")}
                            disabled={clearingKey === "gemini"}
                          >
                            {clearingKey === "gemini" ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Trash2 />
                            )}
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="gemini_key"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={keys.gemini}
                        onChange={(event) =>
                          setKeys((current) => ({ ...current, gemini: event.target.value }))
                        }
                        placeholder={
                          userGemini
                            ? "•••••••••••• saved — paste a new key to replace"
                            : "AIza…"
                        }
                        className="pl-8 font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        Powers website audits and pitch generation.
                      </p>
                      <Link
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      >
                        Get a free key
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="resend_key" className="text-[11px]">
                        Resend API key
                      </Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={userResend ? "success" : "outline"}>
                          {userResend ? "Saved" : "Not set"}
                        </Badge>
                        {userResend ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => void handleClearKey("resend")}
                            disabled={clearingKey === "resend"}
                          >
                            {clearingKey === "resend" ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Trash2 />
                            )}
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="resend_key"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={keys.resend}
                        onChange={(event) =>
                          setKeys((current) => ({ ...current, resend: event.target.value }))
                        }
                        placeholder={
                          userResend
                            ? "•••••••••••• saved — paste a new key to replace"
                            : "re_…"
                        }
                        className="pl-8 font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        Sends cold email from your own Resend account.
                      </p>
                      <Link
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      >
                        Get a Resend key
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>

                  <Field
                    label="Sender email"
                    htmlFor="email_from"
                    hint="Must be a verified Resend sender. Example: Moses <moses@yourdomain.com>."
                  >
                    <Input
                      id="email_from"
                      value={keys.emailFrom}
                      onChange={(event) =>
                        setKeys((current) => ({ ...current, emailFrom: event.target.value }))
                      }
                      placeholder="Your Name <you@yourdomain.com>"
                      autoComplete="email"
                    />
                  </Field>

                  <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      Keys are stored in your private Supabase row, protected by row-level
                      security and encrypted at rest. Saved secrets are never shown again — rotate
                      them here anytime.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={savingKeys}>
                    {savingKeys ? <Loader2 className="animate-spin" /> : <Save />}
                    {savingKeys ? "Saving…" : "Save API keys"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Plug className="size-4 text-primary" /> Integration status
                </CardTitle>
                <CardDescription>
                  Effective providers for your account: personal keys first, then workspace
                  defaults.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setHealthLoading(true);
                  void loadHealth();
                }}
                title="Refresh status"
                disabled={healthLoading}
              >
                {healthLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {health ? (
                <>
                  <StatusRow
                    label="Supabase"
                    detail="Auth, database, and row-level security"
                    ok={health.supabase}
                  />
                  <StatusRow
                    label="Gemini"
                    detail={
                      userGemini
                        ? `Your key · ${health.model}`
                        : health.gemini
                          ? `Workspace key · ${health.model}`
                          : "Add your personal key above"
                    }
                    ok={userGemini || health.gemini}
                  />
                  <StatusRow
                    label="Resend"
                    detail={
                      userResend
                        ? "Sending from your Resend account"
                        : health.resend
                          ? "Workspace Resend key"
                          : "Add your personal key above"
                    }
                    ok={effectiveResend}
                  />
                  <StatusRow label="SMTP" detail="Workspace fallback for any mailbox" ok={health.smtp} />
                  <StatusRow
                    label="Sender address"
                    detail={
                      keyStatus?.email_from ||
                      (health.emailFrom
                        ? "Workspace EMAIL_FROM"
                        : effectiveResend
                          ? "Default Resend sender"
                          : "Add a verified sender above")
                    }
                    ok={effectiveFrom}
                  />
                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
                    <Mail className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {emailReady
                        ? "Cold email is ready. Personal keys take priority over workspace defaults."
                        : "Add your Resend key and verified sender above to send cold email. Workspace SMTP is used as a fallback when configured."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Could not reach the health endpoint. Confirm the app is running and reload.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Account
              </CardTitle>
              <CardDescription>Your private workspace credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-3">
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <p className="truncate text-xs">{user?.email ?? "—"}</p>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3" /> Member since
                  </span>
                  <span>{formatDate(profile?.created_at)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Target className="size-3" /> Daily target
                  </span>
                  <span>{profile?.daily_quota ?? DEFAULT_DAILY_QUOTA} leads</span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Row-level security is enabled. Every lead, activity, and profile row is scoped to
                  your user ID.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
              >
                {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
