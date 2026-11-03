import Link from "next/link";
import { ArrowRight, Database, KeyRound, Mail, Sparkles } from "lucide-react";

import { Brand } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    icon: Database,
    title: "Create the database",
    body: "Create a free Supabase project, open the SQL editor, and run supabase/schema.sql. It provisions RLS, profiles, leads, activities, and per-user settings.",
    link: "https://supabase.com/dashboard",
    linkLabel: "Open Supabase",
  },
  {
    icon: KeyRound,
    title: "Add the Supabase keys",
    body: "Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    link: "https://supabase.com/dashboard/project/_/settings/api",
    linkLabel: "Find your API keys",
  },
  {
    icon: Mail,
    title: "Optional: shared AI + email keys",
    body: "Add workspace GEMINI_API_KEY and Resend keys for everyone, or let each user bring their own in Settings → Your API keys.",
    link: "https://aistudio.google.com/app/apikey",
    linkLabel: "Get a Gemini key",
  },
];

export function SetupNotice() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[680px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="relative w-full max-w-2xl space-y-6">
        <Brand href="/" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Finish setup to launch LeadPilot</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Supabase is the only required service. Once it is connected, users can sign up and
            add their own Gemini and Resend keys from Settings — no local setup for them. This
            takes about five minutes and costs $0.
          </p>
        </div>

        <div className="grid gap-3">
          {steps.map((step, index) => (
            <Card key={step.title}>
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                  <step.icon className="size-4" />
                </div>
                <div className="space-y-1">
                  <CardTitle>
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {step.title}
                  </CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <Link
                  href={step.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {step.linkLabel}
                  <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              After saving <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">.env.local</code>,
              restart the dev server. Each signed-in user can then add personal API keys in
              Settings. Full instructions are in the README.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
