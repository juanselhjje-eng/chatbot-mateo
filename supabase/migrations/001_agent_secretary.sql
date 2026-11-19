-- Ejecutar una sola vez en el SQL Editor del proyecto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.agent_escalations (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique not null,
  customer_phone text not null,
  customer_message text not null,
  owner_question text not null,
  owner_answer text,
  status text not null default 'pending' check (status in ('pending','answered','timed_out')),
  deadline_at timestamptz not null,
  answered_at timestamptz,
  timed_out_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_escalations_pending_deadline_idx
  on public.agent_escalations (deadline_at) where status = 'pending';

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_created_at_idx on public.agent_events (created_at desc);

create table if not exists public.agent_monitor_snapshots (
  monitor_name text primary key,
  state text not null,
  http_status integer,
  checked_at timestamptz not null default now()
);

-- Estas tablas solo deben consultarse desde el servidor con service_role.
alter table public.agent_escalations enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_monitor_snapshots enable row level security;
