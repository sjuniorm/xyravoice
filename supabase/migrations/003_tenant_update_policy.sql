-- ============================================
-- STEP 7: Allow admins to update their tenant name
-- Run this in Supabase SQL Editor AFTER 001 + 002
-- ============================================

-- Allow users to update their own tenant (for Settings page)
create policy "Users can update own tenant"
  on public.tenants for update
  using (
    id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );
