-- ============================================
-- FIX: Create tenants + profiles for existing users
-- who signed up BEFORE the trigger was installed.
-- Safe to run multiple times.
-- ============================================

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
    -- Create tenant
    insert into public.tenants (name)
    values (coalesce(u.raw_user_meta_data ->> 'company_name', 'My Company'))
    returning id into new_tenant_id;

    -- Create profile
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

-- Verify
select p.email, p.full_name, t.name as company
from public.profiles p
join public.tenants t on t.id = p.tenant_id;
