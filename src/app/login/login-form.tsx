"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageCircle,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/brand";
import { SetupNotice } from "@/components/setup-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, configured } = useAuth();
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error");

  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState<"password" | "magic" | null>(null);
  const [checkEmail, setCheckEmail] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      router.replace(next.startsWith("/") ? next : "/dashboard");
    }
  }, [loading, user, next, router]);

  React.useEffect(() => {
    if (authError) toast.error(authError);
  }, [authError]);

  if (!configured) return <SetupNotice />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    setPending("password");

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setPending(null);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back.");
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: company },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setPending(null);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (data.session) {
      toast.success("Account created.");
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setCheckEmail(true);
    toast.success("Check your inbox to confirm your email.");
  }

  async function handleMagicLink() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    setPending("magic");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setPending(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCheckEmail(true);
    toast.success("Magic link sent. Check your inbox.");
  }

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      <div className="relative z-10 hidden w-[46%] flex-col justify-between border-r border-border/70 bg-card/30 p-10 lg:flex">
        <Brand />
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-[11px] text-primary">
            <Zap className="size-3" />
            Daily outbound operating system
          </div>
          <div className="space-y-4">
            <h1 className="max-w-md text-4xl font-semibold leading-[1.08] tracking-tight">
              Your next client is one <span className="text-gradient">honest audit</span> away.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              LeadPilot finds the gap, writes the pitch, sends the email, and keeps the deal moving.
              You stay in control of the conversation.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { icon: Sparkles, text: "AI Problem-to-Solution audits in seconds" },
              { icon: Mail, text: "Cold email through Resend or Gmail SMTP" },
              { icon: MessageCircle, text: "One-click WhatsApp for high-ticket leads" },
              { icon: Users, text: "50-lead daily quota with zero seat fees" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-background/60 text-primary">
                  <item.icon className="size-3.5" />
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          Next.js · Supabase · Gemini · Resend
        </p>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in to LeadPilot" : "Create your workspace"}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {mode === "signin"
                ? "Pick up where you left off. Your leads are waiting."
                : "One account, your own private pipeline. Takes 20 seconds."}
            </p>
          </div>

          {checkEmail ? (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.05] p-5">
              <div className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Mail className="size-4" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Check your email</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  We sent a confirmation link to <span className="text-foreground">{email}</span>.
                  Open it to finish signing in, then come back here.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCheckEmail(false)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "signup")}>
                <TabsList className="w-full">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>

                <TabsContent value={mode} className="pt-5">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "signup" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="fullName">Full name</Label>
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Alex Rivera"
                            autoComplete="name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="company">Studio / company</Label>
                          <Input
                            id="company"
                            value={company}
                            onChange={(event) => setCompany(event.target.value)}
                            placeholder="Rivera Labs"
                            autoComplete="organization"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@studio.com"
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "signup" ? (
                          <span className="text-[10px] text-muted-foreground">Min. 8 characters</span>
                        ) : null}
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={8}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={pending !== null}>
                      {pending === "password" ? <Loader2 className="animate-spin" /> : null}
                      {mode === "signin" ? "Sign in" : "Create account"}
                      {pending !== "password" ? <ArrowRight /> : null}
                    </Button>
                  </form>

                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleMagicLink}
                    disabled={pending !== null}
                  >
                    {pending === "magic" ? <Loader2 className="animate-spin" /> : <Mail />}
                    Email me a magic link
                  </Button>
                </TabsContent>
              </Tabs>

              <p className="text-center text-[10px] leading-relaxed text-muted-foreground/70">
                By continuing you agree to use LeadPilot responsibly and follow anti-spam laws in
                your region.
              </p>
            </>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Back to home
            </Link>
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Skip to app
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
