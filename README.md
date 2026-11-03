# LeadPilot

A multi-tenant lead generation and CRM SaaS. Users sign up, work inside their own row-level-secured workspace, bring their own Gemini and Resend keys, and immediately start ingesting leads, generating AI pitches, sending cold email, and moving deals through a drag-and-drop pipeline.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase (Auth + Postgres + RLS), Google Gemini 2.5 Flash, Resend/SMTP, and a PWA shell.

## Features

- Multi-tenant accounts: every lead, activity, profile, and setting row is isolated with row-level security.
- Email + password and magic-link authentication with Supabase, protected dashboard routes.
- Bring-your-own-key settings: each user can store a Gemini key, Resend key, and verified sender without touching environment files.
- AI lead discovery: describe a niche/location or an ideal customer, and Gemini searches the live web with Google Search grounding for real businesses with publicly listed contact details. If Gemini grounding is unavailable or rate-limited, discovery falls back to the free OpenStreetMap directory.
- Discovery review and import: inspect found prospects, select the good ones, and save them straight into Supabase (quota-aware) with duplicate detection against existing leads.
- Lead manager with search, stage, niche, and high-ticket filters, plus CSV import with preview.
- Per-lead workspace: editable profile, AI pitch, activity timeline, private notes, stage changes.
- Website audit: guarded homepage fetch extracts conversion signals (CTA, booking, reviews, forms, page weight), then Gemini writes problem/opportunity/email/WhatsApp copy.
- Cold email sending through each user's Resend account, with workspace Resend/SMTP as a fallback, plus reply-to and activity logging.
- WhatsApp deep links prefilled with the generated pitch, auto-advancing stages.
- Kanban pipeline with drag-and-drop, stage totals, win rate, and value tracking.
- Daily quota enforcement (default 50) with progress on the dashboard and in add/import dialogs.
- Installable PWA with an offline fallback page.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the UI loads in setup mode and explains what is missing. Supabase is the only required service; AI and email keys can be workspace-wide or supplied per user.

## 1. Supabase setup

1. Create a free project at https://supabase.com.
2. Open the SQL editor and run the contents of `supabase/schema.sql`. It creates:
   - `profiles` (one row per auth user, auto-created on signup)
   - `leads` (stage, high-ticket flag, deal value, AI pitch fields)
   - `activities` (audit, email, WhatsApp, stage change, note log)
   - `user_settings` (per-user encrypted-at-rest API keys and sender identity)
   - indexes, `updated_at` triggers, and row-level security policies scoped to `auth.uid()`
3. If you already ran an older schema, run the full updated file again. It adds `user_settings` and provisions a settings row for every new signup.
4. In Authentication -> Providers, keep Email enabled. For local development you can disable "Confirm email" so signup logs you in immediately.
5. In Authentication -> URL Configuration set:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
6. Copy the project URL and anon key into `.env.local`.

## 2. Gemini setup (workspace or per user)

Either:

- Per user: each user signs in, opens Settings → **Your API keys**, and saves a free key from https://aistudio.google.com/apikey. No redeploy needed.
- Workspace: set `GEMINI_API_KEY` in the environment as a shared fallback. The default model is `gemini-2.5-flash`; override with `GEMINI_MODEL`.

Personal keys always take priority over the workspace key.

The AI lead discovery agent uses the same Gemini key with Google Search grounding enabled. It only returns businesses and contact details that appear in live search results. When Gemini is missing, out of quota, or cannot use grounding, the agent falls back to the public OpenStreetMap Nominatim directory; those results are labelled in the UI and should be verified before outreach.

## 3. Email setup (workspace or per user)

Per user (recommended for SaaS):

- Settings → **Your API keys** → save a Resend API key and a verified sender such as `Your Name <you@yourdomain.com>`. The sender must be a verified Resend domain (or the account owner's address while testing).

Workspace fallback:

- Resend: set `RESEND_API_KEY` and `EMAIL_FROM`.
- SMTP: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Port 465 uses implicit TLS; other ports use STARTTLS.

Personal Resend takes priority; SMTP is used when no Resend key exists. `EMAIL_REPLY_TO` defaults to the signed-in user's email. Visit Settings to see effective integration status.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (or set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead) |
| `GEMINI_API_KEY` | Optional | Shared AI fallback; users can BYOK |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `RESEND_API_KEY` | Optional | Shared email fallback; users can BYOK |
| `EMAIL_FROM` | Optional | Shared verified sender identity |
| `EMAIL_REPLY_TO` | No | Overrides reply-to address |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Optional | Workspace SMTP fallback |
| `NEXT_PUBLIC_APP_URL` | Yes (production) | Canonical app URL, e.g. `https://your-app.vercel.app` |

## Using the app

1. Create an account and complete Settings (name, company, sender title, niche, daily quota).
2. Under **Your API keys**, add a Gemini key and optionally a Resend key + verified sender, unless the workspace already provides them.
3. Open **Discover**, enter a niche and location (or write a short ideal-customer brief), and run the agent. Review the results, uncheck anything that looks off, then import the rest.
4. From the imported outreach queue, draft pitches for the batch, then send emails to everyone with a public address. You can also add leads manually or import a CSV (`business_name,nickname,website,email,phone,location,notes,high_ticket,deal_value`; only `business_name` is required).
5. Open a lead and run **Generate pitch**. The audit fetches the site safely, then Gemini drafts the email and WhatsApp script.
6. Send the cold email, open the WhatsApp link, and log notes as you go.
7. Work the pipeline: drag cards across stages or use the advance button. Every move writes an activity entry.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
```

## Project structure

```
src/
  app/
    api/{discover-leads,generate-pitch,send-email,health}/   Route handlers
    auth/callback/                            Supabase code exchange
    dashboard/{discover,leads,pipeline,settings}/  Authenticated workspace
    login/                                    Auth screen
  components/
    leads/                                    Add, import, and detail dialogs
    ui/                                       Design-system primitives
  hooks/use-lead-actions.ts                   Pitch, email, WhatsApp actions
  lib/
    data.ts                                   Typed Supabase CRUD
    discovery.ts                              Gemini + Google Search discovery, OSM fallback
    user-integrations.ts                      Server-only BYOK resolution
    gemini.ts                                 Prompt + structured output schema
    website-audit.ts                          SSRF-guarded site audit
    email.ts                                  Resend + SMTP delivery
supabase/schema.sql                           Database schema and RLS
public/sw.js                                  Service worker
```

## Security notes

- Every table, including `user_settings`, uses row-level security scoped to the authenticated user.
- Personal API keys are stored in the user's private `user_settings` row and are never returned to the browser after saving. Server routes read them with the signed-in user's session, then fall back to workspace keys.
- Supabase encrypts data at rest, but stored keys are not end-to-end encrypted. Use restricted, rotatable keys and remove them from Settings when no longer needed.
- Website audits resolve DNS, block private/loopback ranges, cap redirects and body size, and time out after six seconds.
- API routes require an authenticated session and validate payloads with zod.
- Public `NEXT_PUBLIC_*` values are safe to expose; all other secrets stay server-side.

## Deploy to Vercel

1. Push the repository to GitHub, then import it at https://vercel.com/new. Vercel detects Next.js automatically; no `vercel.json` is required.
2. Add these Production environment variables:
   - Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (your Vercel URL).
   - Optional workspace fallbacks: `GEMINI_API_KEY`, `GEMINI_MODEL`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
3. In Supabase → Authentication → URL Configuration, set **Site URL** to `https://your-app.vercel.app` and add `https://your-app.vercel.app/auth/callback` as a redirect URL.
4. Run `supabase/schema.sql` in the production Supabase SQL editor if this is a new project.
5. Deploy, then install the PWA from the browser (Install app / Add to Home Screen). The service worker only registers in production builds and caches the app shell for offline visits.
