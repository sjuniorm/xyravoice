-- ============================================
-- STEP 2: Tenants + User Profiles
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Tenants table
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 2. User profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- 3. Enable RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- 4. RLS Policies: tenants
-- Users can only see their own tenant
create policy "Users can view own tenant"
  on public.tenants for select
  using (
    id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

-- Only the system (service role) creates tenants, but we allow insert
-- during signup via a database function (see below)
create policy "Allow insert during signup"
  on public.tenants for insert
  with check (true);

-- 5. RLS Policies: profiles
-- Users can only see profiles in their tenant
create policy "Users can view own tenant profiles"
  on public.profiles for select
  using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Allow insert during signup
create policy "Allow insert during signup"
  on public.profiles for insert
  with check (true);

-- 6. Function: handle new user signup
-- Called via database trigger when a new auth user is created
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
  -- Extract metadata from signup
  user_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  tenant_name := coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company');

  -- Create a new tenant for this user
  insert into public.tenants (name)
  values (tenant_name)
  returning id into new_tenant_id;

  -- Create the user profile linked to the tenant
  insert into public.profiles (id, tenant_id, email, full_name, role)
  values (new.id, new_tenant_id, new.email, user_name, 'admin');

  return new;
end;
$$;

-- 7. Trigger: auto-create tenant + profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
