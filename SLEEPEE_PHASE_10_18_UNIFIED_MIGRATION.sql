-- =============================================================
-- SLEEPEE PHASE 10→18 UNIFIED MIGRATION v1.0
-- Apply ONCE to the existing Supabase project. Do not run legacy schema files.
-- =============================================================
begin;
create or replace function public.record_application_event_v2(
  p_table_name text,
  p_record_id uuid,
  p_action_type text,
  p_new_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_id uuid := gen_random_uuid();
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role <> 'Administrator' and v_role not in ('Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager') then
    raise exception 'FORBIDDEN';
  end if;
  if p_table_name is null or p_record_id is null then raise exception 'AUDIT_TARGET_REQUIRED'; end if;
  if p_action_type not in ('INSERT','UPDATE','DELETE') then raise exception 'INVALID_AUDIT_ACTION'; end if;

  insert into public.audit_logs(id, table_name, record_id, action_type, new_data, performed_by)
  values(v_id, p_table_name, p_record_id, p_action_type, coalesce(p_new_data,'{}'::jsonb), v_user);
  return v_id;
end;
$$;
revoke all on function public.record_application_event_v2(text,uuid,text,jsonb) from public;
grant execute on function public.record_application_event_v2(text,uuid,text,jsonb) to authenticated;
commit;

-- SLEEPEE PLATFORM — PHASE 10→18 UNIFIED MIGRATION v1.0
-- Purpose: harden Customer Service 360, Replacement Management, Reports, Administration,
-- Public Warranty Portal, Permission contracts, and API/RPC security on the EXISTING Supabase project.
-- IMPORTANT: This migration does NOT drop/recreate Phase 01–09 tables or warranty RPCs.

begin;

-- =========================================================
-- PHASE 10 — CUSTOMER SERVICE 360 HARDENING
-- =========================================================

create index if not exists idx_service_cases_customer_id on public.service_cases(customer_id);
create index if not exists idx_service_cases_serial_id on public.service_cases(serial_id);
create index if not exists idx_service_cases_assigned_to on public.service_cases(assigned_to);
create index if not exists idx_service_case_notes_case_id on public.service_case_notes(service_case_id);
create index if not exists idx_service_attachments_case_id on public.service_attachments(service_case_id);

-- Replace old unsafe policies with explicit role-scoped write policies.
drop policy if exists "Service case notes insert" on public.service_case_notes;
drop policy if exists "Service case notes update" on public.service_case_notes;
drop policy if exists "Service attachments insert" on public.service_attachments;
drop policy if exists "Service cases manage" on public.service_cases;

create policy "Service case notes insert v2"
on public.service_case_notes for insert to authenticated
with check (
  get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Service Manager')
  and created_by = auth.uid()
);

-- Notes are append-only in Phase 10–18. No client UPDATE/DELETE.

create policy "Service attachments insert v2"
on public.service_attachments for insert to authenticated
with check (
  get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Service Manager')
  and uploaded_by = auth.uid()
);

create policy "Service cases update v2"
on public.service_cases for update to authenticated
using (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Service Manager'))
with check (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Service Manager'));

-- Secure case creation. Actor and default assignee are always auth.uid().
create or replace function public.create_service_case_v2(
  p_customer_id uuid,
  p_serial_id uuid,
  p_case_type text,
  p_subject text,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid := gen_random_uuid();
  v_case_number text;
  v_role text;
  v_user uuid := auth.uid();
  v_year text := to_char(current_date, 'YYYY');
  v_seq integer;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role not in ('Administrator', 'Customer Service Agent', 'Service Manager') then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from customers where id = p_customer_id) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not exists (select 1 from serial_numbers where id = p_serial_id) then raise exception 'SERIAL_NOT_FOUND'; end if;
  if p_case_type not in ('inquiry','complaint','warranty','maintenance','replacement','followup','other') then
    raise exception 'INVALID_CASE_TYPE';
  end if;
  if nullif(trim(coalesce(p_subject,'')), '') is null then raise exception 'SUBJECT_REQUIRED'; end if;
  if nullif(trim(coalesce(p_description,'')), '') is null then raise exception 'DESCRIPTION_REQUIRED'; end if;

  loop
    v_seq := floor(random() * 900000) + 100000;
    v_case_number := format('CS-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
    exit when not exists (select 1 from service_cases where case_number = v_case_number);
  end loop;

  insert into service_cases(id, case_number, case_type, status, customer_id, serial_id, subject, description, assigned_to)
  values (v_case_id, v_case_number, p_case_type, 'open', p_customer_id, p_serial_id, trim(p_subject), trim(p_description), v_user);

  insert into service_case_notes(service_case_id, note_text, created_by)
  values (v_case_id, 'تم فتح التذكرة بواسطة المستخدم الحالي.', v_user);

  insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('service_cases', v_case_id, 'INSERT', jsonb_build_object('case_number', v_case_number, 'case_type', p_case_type), v_user);

  update serial_numbers set status = 'service' where id = p_serial_id and status not in ('closed');
  return v_case_id;
end;
$$;

revoke all on function public.create_service_case_v2(uuid,uuid,text,text,text) from public;
grant execute on function public.create_service_case_v2(uuid,uuid,text,text,text) to authenticated;

create or replace function public.record_service_case_note(
  p_case_id uuid,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_note_id uuid;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role not in ('Administrator', 'Customer Service Agent', 'Service Manager') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from service_cases where id = p_case_id) then raise exception 'CASE_NOT_FOUND'; end if;
  if nullif(trim(coalesce(p_note,'')), '') is null then raise exception 'NOTE_REQUIRED'; end if;

  insert into service_case_notes(service_case_id, note_text, created_by)
  values (p_case_id, trim(p_note), v_user)
  returning id into v_note_id;

  insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('service_case_notes', v_note_id, 'INSERT', jsonb_build_object('service_case_id', p_case_id), v_user);

  return v_note_id;
end;
$$;

revoke all on function public.record_service_case_note(uuid,text) from public;
grant execute on function public.record_service_case_note(uuid,text) to authenticated;

create or replace function public.update_service_case_status_v2(
  p_case_id uuid,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_old text;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role not in ('Administrator', 'Customer Service Agent', 'Service Manager') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('open','assigned','inprogress','resolved','closed') then raise exception 'INVALID_CASE_STATUS'; end if;
  select status into v_old from service_cases where id = p_case_id for update;
  if v_old is null then raise exception 'CASE_NOT_FOUND'; end if;

  update service_cases set status = p_status, updated_at = now() where id = p_case_id;
  insert into service_case_notes(service_case_id, note_text, created_by)
  values (p_case_id, format('تغيير حالة التذكرة: %s → %s', v_old, p_status), v_user);
  insert into audit_logs(table_name, record_id, action_type, old_data, new_data, performed_by)
  values ('service_cases', p_case_id, 'UPDATE', jsonb_build_object('status',v_old), jsonb_build_object('status',p_status), v_user);
  return p_case_id;
end;
$$;

revoke all on function public.update_service_case_status_v2(uuid,text) from public;
grant execute on function public.update_service_case_status_v2(uuid,text) to authenticated;

-- =========================================================
-- PHASE 12 — REPLACEMENT MANAGEMENT
-- =========================================================

alter table public.replacement_requests add column if not exists new_serial_id uuid references public.serial_numbers(id) on delete restrict;
alter table public.replacement_requests add column if not exists approved_by uuid references public.profiles(id) on delete restrict;
alter table public.replacement_requests add column if not exists approved_at timestamptz;
create index if not exists idx_replacement_customer_id on public.replacement_requests(customer_id);
create index if not exists idx_replacement_serial_id on public.replacement_requests(serial_id);
create index if not exists idx_replacement_new_serial_id on public.replacement_requests(new_serial_id);
create index if not exists idx_replacement_history_request_id on public.replacement_history(replacement_request_id);

-- Current live roles can create requests; approval is Service Manager/Administrator.
drop policy if exists "Replacements manage" on public.replacement_requests;
drop policy if exists "Replacements insert v2" on public.replacement_requests;
drop policy if exists "Replacements update v2" on public.replacement_requests;

create policy "Replacements insert v2"
on public.replacement_requests for insert to authenticated
with check (get_current_user_role() in ('Administrator','Customer Service Agent','Service Manager'));

create policy "Replacements update v2"
on public.replacement_requests for update to authenticated
using (get_current_user_role() in ('Administrator','Service Manager'))
with check (get_current_user_role() in ('Administrator','Service Manager'));

create or replace function public.create_replacement_request_v2(
  p_customer_id uuid,
  p_serial_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_request_id uuid := gen_random_uuid();
  v_number text;
  v_seq integer;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role not in ('Administrator','Customer Service Agent','Service Manager') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from customers where id = p_customer_id) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not exists (select 1 from serial_numbers where id = p_serial_id) then raise exception 'SERIAL_NOT_FOUND'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'REASON_REQUIRED'; end if;

  loop
    v_seq := floor(random()*900000)+100000;
    v_number := format('RPL-%s-%s', to_char(current_date,'YYYY'), lpad(v_seq::text,6,'0'));
    exit when not exists (select 1 from replacement_requests where request_number = v_number);
  end loop;

  insert into replacement_requests(id, request_number, customer_id, serial_id, status, reason)
  values (v_request_id, v_number, p_customer_id, p_serial_id, 'requested', trim(p_reason));

  insert into replacement_history(replacement_request_id, event_type, notes, created_by)
  values (v_request_id, 'requested', 'تم إنشاء طلب الاستبدال.', v_user);

  insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('replacement_requests', v_request_id, 'INSERT', jsonb_build_object('request_number',v_number,'serial_id',p_serial_id), v_user);
  return v_request_id;
end;
$$;

revoke all on function public.create_replacement_request_v2(uuid,uuid,text) from public;
grant execute on function public.create_replacement_request_v2(uuid,uuid,text) to authenticated;

create or replace function public.update_replacement_status_v2(
  p_request_id uuid,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_old text;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role not in ('Administrator','Service Manager') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('requested','under_review','approved','issued','completed','denied') then raise exception 'INVALID_REPLACEMENT_STATUS'; end if;
  select status into v_old from replacement_requests where id = p_request_id for update;
  if v_old is null then raise exception 'REPLACEMENT_NOT_FOUND'; end if;

  update replacement_requests set status = p_status, updated_at = now(), approved_by = case when p_status='approved' then v_user else approved_by end, approved_at = case when p_status='approved' then now() else approved_at end where id = p_request_id;
  insert into replacement_history(replacement_request_id, event_type, notes, created_by)
  values (p_request_id, p_status, format('تغيير حالة طلب الاستبدال: %s → %s', v_old, p_status), v_user);
  insert into audit_logs(table_name, record_id, action_type, old_data, new_data, performed_by)
  values ('replacement_requests', p_request_id, 'UPDATE', jsonb_build_object('status',v_old), jsonb_build_object('status',p_status), v_user);
  return p_request_id;
end;
$$;

revoke all on function public.update_replacement_status_v2(uuid,text) from public;
grant execute on function public.update_replacement_status_v2(uuid,text) to authenticated;

create or replace function public.approve_replacement_v2(
  p_request_id uuid,
  p_new_serial_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_original uuid;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := get_current_user_role();
  if v_role not in ('Administrator','Service Manager') then raise exception 'FORBIDDEN'; end if;
  select serial_id into v_original from replacement_requests where id = p_request_id for update;
  if v_original is null then raise exception 'REPLACEMENT_NOT_FOUND'; end if;
  if not exists(select 1 from serial_numbers where id = p_new_serial_id) then raise exception 'NEW_SERIAL_NOT_FOUND'; end if;

  update replacement_requests set status='approved', new_serial_id=p_new_serial_id, approved_by=v_user, approved_at=now(), updated_at=now() where id=p_request_id;
  update serial_numbers set status='replacement' where id=v_original;
  update serial_numbers set status='activated' where id=p_new_serial_id and status in ('generated','printed','sold');
  insert into replacement_history(replacement_request_id, event_type, notes, created_by)
  values (p_request_id, 'approved', format('تم ربط البديل %s بالأصل %s مع الحفاظ على السجل.', p_new_serial_id, v_original), v_user);
  insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('replacement_requests', p_request_id, 'UPDATE', jsonb_build_object('status','approved','original_serial_id',v_original,'new_serial_id',p_new_serial_id), v_user);
  return p_request_id;
end;
$$;

revoke all on function public.approve_replacement_v2(uuid,uuid) from public;
grant execute on function public.approve_replacement_v2(uuid,uuid) to authenticated;

-- =========================================================
-- PHASE 13 — REPORTING CONTRACTS
-- =========================================================

create or replace function public.get_phase13_report_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'production_orders', (select count(*) from production_orders),
  'production_batches', (select count(*) from production_batches),
  'serial_numbers', (select count(*) from serial_numbers),
  'printed_serials', (select count(*) from serial_numbers where status='printed'),
  'warranty_activations', (select count(*) from warranty_activations),
  'service_cases', (select count(*) from service_cases),
  'open_service_cases', (select count(*) from service_cases where status in ('open','assigned','inprogress')),
  'replacement_requests', (select count(*) from replacement_requests),
  'open_replacements', (select count(*) from replacement_requests where status in ('requested','under_review','approved','issued')),
  'print_jobs', (select count(*) from print_jobs),
  'generated_at', now()
);
$$;
revoke all on function public.get_phase13_report_summary() from public;
grant execute on function public.get_phase13_report_summary() to authenticated;

-- =========================================================
-- PHASE 14 — ADMINISTRATION & ROLE MANAGEMENT
-- =========================================================

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or get_current_user_role() <> 'Administrator' then raise exception 'FORBIDDEN'; end if;
  if p_role_name not in ('Administrator','Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager') then raise exception 'INVALID_ROLE'; end if;
  if not exists(select 1 from profiles where id=p_user_id) then raise exception 'USER_PROFILE_NOT_FOUND'; end if;

  insert into user_roles(user_id, role_name)
  values (p_user_id,p_role_name)
  on conflict (user_id) do update set role_name=excluded.role_name;

  insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('user_roles', p_user_id, 'UPDATE', jsonb_build_object('role_name',p_role_name), v_user);
  return p_user_id;
end;
$$;
revoke all on function public.admin_set_user_role(uuid,text) from public;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;

-- =========================================================
-- PHASE 15 — PUBLIC WARRANTY PORTAL
-- =========================================================

create or replace function public.public_verify_warranty(p_serial_number text)
returns table(
  serial_number text,
  brand_name_ar text,
  brand_name_en text,
  model_name_ar text,
  model_name_en text,
  category_name_ar text,
  category_name_en text,
  warranty_status text,
  warranty_duration_years integer,
  warranty_start date,
  warranty_end date
)
language sql
security definer
set search_path = public
as $$
  select
    sn.serial_number,
    b.name_ar,
    b.name_en,
    m.name_ar,
    m.name_en,
    c.name_ar,
    c.name_en,
    case
      when wa.id is null then 'not_activated'
      when wa.warranty_end_date >= current_date then 'active'
      else 'expired'
    end,
    wa.duration_years,
    wa.invoice_date,
    wa.warranty_end_date
  from serial_numbers sn
  join models m on m.id=sn.model_id
  join brands b on b.id=m.brand_id
  join categories c on c.id=m.category_id
  left join warranty_activations wa on wa.serial_id=sn.id
  where upper(sn.serial_number)=upper(trim(p_serial_number))
  limit 1;
$$;
revoke all on function public.public_verify_warranty(text) from public;
grant execute on function public.public_verify_warranty(text) to anon, authenticated;

-- =========================================================
-- PHASE 16 — PERMISSION MATRIX / CONTRACT VIEW
-- =========================================================

create or replace view public.vw_phase16_route_permissions as
select * from (values
  ('Administrator','/dashboard',true),
  ('Administrator','/master-data',true),
  ('Administrator','/production',true),
  ('Administrator','/serialization',true),
  ('Administrator','/printing',true),
  ('Administrator','/label-designer',true),
  ('Administrator','/warranty',true),
  ('Administrator','/customer-service',true),
  ('Administrator','/replacement',true),
  ('Administrator','/reports',true),
  ('Administrator','/admin',true),
  ('Production Manager','/dashboard',true),
  ('Production Manager','/master-data',true),
  ('Production Manager','/production',true),
  ('Production Manager','/serialization',true),
  ('Production Manager','/printing',true),
  ('Printing Operator','/printing',true),
  ('Printing Operator','/label-designer',true),
  ('Warranty Officer','/dashboard',true),
  ('Warranty Officer','/warranty',true),
  ('Warranty Officer','/customer-service',true),
  ('Customer Service Agent','/dashboard',true),
  ('Customer Service Agent','/customer-service',true),
  ('Service Manager','/dashboard',true),
  ('Service Manager','/customer-service',true),
  ('Service Manager','/replacement',true),
  ('Service Manager','/reports',true)
) as t(role_name, route_path, allowed);

grant select on public.vw_phase16_route_permissions to authenticated;

-- =========================================================
-- PHASE 17 — API / RPC CONTRACT INVENTORY
-- =========================================================

create or replace view public.vw_phase17_rpc_contracts as
select * from (values
 ('create_service_case_v2','authenticated','Customer Service 360: atomic case creation'),
 ('record_service_case_note','authenticated','Customer Service 360: append note'),
 ('update_service_case_status_v2','authenticated','Service Case Management: status mutation'),
 ('create_replacement_request_v2','authenticated','Replacement Management: create request'),
 ('update_replacement_status_v2','authenticated','Replacement Management: status mutation'),
 ('approve_replacement_v2','authenticated','Replacement Management: approval/linking'),
 ('get_phase13_report_summary','authenticated','Reports Center: live summary'),
 ('admin_set_user_role','authenticated','Administration: role management'),
 ('public_verify_warranty','anon,authenticated','Public Portal: warranty verification')
) as t(function_name, execution_role, purpose);

grant select on public.vw_phase17_rpc_contracts to authenticated;

-- =========================================================
-- PHASE 18 — FINAL INTEGRITY CONTRACT
-- =========================================================

create or replace function public.get_phase18_integrity_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'profiles', (select count(*) from profiles),
  'roles', (select count(*) from user_roles),
  'products', (select count(*) from products),
  'production_orders', (select count(*) from production_orders),
  'production_batches', (select count(*) from production_batches),
  'serial_numbers', (select count(*) from serial_numbers),
  'label_templates', (select count(*) from label_templates),
  'print_jobs', (select count(*) from print_jobs),
  'warranty_policies', (select count(*) from warranty_policies),
  'warranty_activations', (select count(*) from warranty_activations),
  'service_cases', (select count(*) from service_cases),
  'replacement_requests', (select count(*) from replacement_requests),
  'audit_logs', (select count(*) from audit_logs),
  'checked_at', now()
);
$$;
revoke all on function public.get_phase18_integrity_snapshot() from public;
grant execute on function public.get_phase18_integrity_snapshot() to authenticated;

-- Application audit writer is defined in PHASE_10_18_UNIFIED_AUDIT_RPC.sql and must be applied after this migration.

commit;

begin;
insert into storage.buckets(id, name, public) values ('service','service',false) on conflict (id) do nothing;

drop policy if exists "Service Storage Read" on storage.objects;
drop policy if exists "Service Storage Insert" on storage.objects;

create policy "Service Storage Read"
on storage.objects for select to authenticated
using (
  bucket_id = 'service'
  and get_current_user_role() in ('Administrator','Customer Service Agent','Service Manager')
);

create policy "Service Storage Insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'service'
  and get_current_user_role() in ('Administrator','Customer Service Agent','Service Manager')
  and owner_id = auth.uid()
);
commit;
