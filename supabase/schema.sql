-- Multi-Agent LLM Council — Supabase schema
--
-- Run this once against your Supabase project (SQL Editor → New query → paste → Run)
-- to provision the tables used when DB_PROVIDER=supabase.
--
-- The app connects with the SERVICE ROLE key from the server only, so Row Level
-- Security is not required for the app to function. RLS is enabled with no
-- policies as a safety default: it blocks the public anon/auth keys while the
-- service-role key (used by the Next.js server) bypasses RLS entirely.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id                text         primary key,
  email             text         not null,
  name              text         not null,
  password_hash     text         not null,
  provider_settings jsonb        not null default '{}'::jsonb,
  preferred_models  jsonb        not null default '[]'::jsonb,
  created_at        timestamptz  not null default now()
);

-- Case-insensitive unique email (registration lowercases before storing).
create unique index if not exists idx_users_email
  on public.users (lower(email));

alter table public.users enable row level security;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              text         primary key,
  title           text         not null,
  mode_id         text         not null,
  user_id         text         not null,
  user_input      text         not null,
  agent_responses jsonb        not null default '[]'::jsonb,
  judge_response  jsonb,
  final_report    jsonb        not null default '{}'::jsonb,
  created_at      timestamptz  not null default now()
);

create index if not exists idx_conversations_user_id
  on public.conversations (user_id, created_at desc);

alter table public.conversations enable row level security;
