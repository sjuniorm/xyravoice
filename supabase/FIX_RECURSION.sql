-- ============================================================
-- FIX: Infinite recursion in profiles SELECT policy
-- Run this in Supabase SQL Editor
-- ============================================================

-- The problem: the old policy queried public.profiles from
-- inside a public.profiles policy, causing infinite recursion.
-- The fix: use the SECURITY DEFINER helper function which
-- bypasses RLS (and is safe because it only returns the
-- caller's own tenant_id).

drop policy if exists "Users can view own tenant profiles" on public.profiles;

create policy "Users can view own tenant profiles"
  on public.profiles for select
  using (
    id = auth.uid()                              -- always see your own row
    or tenant_id = public.get_tenant_id()        -- see others in same tenant
  );

-- Also fix the tenants SELECT policy (same issue pattern)
drop policy if exists "Users can view own tenant" on public.tenants;
create policy "Users can view own tenant"
  on public.tenants for select
  using (id = public.get_tenant_id());

-- And tenants UPDATE
drop policy if exists "Users can update own tenant" on public.tenants;
create policy "Users can update own tenant"
  on public.tenants for update
  using (id = public.get_tenant_id());

-- Verify: this should now return your row without error
select id, tenant_id, email, full_name, role from public.profiles;
