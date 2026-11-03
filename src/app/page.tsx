import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Database,
  Gauge,
  KanbanSquare,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";

import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const stack = ["Next.js 16", "Supabase", "Gemini 2.5 Flash", "Resend", "WhatsApp", "Vercel"];

const workflow = [
  {
    icon: Users,
    title: "Ingest 50 leads",
    body: "Paste a CSV or add prospects manually with niche, website, email, and phone. The daily quota keeps you honest.",
  },
  {
    icon: Sparkles,
    title: "Audit the gap",
    body: "Gemini analyzes each business's digital bottleneck and writes a Problem-to-Solution pitch in seconds.",
  },
  {
    icon: Send,
    title: "Hit both channels",
    body: "Auto-send personalized cold email for volume. Flag high-ticket targets and open a pre-filled WhatsApp chat.",
  },
  {
    icon: KanbanSquare,
    title: "Close in the CRM",
    body: "Drag leads across six stages, log activity automatically, and keep every deal moving toward Closed/Won.",
  },
];

const features = [
  {
    icon: Bot,
    title: "Structured AI pitches",
    body: "Enforced JSON output: problem, opportunity, subject, email body, and a short WhatsApp opener.",
  },
  {
    icon: Mail,
    title: "One-click cold email",
    body: "Send through Resend's free tier or Gmail SMTP. Every send updates the lead stage and activity log.",
  },
  {
    icon: MessageCircle,
    title: "Zero-ban WhatsApp",
    body: "No automation, no ban risk. wa.me deep links open a pre-filled message in WhatsApp Web or mobile.",
  },
  {
    icon: KanbanSquare,
    title: "Drag-and-drop pipeline",
    body: "Discovered to Closed/Won with automatic stage timestamps, activity history, and deal values.",
  },
  {
    icon: Gauge,
    title: "Daily focus quota",
    body: "A 50-lead daily target with live progress, so output stays high without burning out.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Supabase Row Level Security means every lead and activity is scoped to your account — no exceptions.",
  },
];

