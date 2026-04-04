-- ============================================
-- STEP 3: SIP Users, Trunks, Call Flows
-- Run this in Supabase SQL Editor AFTER 001
-- ============================================

-- ─── Helper: get current user's tenant_id ───
-- Reused across all RLS policies to avoid subquery repetition
create or replace function public.get_tenant_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- ═══════════════════════════════════════════
-- 1. SIP USERS (Extensions)
-- ═══════════════════════════════════════════
create table public.sip_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  extension text not null,              -- e.g. "101", "102"
  display_name text not null default '',
  sip_username text not null,           -- generated, e.g. "t_abc123_101"
  sip_password text not null,           -- stored encrypted (app generates)
  max_concurrent_calls int not null default 2,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Each extension number must be unique within a tenant
  unique (tenant_id, extension),
  -- SIP username must be globally unique (for Kamailio lookup)
  unique (sip_username)
);

alter table public.sip_users enable row level security;

-- SELECT: users can see SIP users in their tenant
create policy "Tenant isolation: select sip_users"
  on public.sip_users for select
  using (tenant_id = public.get_tenant_id());

-- INSERT: users can create SIP users in their tenant
create policy "Tenant isolation: insert sip_users"
  on public.sip_users for insert
  with check (tenant_id = public.get_tenant_id());

-- UPDATE: users can update SIP users in their tenant
create policy "Tenant isolation: update sip_users"
  on public.sip_users for update
  using (tenant_id = public.get_tenant_id());

-- DELETE: users can delete SIP users in their tenant
create policy "Tenant isolation: delete sip_users"
  on public.sip_users for delete
  using (tenant_id = public.get_tenant_id());

-- Index for fast lookups by tenant
create index idx_sip_users_tenant on public.sip_users (tenant_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sip_users_updated_at
  before update on public.sip_users
  for each row execute procedure public.set_updated_at();


-- ═══════════════════════════════════════════
-- 2. TRUNKS (SIP providers)
-- ═══════════════════════════════════════════
create table public.trunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default 'Main Trunk',
  host text not null,                   -- SIP provider host
  port int not null default 5060,
  username text,                        -- trunk auth username
  password text,                        -- trunk auth password (encrypted at app level)
  transport text not null default 'udp' check (transport in ('udp', 'tcp', 'tls')),
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trunks enable row level security;

create policy "Tenant isolation: select trunks"
  on public.trunks for select
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: insert trunks"
  on public.trunks for insert
  with check (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: update trunks"
  on public.trunks for update
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: delete trunks"
  on public.trunks for delete
  using (tenant_id = public.get_tenant_id());

create index idx_trunks_tenant on public.trunks (tenant_id);

create trigger trunks_updated_at
  before update on public.trunks
  for each row execute procedure public.set_updated_at();


-- ═══════════════════════════════════════════
-- 3. CALL FLOWS (IVR / routing rules)
-- ═══════════════════════════════════════════
-- steps is JSONB to keep the schema flexible for MVP.
-- Example steps:
--   { "type": "ivr", "greeting": "Welcome", "options": { "1": "ext:101", "2": "group:sales" } }
--   { "type": "ring_group", "strategy": "simultaneous", "members": ["101","102"] }
--   { "type": "forward", "mode": "always|busy|no_answer", "destination": "+34600123456" }

create table public.call_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text default '',
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.call_flows enable row level security;

create policy "Tenant isolation: select call_flows"
  on public.call_flows for select
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: insert call_flows"
  on public.call_flows for insert
  with check (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: update call_flows"
  on public.call_flows for update
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: delete call_flows"
  on public.call_flows for delete
  using (tenant_id = public.get_tenant_id());

create index idx_call_flows_tenant on public.call_flows (tenant_id);

create trigger call_flows_updated_at
  before update on public.call_flows
  for each row execute procedure public.set_updated_at();
