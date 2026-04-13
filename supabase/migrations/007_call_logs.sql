-- ============================================================
-- Call Logs (CDR) — records every completed call
-- Run this in Supabase SQL Editor.
-- ============================================================

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  caller text not null,            -- extension or phone number
  callee text not null,            -- extension or phone number
  status text not null default 'answered'
    check (status in ('answered', 'missed', 'busy', 'failed', 'no_answer')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_secs int not null default 0,   -- talk time in seconds
  trunk_name text,                 -- null for internal calls
  channel_id text,                 -- Asterisk uniqueid for dedup
  created_at timestamptz default now()
);

alter table public.call_logs enable row level security;

-- RLS: tenants see only their own logs
create policy "Tenant isolation: select call_logs"
  on public.call_logs for select
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: insert call_logs"
  on public.call_logs for insert
  with check (tenant_id = public.get_tenant_id());

-- Index for fast queries
create index idx_call_logs_tenant_started on public.call_logs (tenant_id, started_at desc);
create unique index idx_call_logs_channel_id on public.call_logs (channel_id) where channel_id is not null;

-- Auto-update trigger not needed — logs are immutable once written.

-- Grant sync agent access (it will INSERT logs from Asterisk CDR)
grant select, insert on public.call_logs to asterisk_ro;

drop policy if exists "asterisk_ro can read all call_logs" on public.call_logs;
create policy "asterisk_ro can read all call_logs"
  on public.call_logs
  for select
  to asterisk_ro
  using (true);

drop policy if exists "asterisk_ro can insert call_logs" on public.call_logs;
create policy "asterisk_ro can insert call_logs"
  on public.call_logs
  for insert
  to asterisk_ro
  with check (true);
