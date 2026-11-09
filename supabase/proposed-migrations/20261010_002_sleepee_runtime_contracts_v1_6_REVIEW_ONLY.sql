-- ============================================================================
-- SLEEPEE RUNTIME CONTRACTS — CONSOLIDATED HANDOFF v1.6.0-rc.2
-- STATUS: REVIEW ONLY. NOT IN supabase/migrations; DO NOT EXECUTE BEFORE APPROVAL.
-- Intended order: 001 foundation -> 002 this runtime RPC set -> 003 policies/grants.
-- Source: canonical SSoT + verified legacy Phase 09/10-18 RPC contracts, reconciled
-- to the v1.6 foundation schema and canonical seven role names.
--
-- No DROP, TRUNCATE, DELETE, fake data seeds, or client-side warranty activation writes.
-- Existing warranty duration/end-date snapshot contract is preserved.
-- Replacement lifecycle transitions are Administrator-only until the owner approves
-- the authority mapping; no Service Manager alias is silently introduced.
-- ============================================================================
begin;
create or replace function public.activate_warranty(
    p_serial_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_customer jsonb DEFAULT NULL,
    p_invoice_number text DEFAULT NULL,
    p_invoice_date date DEFAULT NULL
)
returns uuid as $$
declare
  v_activation_id uuid;
  v_auth_user uuid;
  v_role text;
  v_model_id uuid;
  v_brand_id uuid;
  v_category_id uuid;
  v_duration integer := null;
  v_resolved_level text := 'category';
  v_existing_act uuid;
  v_serial_status text;
  v_resolved_customer_id uuid;
  v_existing_cust uuid;
