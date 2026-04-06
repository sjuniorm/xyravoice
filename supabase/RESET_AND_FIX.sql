-- ============================================================
-- XYRA VOICE — ONE-SHOT FIX
-- Run this entire file in Supabase SQL Editor.
-- It is idempotent (safe to run multiple times).
-- It ensures all tables, policies, functions, and triggers
-- exist, AND backfills profiles for any orphaned users.
-- ============================================================

-- ─── 1. Ensure tables exist ───────────────────────────────

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

create table if not exists public.sip_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  extension text not null,
  display_name text not null default '',
  sip_username text not null,
  sip_password text not null,
  max_concurrent_calls int not null default 2,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, extension),
  unique (sip_username)
);

create table if not exists public.trunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default 'Main Trunk',
  host text not null,
  port int not null default 5060,
  username text,
  password text,
  transport text not null default 'udp' check (transport in ('udp', 'tcp', 'tls')),
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.call_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text default '',
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── 2. Enable RLS on all tables ──────────────────────────

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.sip_users enable row level security;
alter table public.trunks enable row level security;
alter table public.call_flows enable row level security;

-- ─── 3. Helper function: get_tenant_id ────────────────────

create or replace function public.get_tenant_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- ─── 4. Drop and recreate ALL policies (idempotent) ───────

-- tenants
drop policy if exists "Users can view own tenant" on public.tenants;
drop policy if exists "Allow insert during signup" on public.tenants;
drop policy if exists "Users can update own tenant" on public.tenants;

create policy "Users can view own tenant"
  on public.tenants for select
  using (id in (select tenant_id from public.profiles where id = auth.uid()));

create policy "Allow insert during signup"
  on public.tenants for insert
  with check (true);

create policy "Users can update own tenant"
  on public.tenants for update
  using (id in (select tenant_id from public.profiles where id = auth.uid()));

-- profiles
drop policy if exists "Users can view own tenant profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Allow insert during signup" on public.profiles;

create policy "Users can view own tenant profiles"
  on public.profiles for select
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Allow insert during signup"
  on public.profiles for insert
  with check (true);

-- sip_users
drop policy if exists "Tenant isolation: select sip_users" on public.sip_users;
drop policy if exists "Tenant isolation: insert sip_users" on public.sip_users;
drop policy if exists "Tenant isolation: update sip_users" on public.sip_users;
drop policy if exists "Tenant isolation: delete sip_users" on public.sip_users;

create policy "Tenant isolation: select sip_users"
  on public.sip_users for select
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: insert sip_users"
  on public.sip_users for insert
  with check (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: update sip_users"
  on public.sip_users for update
  using (tenant_id = public.get_tenant_id());

create policy "Tenant isolation: delete sip_users"
  on public.sip_users for delete
  using (tenant_id = public.get_tenant_id());

-- trunks
drop policy if exists "Tenant isolation: select trunks" on public.trunks;
drop policy if exists "Tenant isolation: insert trunks" on public.trunks;
drop policy if exists "Tenant isolation: update trunks" on public.trunks;
drop policy if exists "Tenant isolation: delete trunks" on public.trunks;

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

-- call_flows
drop policy if exists "Tenant isolation: select call_flows" on public.call_flows;
drop policy if exists "Tenant isolation: insert call_flows" on public.call_flows;
drop policy if exists "Tenant isolation: update call_flows" on public.call_flows;
drop policy if exists "Tenant isolation: delete call_flows" on public.call_flows;

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

-- ─── 5. updated_at trigger function ───────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sip_users_updated_at on public.sip_users;
create trigger sip_users_updated_at
  before update on public.sip_users
  for each row execute procedure public.set_updated_at();

drop trigger if exists trunks_updated_at on public.trunks;
create trigger trunks_updated_at
  before update on public.trunks
  for each row execute procedure public.set_updated_at();

drop trigger if exists call_flows_updated_at on public.call_flows;
create trigger call_flows_updated_at
  before update on public.call_flows
  for each row execute procedure public.set_updated_at();

-- ─── 6. New user trigger ──────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  new_tenant_id uuid;
  user_name text;
  tenant_name text;
begin
  user_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  tenant_name := coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company');

  insert into public.tenants (name)
  values (tenant_name)
  returning id into new_tenant_id;

  insert into public.profiles (id, tenant_id, email, full_name, role)
  values (new.id, new_tenant_id, new.email, user_name, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── 7. Indexes ───────────────────────────────────────────

create index if not exists idx_sip_users_tenant on public.sip_users (tenant_id);
create index if not exists idx_trunks_tenant on public.trunks (tenant_id);
create index if not exists idx_call_flows_tenant on public.call_flows (tenant_id);

-- ─── 8. BACKFILL: Create profile + tenant for any orphaned auth users ─

do $$
declare
  u record;
  new_tenant_id uuid;
begin
  for u in
    select id, email, raw_user_meta_data
    from auth.users
    where id not in (select id from public.profiles)
  loop
    insert into public.tenants (name)
    values (coalesce(u.raw_user_meta_data ->> 'company_name', 'My Company'))
    returning id into new_tenant_id;

    insert into public.profiles (id, tenant_id, email, full_name, role)
    values (
      u.id,
      new_tenant_id,
      u.email,
      coalesce(u.raw_user_meta_data ->> 'full_name', ''),
      'admin'
    );
  end loop;
end $$;

-- ─── 9. Verify ────────────────────────────────────────────

select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.tenants) as tenants;

select p.email, p.full_name, p.role, t.name as company
from public.profiles p
join public.tenants t on t.id = p.tenant_id;
