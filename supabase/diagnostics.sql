-- ============================================
-- DIAGNOSTIC: Run this in Supabase SQL Editor
-- to find out what's broken
-- ============================================

-- 1. Check if all tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('tenants', 'profiles', 'sip_users', 'trunks', 'call_flows');
-- Expected: 5 rows. If less, the migrations weren't all run.

-- 2. Check if your profile exists
select id, tenant_id, email, full_name, role
from public.profiles;
-- Expected: at least 1 row (your user). If empty, the trigger didn't fire.

-- 3. Check if tenants exist
select id, name, created_at from public.tenants;
-- Expected: at least 1 row (your company)

-- 4. Check if the trigger exists
select trigger_name, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';
-- Expected: 1 row

-- 5. Check if helper function exists
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'get_tenant_id';
-- Expected: 1 row