begin
  -- 1. Authoritative actor & role validation using auth.uid() & public.get_current_user_role()
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'UNAUTHORIZED: Authentication required to activate warranty.';
  end if;

  begin
    v_role := public.get_current_user_role();
  exception when others then
    raise exception 'UNAUTHORIZED: Role assignment required.';
  end;

  if v_role not in ('Administrator', 'Warranty Manager', 'Customer Service User') then
    raise exception 'UNAUTHORIZED: Role % is not permitted to activate warranties.', v_role;
  end if;

  -- 2. Validate serial exists and get model info
  select sn.model_id, sn.status, m.brand_id, m.category_id
  into v_model_id, v_serial_status, v_brand_id, v_category_id
  from serial_numbers sn
  join models m on sn.model_id = m.id
  where sn.id = p_serial_id;

  if v_model_id is null then
    raise exception 'SERIAL_NOT_FOUND: Serial ID % not found in production records.', p_serial_id;
  end if;

  if v_serial_status in ('closed', 'replacement') then
    raise exception 'SERIAL_NOT_ELIGIBLE: Serial status is %. Cannot activate.', v_serial_status;
  end if;

  -- 3. Validate serial is not already activated (ONE warranty per serial)
  select id into v_existing_act
  from warranty_activations
  where serial_id = p_serial_id;

  if v_existing_act is not null then
    raise exception 'WARRANTY_ALREADY_ACTIVE: Serial is already activated in the database.';
  end if;

  -- 4. Validate invoice number and date
  if p_invoice_number is null or trim(p_invoice_number) = '' then
    raise exception 'VALIDATION_ERROR: Invoice number is mandatory.';
  end if;

  if p_invoice_date is null then
    raise exception 'VALIDATION_ERROR: Invoice date is mandatory.';
  end if;

  if p_invoice_date > current_date then
    raise exception 'VALIDATION_ERROR: Invoice date cannot be in the future.';
  end if;

  -- 5. Resolve policy server-side: Model -> Brand -> Category (1–15 years, no 10-year fallback)
  select duration_years, 'model'
  into v_duration, v_resolved_level
  from warranty_policies
  where level_type = 'model' and model_id = v_model_id and is_active = true
  limit 1;

  if v_duration is null then
    select duration_years, 'brand'
    into v_duration, v_resolved_level
    from warranty_policies
    where level_type = 'brand' and brand_id = v_brand_id and is_active = true
    limit 1;
  end if;

  if v_duration is null then
    select duration_years, 'category'
    into v_duration, v_resolved_level
    from warranty_policies
    where level_type = 'category' and category_id = v_category_id and is_active = true
    limit 1;
  end if;

  if v_duration is null or v_duration < 1 or v_duration > 15 then
    raise exception 'WARRANTY_POLICY_NOT_FOUND: No valid active warranty policy (1-15 years) found for Model: %, Brand: %, Category: %.', v_model_id, v_brand_id, v_category_id;
  end if;

  -- 6. Customer handling inside the SAME transaction (Case A: p_customer_id or Case B: p_customer jsonb)
  if p_customer_id is not null then
    if not exists (select 1 from customers where id = p_customer_id) then
      raise exception 'CUSTOMER_NOT_FOUND: Customer ID % does not exist.', p_customer_id;
    end if;
    v_resolved_customer_id := p_customer_id;
  elsif p_customer is not null then
    -- Required fields validation inside RPC
    if (p_customer->>'full_name') is null or trim(p_customer->>'full_name') = '' or
       (p_customer->>'phone') is null or trim(p_customer->>'phone') = '' or
       (p_customer->>'national_id') is null or trim(p_customer->>'national_id') = '' or
       (p_customer->>'governorate') is null or trim(p_customer->>'governorate') = '' or
       (p_customer->>'city') is null or trim(p_customer->>'city') = '' or
       (p_customer->>'address') is null or trim(p_customer->>'address') = '' then
      raise exception 'VALIDATION_ERROR: Customer full name, phone, national ID, governorate, city, and address are required.';
    end if;

    -- Resolve existing customer by phone OR national_id
    select id into v_existing_cust
    from customers
    where phone = trim(p_customer->>'phone') or national_id = trim(p_customer->>'national_id')
    limit 1;

    if v_existing_cust is not null then
      v_resolved_customer_id := v_existing_cust;
    else
      insert into customers (
        full_name,
        phone,
        alternative_phone,
        national_id,
        governorate,
        city,
        address
      ) values (
        trim(p_customer->>'full_name'),
        trim(p_customer->>'phone'),
        nullif(trim(p_customer->>'alternative_phone'), ''),
        trim(p_customer->>'national_id'),
        trim(p_customer->>'governorate'),
        trim(p_customer->>'city'),
        trim(p_customer->>'address')
      )
      returning id into v_resolved_customer_id;
    end if;
  else
    raise exception 'VALIDATION_ERROR: Either p_customer_id or p_customer details must be provided.';
  end if;

  -- 7. Execute atomic activation writes (All committed together or rolled back)
  v_activation_id := gen_random_uuid();

  insert into warranty_activations (
    id,
    serial_id,
    customer_id,
    invoice_number,
    invoice_date,
    activated_by,
    duration_years,
    warranty_end_date
  ) values (
    v_activation_id,
    p_serial_id,
    v_resolved_customer_id,
    trim(p_invoice_number),
    p_invoice_date,
    v_auth_user,
    v_duration,
    (p_invoice_date + make_interval(years => v_duration))::date
  );

  update serial_numbers
  set status = 'activated', updated_at = now()
  where id = p_serial_id;

  insert into serial_history (
    serial_id,
    event_type,
    notes,
    created_by
  ) values (
    p_serial_id,
    'activated',
    'تم تفعيل الضمان بنجاح برقم فاتورة: ' || trim(p_invoice_number) || ' لمدة ' || v_duration || ' سنوات (وفق سياسة ' || v_resolved_level || ')',
    v_auth_user
  );

  return v_activation_id;
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