const stages = [
  { label: "Discovered", count: 18, color: "bg-sky-400" },
  { label: "Email Pitched", count: 14, color: "bg-violet-400" },
  { label: "WhatsApp", count: 7, color: "bg-emerald-400" },
  { label: "Follow-up", count: 5, color: "bg-amber-400" },
  { label: "Proposal", count: 3, color: "bg-orange-400" },
  { label: "Won", count: 2, color: "bg-teal-300" },
];

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[35%] h-[380px] w-[380px] rounded-full bg-teal-500/5 blur-[120px]" />

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">
            Workflow
          </a>
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#stack" className="transition-colors hover:text-foreground">
            Stack
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard">
              Open app
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
          <div className="space-y-7">
            <Badge variant="outline" className="gap-2 border-primary/25 bg-primary/[0.06] py-1 pl-1.5 pr-3 text-primary">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px]">$0</span>
              Fixed monthly cost. Seriously.
            </Badge>
            <div className="space-y-5">
              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Turn 50 cold leads a day into{" "}
                <span className="text-gradient">signed deals.</span>
              </h1>
              <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                LeadPilot is a high-productivity lead engine for developers and agencies. Audit a
                business&apos;s digital gaps, generate a personalized Problem-to-Solution pitch, send
                it, and track the deal — all from one focused workspace.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/dashboard">
                  Start prospecting
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how">See the workflow</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> Free-tier APIs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" /> Installable PWA
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-emerald-500/5 blur-2xl" />
            <Card className="relative overflow-hidden rounded-2xl border-border/80 bg-card/80 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <KanbanSquare className="size-3.5 text-primary" />
                  Pipeline
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] text-muted-foreground">Live preview</span>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-3 gap-2">
                  {stages.slice(0, 3).map((stage) => (
                    <div key={stage.label} className="rounded-lg border border-border/70 bg-background/40 p-2.5">
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${stage.color}`} />
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                          {stage.label}
                        </span>
                      </div>
                      <p className="text-lg font-semibold">{stage.count}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {[
                    { name: "Bright Smile Dental", tag: "Hot", tone: "text-orange-300 border-orange-400/30 bg-orange-400/10" },
                    { name: "Peak Fitness Studio", tag: "AI audit", tone: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" },
                    { name: "Northside Law Group", tag: "Email", tone: "text-violet-300 border-violet-400/30 bg-violet-400/10" },
                  ].map((lead, index) => (
                    <div
                      key={lead.name}
                      className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 p-3"
                    >
                      <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-300/20 to-teal-500/10 text-[10px] font-semibold text-primary">
                        {lead.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{lead.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {index === 0 ? "No online booking" : index === 1 ? "Bookings via DMs" : "Outdated site"}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${lead.tone}`}>
                        {lead.tag}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3" /> AI pitch
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    &ldquo;I noticed patients can&apos;t book after hours. A simple scheduling flow
                    could recover those missed appointments…&rdquo;
                  </p>
                </div>
              </div>
            </Card>
            <div className="absolute -bottom-4 -left-4 hidden rounded-xl border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur sm:block">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Today</p>
              <p className="text-sm font-semibold">
                42<span className="text-muted-foreground">/50 leads</span>
              </p>
            </div>
            <div className="absolute -right-3 top-16 hidden rounded-xl border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur sm:block">
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
                <MessageCircle className="size-3" /> WhatsApp ready
              </p>
            </div>
          </div>
        </section>

        <section id="stack" className="border-y border-border/60 bg-card/20">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Built on a $0 stack
            </span>
            {stack.map((item) => (
              <span key={item} className="text-xs font-medium text-muted-foreground/80">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              The daily loop
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              A repeatable machine for outbound.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No bloated CRM. No $99/month sequencer. Just the four steps that actually move a
              prospect from stranger to signed client.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((step, index) => (
              <Card key={step.title} className="relative overflow-hidden">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <step.icon className="size-4" />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="relative overflow-hidden border-violet-400/15 bg-gradient-to-br from-violet-500/[0.06] to-transparent">
              <CardContent className="space-y-4 p-6">
                <Badge variant="outline" className="border-violet-400/25 bg-violet-400/10 text-violet-300">
                  Volume play · ~45/day
                </Badge>
                <h3 className="text-xl font-semibold">Standard leads go by email</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Generate a specific, human-sounding pitch and send it through Resend or Gmail
                  SMTP. Each send is logged and moves the lead into the Email Pitched stage
                  automatically.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {["Personalized subject + body", "Structured JSON from Gemini", "Automatic activity log"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="size-3.5 text-violet-300" /> {item}
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.07] to-transparent">
              <CardContent className="space-y-4 p-6">
                <Badge variant="outline" className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                  High-ticket · manual
                </Badge>
                <h3 className="text-xl font-semibold">Whales get a WhatsApp DM</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Flag a lead as high-ticket and the UI surfaces a one-click wa.me deep link. It
                  opens a pre-filled, short message in WhatsApp Web — zero cost, zero automation,
                  zero ban risk.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {["Pre-filled opener under 55 words", "No unofficial API or session hacks", "Stage updates when you open the chat"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="size-3.5 text-emerald-300" /> {item}
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-card/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Everything included
                </p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Built for speed, not seat licenses.
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="size-4 text-primary" />
                Engineer-led outbound
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="transition-colors hover:border-primary/25">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                      <feature.icon className="size-4" />
                    </div>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{feature.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <Card className="relative overflow-hidden border-primary/20">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[100px]" />
            <CardContent className="relative flex flex-col items-center gap-5 px-6 py-14 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <Zap className="size-5" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Fifty leads. One focused hour.
                </h2>
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Set up your Supabase project, drop in a Gemini key, and start running the daily
                  outbound loop today. The whole stack fits on free tiers.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/dashboard">
                    Launch LeadPilot
                    <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Create an account</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Database className="size-3" /> Supabase RLS
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="size-3" /> Gemini structured JSON
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3" /> Resend + SMTP
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-[11px] text-muted-foreground sm:flex-row sm:px-6">
          <Brand />
          <p>Built for developers who would rather ship than buy another subscription.</p>
        </div>
      </footer>
    </div>
  );
}
