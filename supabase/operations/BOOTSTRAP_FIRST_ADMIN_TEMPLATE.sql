-- MANUAL OWNER-ONLY TEMPLATE — NOT A MIGRATION. NEVER AUTO-RUN.
-- Use only after approved migrations 001, 002 and 003 have been reviewed/deployed
-- to the intended empty Supabase project. Run from Supabase SQL Editor as DB owner.
-- Replace NULL below with the verified Auth UUID, e.g. '00000000-0000-0000-0000-000000000000'::uuid.
do $$
declare
  v_owner_user_id uuid := null; -- REQUIRED: replace with the reviewed auth.users.id UUID
begin
  if v_owner_user_id is null then
    raise exception 'BOOTSTRAP_STOPPED: set v_owner_user_id to the explicitly reviewed Auth UUID.';
  end if;
  if not exists (select 1 from auth.users where id = v_owner_user_id) then
    raise exception 'BOOTSTRAP_STOPPED: supplied UUID was not found in auth.users.';
  end if;
  if not exists (select 1 from public.profiles where id = v_owner_user_id) then
    raise exception 'BOOTSTRAP_STOPPED: user profile is missing; inspect the Auth profile trigger before proceeding.';
  end if;
  if exists (select 1 from public.user_roles where role_name = 'Administrator' and user_id <> v_owner_user_id) then
    raise exception 'BOOTSTRAP_STOPPED: another Administrator already exists; use approved admin role management instead.';
  end if;
  insert into public.user_roles (user_id, role_name)
  values (v_owner_user_id, 'Administrator')
  on conflict (user_id) do update set role_name = 'Administrator';
end $$;
-- Review the result manually after execution. This template is not part of automated deployments.