create or replace function public.record_warranty_event(
    p_activation_id uuid,
    p_event_type text,
    p_notes text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
returns uuid as $$
declare
  v_log_id uuid;
  v_auth_user uuid;
  v_role text;
begin
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'UNAUTHORIZED: Authentication required to record warranty event.';
  end if;

  begin
    v_role := public.get_current_user_role();
  exception when others then
    raise exception 'UNAUTHORIZED: Role assignment required.';
  end;

  if v_role not in ('Administrator', 'Warranty Manager', 'Customer Service User') then
    raise exception 'UNAUTHORIZED: Role % is not permitted to record warranty events.', v_role;
  end if;

  if p_event_type not in ('verified', 'updated') then
    raise exception 'VALIDATION_ERROR: Invalid warranty event type %. Allowed: verified, updated.', p_event_type;
  end if;

  if not exists (select 1 from public.warranty_activations where id = p_activation_id) then
    raise exception 'WARRANTY_ACTIVATION_NOT_FOUND: Warranty activation ID % does not exist.', p_activation_id;
  end if;

  v_log_id := gen_random_uuid();

  insert into public.audit_logs (
    id,
    table_name,
    record_id,
    action_type,
    new_data,
    performed_by
  ) values (
    v_log_id,
    'warranty_activations',
    p_activation_id,
    'UPDATE',
    jsonb_build_object(
      'event_type', p_event_type,
      'notes', p_notes,
      'metadata', p_metadata
    ),
    v_auth_user
  );

  return v_log_id;
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

create or replace function public.record_application_event_v2(
  p_table_name text,
  p_record_id uuid,
  p_action_type text,
  p_new_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_id uuid := gen_random_uuid();
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role <> 'Administrator' and v_role not in ('Production Manager','Production Operator','Printing Operator','Warranty Manager','Customer Service User') then
    raise exception 'FORBIDDEN';
  end if;
  if p_table_name is null or p_record_id is null then raise exception 'AUDIT_TARGET_REQUIRED'; end if;
  if p_action_type not in ('INSERT','UPDATE','DELETE') then raise exception 'INVALID_AUDIT_ACTION'; end if;

  insert into public.audit_logs(id, table_name, record_id, action_type, new_data, performed_by)
  values(v_id, p_table_name, p_record_id, p_action_type, coalesce(p_new_data,'{}'::jsonb), v_user);
  return v_id;
end;
$$;

create or replace function public.create_service_case_v2(
  p_customer_id uuid,
  p_serial_id uuid,
  p_case_type text,
  p_subject text,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
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
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator', 'Customer Service User') then
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

create or replace function public.record_service_case_note(
  p_case_id uuid,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_note_id uuid;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator', 'Customer Service User') then raise exception 'FORBIDDEN'; end if;
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

create or replace function public.update_service_case_status_v2(
  p_case_id uuid,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_old text;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator', 'Customer Service User') then raise exception 'FORBIDDEN'; end if;
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

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role_name text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or public.get_current_user_role() <> 'Administrator' then raise exception 'FORBIDDEN'; end if;
  if p_role_name not in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User') then raise exception 'INVALID_ROLE'; end if;
  if not exists(select 1 from profiles where id=p_user_id) then raise exception 'USER_PROFILE_NOT_FOUND'; end if;

  insert into user_roles(user_id, role_name)
  values (p_user_id,p_role_name)
  on conflict (user_id) do update set role_name=excluded.role_name;

  insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('user_roles', p_user_id, 'UPDATE', jsonb_build_object('role_name',p_role_name), v_user);
  return p_user_id;
end;
$$;

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
set search_path = pg_catalog, public
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

create or replace function public.create_replacement_request_for_case_v1(
  p_service_case_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_case public.service_cases%rowtype;
  v_existing uuid;
  v_request_id uuid := gen_random_uuid();
  v_user uuid := auth.uid();
  v_number text;
  v_seq integer;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  if public.get_current_user_role() not in ('Administrator','Customer Service User') then raise exception 'FORBIDDEN'; end if;
  if p_service_case_id is null then raise exception 'SERVICE_CASE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;

  select * into v_case
    from public.service_cases
   where id = p_service_case_id
   for update;
  if not found then raise exception 'SERVICE_CASE_NOT_FOUND'; end if;
  if v_case.case_type <> 'replacement' then raise exception 'SERVICE_CASE_NOT_REPLACEMENT_TYPE'; end if;

  select id into v_existing
    from public.replacement_requests
   where service_case_id = p_service_case_id
   limit 1;
  if v_existing is not null then raise exception 'REPLACEMENT_ALREADY_EXISTS_FOR_CASE'; end if;

  if not exists (select 1 from public.customers where id = v_case.customer_id) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not exists (select 1 from public.serial_numbers where id = v_case.serial_id) then raise exception 'SERIAL_NOT_FOUND'; end if;

  loop
    v_seq := floor(random() * 900000) + 100000;
    v_number := format('RPL-%s-%s', to_char(current_date, 'YYYY'), lpad(v_seq::text, 6, '0'));
    exit when not exists (select 1 from public.replacement_requests where request_number = v_number);
  end loop;

  insert into public.replacement_requests(id, request_number, customer_id, service_case_id, serial_id, status, reason)
  values (v_request_id, v_number, v_case.customer_id, v_case.id, v_case.serial_id, 'requested', trim(p_reason));

  insert into public.replacement_history(replacement_request_id, event_type, notes, created_by)
  values (v_request_id, 'requested', format('Linked to service case %s.', v_case.case_number), v_user);
  insert into public.audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('replacement_requests', v_request_id, 'INSERT', jsonb_build_object('request_number', v_number, 'service_case_id', v_case.id, 'serial_id', v_case.serial_id), v_user);

  return v_request_id;
end;
$$;

create or replace function public.update_replacement_status_v2(
  p_request_id uuid,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_old text;
  v_new_serial uuid;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role <> 'Administrator' then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('under_review','issued','completed') then raise exception 'INVALID_REPLACEMENT_STATUS'; end if;

  select status, new_serial_id into v_old, v_new_serial
  from public.replacement_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'REPLACEMENT_NOT_FOUND'; end if;

  if not ((v_old = 'requested' and p_status = 'under_review')
       or (v_old = 'approved' and p_status = 'issued' and v_new_serial is not null)
       or (v_old = 'issued' and p_status = 'completed')) then
    raise exception 'INVALID_REPLACEMENT_TRANSITION: % -> %', v_old, p_status;
  end if;

  update public.replacement_requests set status = p_status, updated_at = now()
  where id = p_request_id;
  insert into public.replacement_history(replacement_request_id, event_type, notes, created_by)
  values (p_request_id, p_status, format('Replacement status changed: %s -> %s', v_old, p_status), v_user);
  insert into public.audit_logs(table_name, record_id, action_type, old_data, new_data, performed_by)
  values ('replacement_requests', p_request_id, 'UPDATE', jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), v_user);
  return p_request_id;
end;
$$;

create or replace function public.approve_replacement_v2(
  p_request_id uuid,
  p_new_serial_id uuid
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  if public.get_current_user_role() <> 'Administrator' then raise exception 'FORBIDDEN'; end if;
  if p_request_id is null or p_new_serial_id is null then raise exception 'REPLACEMENT_APPROVAL_INPUT_REQUIRED'; end if;

  -- Owner decision required: warranty transfer/SH behavior and serial lifecycle on replacement
  -- remain unresolved in the authoritative business references. Never mutate either serial or
  -- a warranty snapshot until that policy is explicitly approved and tested.
  raise exception 'REPLACEMENT_APPROVAL_BLOCKED: Owner approval of replacement serial status and warranty transfer rules is required.';
end;
$$;

create or replace function public.generate_serials(
  p_batch_id uuid,
  p_qty integer
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_batch public.production_batches%rowtype;
  v_order_status text;
  v_qty bigint;
  v_model_id uuid;
  v_model_count integer;
  v_code text;
  v_serial_id uuid;
  v_created integer := 0;
  i integer;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator','Production Manager','Production Operator') then raise exception 'FORBIDDEN'; end if;
  if p_batch_id is null then raise exception 'BATCH_REQUIRED'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'INVALID_SERIAL_QUANTITY'; end if;

  select * into v_batch from public.production_batches where id = p_batch_id for update;
  if not found then raise exception 'BATCH_NOT_FOUND'; end if;
  if v_batch.status <> 'created' then raise exception 'BATCH_ALREADY_SERIALIZED'; end if;
  select status into v_order_status from public.production_orders where id = v_batch.production_order_id;
  if v_order_status not in ('approved','in_production') then raise exception 'ORDER_NOT_READY_FOR_SERIALIZATION'; end if;

  select coalesce(sum(pol.quantity),0), (array_agg(pol.model_id))[1], count(distinct pol.model_id)
    into v_qty, v_model_id, v_model_count
  from public.production_order_lines pol
  where pol.production_order_id = v_batch.production_order_id;
  if v_qty <= 0 then raise exception 'BATCH_QUANTITY_INVALID'; end if;
  if p_qty <> v_qty then raise exception 'SERIAL_QUANTITY_MISMATCH: expected %, received %', v_qty, p_qty; end if;
  if v_model_count <> 1 or v_model_id is null then raise exception 'BATCH_MODEL_AMBIGUOUS'; end if;

  for i in 1..p_qty loop
    loop
      v_code := 'SLP-' || to_char(current_date, 'YYYY') || '-' || upper(substr(md5(gen_random_uuid()::text),1,8));
      v_serial_id := gen_random_uuid();
      insert into public.serial_numbers(id, serial_number, batch_id, model_id, status, production_date)
      values(v_serial_id, v_code, v_batch.id, v_model_id, 'generated', current_date)
      on conflict (serial_number) do nothing;
      exit when found;
    end loop;
    insert into public.serial_history(serial_id, event_type, event_date, notes, created_by)
    values(v_serial_id, 'generated', now(), 'Generated by the approved serialization RPC.', v_user);
    v_created := v_created + 1;
  end loop;

  update public.production_batches set status = 'serialized', updated_at = now() where id = v_batch.id;
  insert into public.audit_logs(table_name, record_id, action_type, new_data, performed_by)
  values ('production_batches', v_batch.id, 'UPDATE', jsonb_build_object('status','serialized','generated_count',v_created), v_user);
  return v_created;
end;
$$;

create or replace function public.global_search(p_query text)
returns table(match_type text, record_id uuid, display_text text, meta jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
  v_query text := nullif(trim(coalesce(p_query,'')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User') then
    raise exception 'FORBIDDEN';
  end if;
  if v_query is null or char_length(v_query) < 2 then return; end if;

  return query
  select x.match_type, x.record_id, x.display_text, x.meta
  from (
    select 'customer'::text as match_type, c.id as record_id, c.full_name as display_text,
           '{}'::jsonb as meta, c.created_at as created_at
    from public.customers c
    where c.full_name ilike '%' || v_query || '%'
    union all
    select 'serial', s.id, s.serial_number, jsonb_build_object('status',s.status), s.created_at
    from public.serial_numbers s where s.serial_number ilike '%' || v_query || '%'
    union all
    select 'service_case', sc.id, sc.case_number,
           jsonb_build_object('status',sc.status,'subject',sc.subject), sc.created_at
    from public.service_cases sc where sc.case_number ilike '%' || v_query || '%'
       or sc.subject ilike '%' || v_query || '%'
       
    union all
    select 'warranty', wa.id, s.serial_number,
           jsonb_build_object('serial_id',wa.serial_id,'warranty_end_date',wa.warranty_end_date), wa.created_at
    from public.warranty_activations wa
    join public.serial_numbers s on s.id=wa.serial_id
    where s.serial_number ilike '%' || v_query || '%'
    union all
    select 'order', po.id, po.order_number, jsonb_build_object('status',po.status), po.created_at
    from public.production_orders po where po.order_number ilike '%' || v_query || '%'
    union all
    select 'batch', pb.id, pb.batch_number, jsonb_build_object('status',pb.status), pb.created_at
    from public.production_batches pb where pb.batch_number ilike '%' || v_query || '%'
  ) x
  order by x.created_at desc
  limit 60;
end;
$$;

create or replace function public.get_dashboard_kpis()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User') then
    raise exception 'FORBIDDEN';
  end if;
  return jsonb_build_object(
    'active_orders_count', (select count(*) from public.production_orders where status in ('approved','in_production','partially_completed')),
    'pending_batches_count', (select count(*) from public.production_batches where status = 'created'),
    'printed_labels_count', (select count(*) from public.serial_numbers where status = 'printed'),
    'active_warranties_count', (select count(*) from public.warranty_activations where warranty_end_date >= current_date),
    'open_cases_count', (select count(*) from public.service_cases where status not in ('resolved','closed')),
    'open_replacements_count', (select count(*) from public.replacement_requests where status in ('requested','under_review','approved','issued'))
  );
end;
$$;

create or replace function public.replace_production_order_lines_v1(
  p_order_id uuid,
  p_lines jsonb
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_order public.production_orders%rowtype;
  v_line jsonb;
  v_count integer := 0;
  v_type_id uuid;
  v_category_id uuid;
  v_brand_id uuid;
  v_model_id uuid;
  v_mattress_size_id uuid;
  v_project_customer_id uuid;
  v_width integer;
  v_length integer;
  v_height integer;
  v_quantity integer;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator','Production Manager') then raise exception 'FORBIDDEN'; end if;
  if p_order_id is null then raise exception 'PRODUCTION_ORDER_REQUIRED'; end if;
  if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'PRODUCTION_VALIDATION_ERROR: Lines must be a JSON array.';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'PRODUCTION_VALIDATION_ERROR: At least one production line is required.';
  end if;

  select * into v_order from public.production_orders where id=p_order_id for update;
  if not found then raise exception 'PRODUCTION_ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'draft' then raise exception 'PRODUCTION_ORDER_LINES_LOCKED: Only draft orders can be edited.'; end if;

  -- Validate all proposed rows before touching current rows. The transaction is atomic.
  for v_line in select value from jsonb_array_elements(p_lines) as item(value) loop
    if nullif(trim(coalesce(v_line->>'product_type_id','')), '') is null
       or nullif(trim(coalesce(v_line->>'category_id','')), '') is null
       or nullif(trim(coalesce(v_line->>'brand_id','')), '') is null
       or nullif(trim(coalesce(v_line->>'model_id','')), '') is null then
      raise exception 'PRODUCTION_VALIDATION_ERROR: Each line requires product type, category, brand and model.';
    end if;
    if coalesce(v_line->>'width_cm','') !~ '^[0-9]+$'
       or coalesce(v_line->>'length_cm','') !~ '^[0-9]+$'
       or coalesce(v_line->>'height_cm','') !~ '^[0-9]+$'
       or coalesce(v_line->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'PRODUCTION_VALIDATION_ERROR: Dimensions and quantity must be positive integers.';
    end if;
    v_type_id := (v_line->>'product_type_id')::uuid;
    v_category_id := (v_line->>'category_id')::uuid;
    v_brand_id := (v_line->>'brand_id')::uuid;
    v_model_id := (v_line->>'model_id')::uuid;
    v_width := (v_line->>'width_cm')::integer;
    v_length := (v_line->>'length_cm')::integer;
    v_height := (v_line->>'height_cm')::integer;
    v_quantity := (v_line->>'quantity')::integer;
    v_mattress_size_id := nullif(trim(coalesce(v_line->>'mattress_size_id','')), '')::uuid;
    v_project_customer_id := nullif(trim(coalesce(v_line->>'project_customer_id','')), '')::uuid;
    if v_width <= 0 or v_length <= 0 or v_height <= 0 or v_quantity <= 0 then
      raise exception 'PRODUCTION_VALIDATION_ERROR: Dimensions and quantity must be greater than zero.';
    end if;
    if not exists(select 1 from public.product_types where id=v_type_id)
       or not exists(select 1 from public.models where id=v_model_id and brand_id=v_brand_id and category_id=v_category_id) then
      raise exception 'PRODUCTION_REFERENCE_MISMATCH: Product type or model/brand/category combination is not valid.';
    end if;
    if v_mattress_size_id is not null and not exists(select 1 from public.mattress_sizes where id=v_mattress_size_id) then
      raise exception 'PRODUCTION_REFERENCE_MISMATCH: Mattress size does not exist.';
    end if;
    if v_project_customer_id is not null and not exists(select 1 from public.customers where id=v_project_customer_id) then
      raise exception 'PRODUCTION_REFERENCE_MISMATCH: Project customer does not exist.';
    end if;
  end loop;

  delete from public.production_order_lines where production_order_id=p_order_id;
  for v_line in select value from jsonb_array_elements(p_lines) as item(value) loop
    insert into public.production_order_lines(
      production_order_id, product_type_id, category_id, brand_id, model_id,
      mattress_size_id, width_cm, length_cm, height_cm, quantity,
      project_name, project_customer_id, project_reference, project_specifications, notes
    ) values (
      p_order_id,
      (v_line->>'product_type_id')::uuid,
      (v_line->>'category_id')::uuid,
      (v_line->>'brand_id')::uuid,
      (v_line->>'model_id')::uuid,
      nullif(trim(coalesce(v_line->>'mattress_size_id','')), '')::uuid,
      (v_line->>'width_cm')::integer,
      (v_line->>'length_cm')::integer,
      (v_line->>'height_cm')::integer,
      (v_line->>'quantity')::integer,
      nullif(trim(coalesce(v_line->>'project_name','')), ''),
      nullif(trim(coalesce(v_line->>'project_customer_id','')), '')::uuid,
      nullif(trim(coalesce(v_line->>'project_reference','')), ''),
      nullif(trim(coalesce(v_line->>'project_specifications','')), ''),
      nullif(trim(coalesce(v_line->>'notes','')), '')
    );
    v_count := v_count + 1;
  end loop;

  update public.production_orders set updated_at=now() where id=p_order_id;
  insert into public.audit_logs(table_name,record_id,action_type,old_data,new_data,performed_by)
  values ('production_order_lines',p_order_id,'UPDATE',jsonb_build_object('order_number',v_order.order_number),jsonb_build_object('line_count',v_count),v_user);
  return v_count;
end;
$$;

create or replace function public.update_production_batch_status_v1(
  p_batch_id uuid,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_old_status text;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator','Production Manager','Production Operator') then raise exception 'FORBIDDEN'; end if;
  if p_status <> 'completed' then
    raise exception 'INVALID_BATCH_STATUS: Browser updates may complete only a genuinely printed batch; printed status is reserved for a validated printer integration.';
  end if;
  select status into v_old_status from public.production_batches where id=p_batch_id for update;
  if not found then raise exception 'PRODUCTION_BATCH_NOT_FOUND'; end if;
  if v_old_status <> 'printed' then raise exception 'INVALID_BATCH_TRANSITION: A batch must have a verified printed state before completion.'; end if;
  update public.production_batches set status='completed', updated_at=now() where id=p_batch_id;
  insert into public.audit_logs(table_name,record_id,action_type,old_data,new_data,performed_by)
  values ('production_batches',p_batch_id,'UPDATE',jsonb_build_object('status',v_old_status),jsonb_build_object('status','completed'),v_user);
  return p_batch_id;
end;
$$;

create or replace function public.update_print_job_status_v1(
  p_job_id uuid,
  p_status text,
  p_error_message text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_raw text;
  v_meta jsonb;
  v_current text;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;
  v_role := public.get_current_user_role();
  if v_role not in ('Administrator','Production Manager','Printing Operator') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('processing','paused','failed','cancelled') then
    raise exception 'INVALID_PRINT_JOB_STATUS: The client cannot mark a job printed or request an unsupported status.';
  end if;

  select printer_name into v_raw from public.print_jobs where id = p_job_id for update;
  if not found then raise exception 'PRINT_JOB_NOT_FOUND'; end if;

  begin
    v_meta := v_raw::jsonb;
    if jsonb_typeof(v_meta) <> 'object' then v_meta := '{}'::jsonb; end if;
  exception when others then
    v_meta := jsonb_build_object('printer', coalesce(nullif(v_raw,''), 'Zebra ZD220 Direct Thermal'));
  end;
  v_current := coalesce(v_meta->>'status', 'pending');

  if not (
      (v_current = 'pending' and p_status in ('processing','cancelled'))
      or (v_current = 'processing' and p_status in ('paused','failed','cancelled'))
      or (v_current = 'paused' and p_status in ('processing','cancelled'))
      or (v_current = 'failed' and p_status in ('processing','cancelled'))
  ) then
    raise exception 'INVALID_PRINT_JOB_TRANSITION: % -> %', v_current, p_status;
  end if;

  v_meta := v_meta || jsonb_build_object(
    'status', p_status,
    'error_message', nullif(trim(coalesce(p_error_message,'')), '')
  );
  update public.print_jobs set printer_name = v_meta::text where id = p_job_id;
  insert into public.audit_logs(table_name, record_id, action_type, old_data, new_data, performed_by)
  values ('print_jobs', p_job_id, 'UPDATE', jsonb_build_object('status',v_current), jsonb_build_object('status',p_status), v_user);
  return p_job_id;
end;
$$;

-- Function EXECUTE grants. The browser cannot write warranty_activations directly.
revoke all on function public.activate_warranty(uuid,uuid,jsonb,text,date) from public, anon;
grant execute on function public.activate_warranty(uuid,uuid,jsonb,text,date) to authenticated;
revoke all on function public.record_warranty_event(uuid,text,text,jsonb) from public, anon;
grant execute on function public.record_warranty_event(uuid,text,text,jsonb) to authenticated;
revoke all on function public.record_application_event_v2(text,uuid,text,jsonb) from public, anon;
grant execute on function public.record_application_event_v2(text,uuid,text,jsonb) to authenticated;
revoke all on function public.create_service_case_v2(uuid,uuid,text,text,text) from public, anon;
grant execute on function public.create_service_case_v2(uuid,uuid,text,text,text) to authenticated;
revoke all on function public.record_service_case_note(uuid,text) from public, anon;
grant execute on function public.record_service_case_note(uuid,text) to authenticated;
revoke all on function public.update_service_case_status_v2(uuid,text) from public, anon;
grant execute on function public.update_service_case_status_v2(uuid,text) to authenticated;
revoke all on function public.create_replacement_request_for_case_v1(uuid,text) from public, anon;
grant execute on function public.create_replacement_request_for_case_v1(uuid,text) to authenticated;
revoke all on function public.update_replacement_status_v2(uuid,text) from public, anon;
grant execute on function public.update_replacement_status_v2(uuid,text) to authenticated;
revoke all on function public.approve_replacement_v2(uuid,uuid) from public, anon;
grant execute on function public.approve_replacement_v2(uuid,uuid) to authenticated;
revoke all on function public.generate_serials(uuid,integer) from public, anon;
grant execute on function public.generate_serials(uuid,integer) to authenticated;
revoke all on function public.global_search(text) from public, anon;
grant execute on function public.global_search(text) to authenticated;
revoke all on function public.replace_production_order_lines_v1(uuid,jsonb) from public, anon;
grant execute on function public.replace_production_order_lines_v1(uuid,jsonb) to authenticated;
revoke all on function public.update_production_batch_status_v1(uuid,text) from public, anon;
grant execute on function public.update_production_batch_status_v1(uuid,text) to authenticated;
revoke all on function public.update_print_job_status_v1(uuid,text,text) from public, anon;
grant execute on function public.update_print_job_status_v1(uuid,text,text) to authenticated;
revoke all on function public.get_dashboard_kpis() from public, anon;
grant execute on function public.get_dashboard_kpis() to authenticated;
revoke all on function public.admin_set_user_role(uuid,text) from public, anon;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
revoke all on function public.public_verify_warranty(text) from public;
grant execute on function public.public_verify_warranty(text) to anon, authenticated;

-- Compatibility read-only summary view. It is an invoker view; its underlying rows remain governed by RLS.
create or replace view public.vw_dashboard_kpis with (security_invoker = true) as
select
  (select count(*) from public.production_orders where status in ('approved','in_production','partially_completed'))::bigint as active_orders_count,
  (select count(*) from public.production_batches where status = 'created')::bigint as pending_batches_count,
  (select count(*) from public.serial_numbers where status = 'printed')::bigint as printed_labels_count,
  (select count(*) from public.warranty_activations where warranty_end_date >= current_date)::bigint as active_warranties_count,
  (select count(*) from public.service_cases where status not in ('resolved','closed'))::bigint as open_cases_count,
  (select count(*) from public.replacement_requests where status in ('requested','under_review','approved','issued'))::bigint as open_replacements_count;

commit;
-- END REVIEW ONLY. Build/runtime/RLS integration and owner approval are required before execution.
