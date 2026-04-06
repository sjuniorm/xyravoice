-- ============================================================
-- STEP 2 (SIP Infra): Create read-only role for Kamailio
-- Run this in Supabase SQL Editor.
--
-- IMPORTANT: Replace 'CHANGE_ME_STRONG_PASSWORD' with a strong
-- random password before running. Save the password — you'll
-- need it for the VPS .env file.
--
-- To generate one: openssl rand -base64 24
-- ============================================================

-- 1. Create the role
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'kamailio_ro') then
    create role kamailio_ro with login password 'CHANGE_ME_STRONG_PASSWORD';
  else
    -- If role exists, just update the password
    alter role kamailio_ro with password 'CHANGE_ME_STRONG_PASSWORD';
  end if;
end $$;

-- 2. Grant minimal permissions
grant connect on database postgres to kamailio_ro;
grant usage on schema public to kamailio_ro;
grant select on public.sip_users to kamailio_ro;

-- 3. Create an RLS policy that allows kamailio_ro to read all sip_users
--    This bypasses tenant isolation for this role only.
--    The role has no other access — it can only SELECT from sip_users.
drop policy if exists "Kamailio can read all sip_users" on public.sip_users;
create policy "Kamailio can read all sip_users"
  on public.sip_users
  for select
  to kamailio_ro
  using (true);

-- 4. Verify
select rolname, rolcanlogin from pg_roles where rolname = 'kamailio_ro';

select schemaname, tablename, policyname, roles
from pg_policies
where tablename = 'sip_users';
