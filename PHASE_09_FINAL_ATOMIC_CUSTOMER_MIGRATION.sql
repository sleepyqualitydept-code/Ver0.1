-- ============================================================================
-- PHASE 09 — FINAL ATOMIC CUSTOMER + WARRANTY ACTIVATION MIGRATION
-- Complies strictly with Sleepee Single Source of Truth v1.0.
-- Authoritative RPC contract with atomic customer resolution/creation,
-- strict policy hierarchy, invoice validation, and audit tracking via auth.uid().
-- ============================================================================

-- Ensure RLS is enabled on all target tables
alter table if exists public.warranty_policies enable row level security;
alter table if exists public.warranty_activations enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.serial_numbers enable row level security;
alter table if exists public.serial_history enable row level security;

alter table if exists public.warranty_activations
  add column if not exists duration_years integer,
  add column if not exists warranty_end_date date;

-- Backfill existing activations from their authoritative serial activation history.
-- Supports both historical Arabic and English activation-note formats.
with parsed as (
  select
    wa.id,
    coalesce(
      substring(sh.notes from 'لمدة ([0-9]+) سنوات'),
      substring(sh.notes from 'for ([0-9]+) years')
    )::integer as duration_years
  from public.warranty_activations wa
  join lateral (
    select
      sh.notes,
      sh.event_date,
      sh.id
    from public.serial_history sh
    where sh.serial_id = wa.serial_id
      and sh.event_type = 'activated'
      and (
        sh.notes ~ 'لمدة [0-9]+ سنوات'
        or sh.notes ~ 'for [0-9]+ years'
      )
    order by sh.event_date desc, sh.id desc
    limit 1
  ) sh on true
  where wa.duration_years is null
)
update public.warranty_activations wa
set
  duration_years = parsed.duration_years,
  warranty_end_date = (wa.invoice_date + make_interval(years => parsed.duration_years))::date
from parsed
where wa.id = parsed.id
  and parsed.duration_years between 1 and 15;

DO $$
DECLARE
  v_missing integer;
BEGIN
  select count(*) into v_missing
  from public.warranty_activations
  where duration_years is null or warranty_end_date is null;

  if v_missing > 0 then
    raise exception 'WARRANTY_SNAPSHOT_BACKFILL_REQUIRED: % existing warranty activation(s) do not have immutable duration/end-date snapshots.', v_missing;
  end if;
END $$;

alter table if exists public.warranty_activations
  alter column duration_years set not null,
  alter column warranty_end_date set not null;

alter table if exists public.warranty_activations
  drop constraint if exists warranty_activations_duration_years_check;

alter table if exists public.warranty_activations
  add constraint warranty_activations_duration_years_check check (duration_years between 1 and 15);

-- ============================================================================
-- 1. REMOVE OBSOLETE DIRECT CLIENT INSERT/UPDATE/DELETE POLICIES ON WARRANTY_ACTIVATIONS
-- ============================================================================
drop policy if exists "Warranty activations insert" on public.warranty_activations;
drop policy if exists "Warranty activations select" on public.warranty_activations;
drop policy if exists "Warranty activations update" on public.warranty_activations;
drop policy if exists "Warranty activations delete" on public.warranty_activations;

create policy "Warranty activations select" on public.warranty_activations
  for select to authenticated
  using (true);

-- ============================================================================
-- 2. CLEAN UP OLD OVERLOADED ACTIVATE_WARRANTY FUNCTIONS
-- ============================================================================
drop function if exists public.activate_warranty(uuid, uuid, text, date, uuid, integer);
drop function if exists public.activate_warranty(uuid, uuid, text, date);
drop function if exists public.activate_warranty(uuid, uuid, jsonb, text, date);

-- ============================================================================
-- 3. CREATE AUTHORITATIVE ATOMIC ACTIVATE_WARRANTY RPC FUNCTION
-- ============================================================================
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
  -- 1. Authoritative actor & role validation using auth.uid() & get_current_user_role()
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'UNAUTHORIZED: Authentication required to activate warranty.';
  end if;

  begin
    v_role := get_current_user_role();
  exception when others then
    raise exception 'UNAUTHORIZED: Role assignment required.';
  end;

  if v_role not in ('Administrator', 'Warranty Officer', 'Customer Service Agent') then
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
$$ language plpgsql security definer set search_path = public;

-- Revoke public execution, grant to authenticated
revoke execute on function public.activate_warranty(uuid, uuid, jsonb, text, date) from public;
grant execute on function public.activate_warranty(uuid, uuid, jsonb, text, date) to authenticated;

-- ============================================================================
-- 4. RECORD WARRANTY EVENT RPC (VERIFIED / UPDATED)
-- ============================================================================
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
    v_role := get_current_user_role();
  exception when others then
    raise exception 'UNAUTHORIZED: Role assignment required.';
  end;

  if v_role not in ('Administrator', 'Warranty Officer', 'Customer Service Agent') then
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
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.record_warranty_event(uuid, text, text, jsonb) from public;
grant execute on function public.record_warranty_event(uuid, text, text, jsonb) to authenticated;

-- ============================================================================
-- 5. AUDIT LOGS SELECT RLS POLICY FOR WARRANTY ROLES
-- ============================================================================
drop policy if exists "Audit logs select" on public.audit_logs;
drop policy if exists "Audit logs insert" on public.audit_logs;

create policy "Audit logs select" on public.audit_logs
  for select to authenticated
  using (
    get_current_user_role() = 'Administrator'
    or (
      get_current_user_role() in ('Administrator', 'Warranty Officer', 'Customer Service Agent')
      and table_name = 'warranty_activations'
    )
  );

