-- ============================================================================
-- PHASE 08 — TARGETED RLS POLICIES FOR LABEL_TEMPLATES
-- Allows Administrator and Printing Operator to CREATE/EDIT/PUBLISH/DELETE templates
-- Allows all authenticated roles to SELECT templates
-- Uses authoritative get_current_user_role() function
-- ============================================================================

-- Ensure RLS is enabled on label_templates
alter table if exists public.label_templates enable row level security;

-- Drop obsolete or restrictive policies if they exist
drop policy if exists "Templates select" on public.label_templates;
drop policy if exists "Templates manage" on public.label_templates;
drop policy if exists "Templates insert" on public.label_templates;
drop policy if exists "Templates update" on public.label_templates;
drop policy if exists "Templates delete" on public.label_templates;

-- 1. SELECT POLICY: All authenticated roles may view templates (Administrator, Printing Operator, Production Manager, etc.)
create policy "Templates select" on public.label_templates
  for select to authenticated
  using (true);

-- 2. INSERT POLICY: Administrator and Printing Operator only
create policy "Templates insert" on public.label_templates
  for insert to authenticated
  with check (get_current_user_role() in ('Administrator', 'Printing Operator'));

-- 3. UPDATE POLICY: Administrator and Printing Operator only
create policy "Templates update" on public.label_templates
  for update to authenticated
  using (get_current_user_role() in ('Administrator', 'Printing Operator'))
  with check (get_current_user_role() in ('Administrator', 'Printing Operator'));

-- 4. DELETE POLICY: Administrator and Printing Operator only
create policy "Templates delete" on public.label_templates
  for delete to authenticated
  using (get_current_user_role() in ('Administrator', 'Printing Operator'));
