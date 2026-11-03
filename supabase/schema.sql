-- LeadPilot — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query → Run).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company_name text,
  sender_title text,
  default_niche text,
  daily_quota integer not null default 50 check (daily_quota between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  niche text,
  website text,
  email text,
  phone text,
  location text,
  notes text,
  stage text not null default 'discovered' check (
    stage in (
      'discovered',
      'email_pitched',
      'whatsapp_pitched',
      'follow_up',
      'proposal_sent',
      'closed_won'
    )
  ),
  high_ticket boolean not null default false,
  deal_value numeric(12, 2),
  problem text,
  opportunity text,
  email_subject text,
  email_body text,
  whatsapp_message text,
  ai_generated_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_user_created_idx
  on public.leads (user_id, created_at desc);
create index if not exists leads_user_stage_idx
  on public.leads (user_id, stage);
create index if not exists leads_user_hot_idx
  on public.leads (user_id, high_ticket)
  where high_ticket = true;

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);
create index if not exists activities_lead_idx
  on public.activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Per-user integration settings (bring-your-own API keys)
-- Protected by RLS: a user can only ever read or write their own row.
-- The app never renders saved secrets back to the browser.
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gemini_api_key text,
  resend_api_key text,
  email_from text,
  gemini_configured boolean not null default false,
  resend_configured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

create or replace function public.set_user_settings_flags()
returns trigger
language plpgsql
as $$
begin
  new.gemini_configured := new.gemini_api_key is not null and length(btrim(new.gemini_api_key)) > 0;
  new.resend_configured := new.resend_api_key is not null and length(btrim(new.resend_api_key)) > 0;
  return new;
end;
$$;

drop trigger if exists set_user_settings_flags on public.user_settings;
create trigger set_user_settings_flags
  before insert or update on public.user_settings
  for each row execute function public.set_user_settings_flags();

-- ---------------------------------------------------------------------------
-- Auto-create a profile for each new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill settings for accounts created before this table existed.
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
  for select using (auth.uid() = user_id);

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads
  for insert with check (auth.uid() = user_id);

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads
  for delete using (auth.uid() = user_id);

drop policy if exists "activities_select_own" on public.activities;
create policy "activities_select_own" on public.activities
  for select using (auth.uid() = user_id);

drop policy if exists "activities_insert_own" on public.activities;
create policy "activities_insert_own" on public.activities
  for insert with check (auth.uid() = user_id);

drop policy if exists "activities_delete_own" on public.activities;
create policy "activities_delete_own" on public.activities
  for delete using (auth.uid() = user_id);

drop policy if exists "user_settings_manage_own" on public.user_settings;
create policy "user_settings_manage_own" on public.user_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
revoke all on public.profiles from anon;
revoke all on public.leads from anon;
revoke all on public.activities from anon;
revoke all on public.user_settings from anon;
