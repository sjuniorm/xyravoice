-- ============================================================
-- STEP 4 (SIP Infra): DIDs + trunk extras for PSTN calling
--
-- Adds:
--   1. caller_id + register columns on `trunks`
--   2. `dids` table for inbound number → destination mapping
--   3. RLS policies for tenant isolation on `dids`
--   4. Read-only role `asterisk_ro` for the sync agent on the VPS
-- ============================================================

-- ─── 1. Trunk extras ──────────────────────────────────────
alter table public.trunks
  add column if not exists caller_id text,
  add column if not exists register boolean not null default true,
  add column if not exists from_user text,
  add column if not exists from_domain text;

comment on column public.trunks.caller_id is
  'Outbound caller ID (E.164). If null, falls back to the first DID for this trunk, then to username.';
comment on column public.trunks.register is
  'If true, Asterisk will send REGISTER to keep a NAT pinhole open. Most providers require this.';
comment on column public.trunks.from_user is
  'Override the From: user header. Defaults to username. Some providers require a specific value.';
comment on column public.trunks.from_domain is
  'Override the From: domain header. Defaults to host.';


-- ─── 2. DIDs ──────────────────────────────────────────────
create table if not exists public.dids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  trunk_id uuid not null references public.trunks(id) on delete cascade,
  did_number text not null,                  -- E.164, e.g. "+34824805991"
  -- For MVP we route directly to an extension. Later: callflow / IVR.
  destination_type text not null default 'extension'
    check (destination_type in ('extension', 'callflow')),
  destination_value text not null,           -- extension number ("101") or callflow id
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Each DID must be globally unique (only one tenant owns a number)
  unique (did_number)
);

alter table public.dids enable row level security;

create policy "Tenant isolation: select dids"
  on public.dids for select
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: insert dids"
  on public.dids for insert
  with check (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: update dids"
  on public.dids for update
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: delete dids"
  on public.dids for delete
  using (tenant_id = public.get_tenant_id());

create index if not exists idx_dids_tenant on public.dids (tenant_id);
create index if not exists idx_dids_trunk on public.dids (trunk_id);

create trigger dids_updated_at
  before update on public.dids
  for each row execute procedure public.set_updated_at();


-- ─── 3. Read-only role for the Asterisk sync agent ─────────
-- The sync agent on the VPS polls Supabase every 30s, regenerates
-- pjsip.conf + extensions.conf, then reloads Asterisk.
--
-- IMPORTANT: replace 04edf961dc5b8c50d64407cf12aa33741e280bb1760454f2 before running.
-- Use HEX-only (openssl rand -hex 24) to avoid URL-encoding issues.
-- Avoid: / @ # % + ?
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'asterisk_ro') then
    create role asterisk_ro with login password '04edf961dc5b8c50d64407cf12aa33741e280bb1760454f2';
  else
    alter role asterisk_ro with password '04edf961dc5b8c50d64407cf12aa33741e280bb1760454f2';
  end if;
end $$;

grant connect on database postgres to asterisk_ro;
grant usage on schema public to asterisk_ro;
grant select on public.trunks to asterisk_ro;
grant select on public.dids to asterisk_ro;
grant select on public.sip_users to asterisk_ro;
grant select on public.tenants to asterisk_ro;

-- RLS bypass for this role (it can read everything across tenants —
-- the sync agent needs to see all trunks/DIDs to generate the configs).
drop policy if exists "Asterisk sync can read all trunks" on public.trunks;
create policy "Asterisk sync can read all trunks"
  on public.trunks for select
  to asterisk_ro
  using (true);

drop policy if exists "Asterisk sync can read all dids" on public.dids;
create policy "Asterisk sync can read all dids"
  on public.dids for select
  to asterisk_ro
  using (true);

drop policy if exists "Asterisk sync can read all sip_users" on public.sip_users;
create policy "Asterisk sync can read all sip_users"
  on public.sip_users for select
  to asterisk_ro
  using (true);

drop policy if exists "Asterisk sync can read all tenants" on public.tenants;
create policy "Asterisk sync can read all tenants"
  on public.tenants for select
  to asterisk_ro
  using (true);


-- ─── 4. Verify ─────────────────────────────────────────────
select rolname, rolcanlogin from pg_roles where rolname = 'asterisk_ro';
select schemaname, tablename, policyname from pg_policies
  where tablename in ('trunks', 'dids', 'sip_users', 'tenants')
    and policyname like 'Asterisk%';
