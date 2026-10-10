-- ==============================================================================
-- HISTORICAL / BOOTSTRAP REFERENCE ONLY
-- NOT THE CURRENT DEPLOYED DATABASE SCHEMA OR CONTRACT.
-- DO NOT EXECUTE THIS FILE AGAINST THE PRODUCTION SUPABASE DATABASE.
-- DO NOT USE THIS FILE TO INFER THE LIVE RPC CONTRACT.
-- 
-- The live Supabase PostgreSQL database is authoritative.
-- Active Phase 06 Serialization RPC Contract: generate_serials(p_batch_id uuid, p_qty integer)
-- ==============================================================================

-- ==================================================
-- SCHEMA INITIALIZATION: PHASE 02 FINAL COMPLETION PATCH
-- Company: Arabian Spring & Foam Mattresses Mfg. Company LTD (Sleepee)
-- Engine: Supabase PostgreSQL
-- Source File: schema.sql
-- ==================================================

-- Clean existing entities if any (for fresh execution)
drop view if exists vw_dashboard_kpis cascade;
drop view if exists vw_replacements cascade;
drop view if exists vw_service_cases cascade;
drop view if exists vw_warranty_activations cascade;
drop view if exists vw_serial_numbers cascade;
drop view if exists vw_serials cascade;
drop view if exists vw_batches cascade;
drop view if exists vw_production_orders cascade;

drop table if exists audit_logs cascade;
drop table if exists replacement_history cascade;
drop table if exists replacement_requests cascade;
drop table if exists service_attachments cascade;
drop table if exists service_case_notes cascade;
drop table if exists service_cases cascade;
drop table if exists warranty_activations cascade;
drop table if exists warranty_policies cascade;
drop table if exists print_history cascade;
drop table if exists print_jobs cascade;
drop table if exists label_templates cascade;
drop table if exists serial_history cascade;
drop table if exists serial_numbers cascade;
drop table if exists production_batches cascade;
drop table if exists production_order_lines cascade;
drop table if exists production_orders cascade;
drop table if exists customers cascade;
drop table if exists products cascade;
drop table if exists product_types cascade;
drop table if exists product_sizes cascade;
drop table if exists mattress_sizes cascade;
drop table if exists models cascade;
drop table if exists brands cascade;
drop table if exists categories cascade;
drop table if exists user_roles cascade;
drop table if exists profiles cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==================================================
-- SECURITY & PROFILES TABLES
-- ==================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  created_at timestamptz default now() not null
);

-- Approved Exactly 7 Roles in Role Model Constraint
create table user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  role_name text not null check (role_name in (
    'Administrator',
    'Production Manager',
    'Production Operator',
    'Printing Operator',
    'Warranty Officer',
    'Customer Service Agent',
    'Service Manager'
  )),
  created_at timestamptz default now() not null
);

-- ==================================================
-- MASTER DATA TABLES
-- ==================================================

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name_ar text not null,
  name_en text not null unique,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

create table brands (
  id uuid primary key default uuid_generate_v4(),
  name_ar text not null,
  name_en text not null unique,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

create table models (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete restrict,
  category_id uuid not null references categories(id) on delete restrict,
  name_ar text not null,
  name_en text not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz,
  constraint unique_model_brand_category_name unique (brand_id, category_id, name_en)
);

create table mattress_sizes (
  id uuid primary key default uuid_generate_v4(),
  width_cm integer not null check (width_cm > 0),
  length_cm integer not null check (length_cm > 0),
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint unique_mattress_size unique (width_cm, length_cm)
);

create table product_sizes (
  id uuid primary key default uuid_generate_v4(),
  size_value text not null unique,
  width_cm integer check (width_cm > 0),
  length_cm integer check (length_cm > 0),
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table product_types (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  created_at timestamptz default now() not null
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  category_id uuid not null references categories(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  model_id uuid not null references models(id) on delete restrict,
  width_cm integer check (width_cm > 0),
  length_cm integer check (length_cm > 0),
  height_cm integer check (height_cm > 0),
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

-- ==================================================
-- CUSTOMER TABLES
-- ==================================================

create table customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text not null,
  alternative_phone text,
  governorate text not null,
  city text not null,
  address text not null,
  national_id text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

create index idx_customers_phone on customers(phone);
create index idx_customers_national_id on customers(national_id);

-- ==================================================
-- PRODUCTION TABLES
-- ==================================================

create table production_orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique check (order_number ~ '^ORD-[0-9]{4}-[0-9]{6}$'),
  status text not null default 'draft' check (status in ('draft', 'planned', 'approved', 'in_production', 'completed', 'cancelled')),
  created_by uuid references profiles(id) on delete restrict,
  approved_by uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz
);

create table production_order_lines (
  id uuid primary key default uuid_generate_v4(),
  production_order_id uuid not null references production_orders(id) on delete cascade,
  product_type_id uuid not null references product_types(id) on delete restrict,
  category_id uuid not null references categories(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  model_id uuid not null references models(id) on delete restrict,
  width_cm integer not null check (width_cm > 0),
  length_cm integer not null check (length_cm > 0),
  height_cm integer not null check (height_cm > 0),
  quantity integer not null check (quantity > 0),
  notes text,
  constraint fk_line_model_brand foreign key (brand_id, model_id) references models(brand_id, id)
);

create table production_batches (
  id uuid primary key default uuid_generate_v4(),
  batch_number text not null unique check (batch_number ~ '^BAT-[0-9]{4}-[0-9]{6}$'),
  production_order_id uuid not null references production_orders(id) on delete cascade,
  status text not null default 'created' check (status in ('created', 'serialized', 'printed', 'completed')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ==================================================
-- SERIALIZATION TABLES & VALIDATION
-- ==================================================

create table serial_numbers (
  id uuid primary key default uuid_generate_v4(),
  serial_number text not null unique check (serial_number ~ '^SLP-[0-9]{4}-[A-Z0-9]{8}$'),
  batch_id uuid not null references production_batches(id) on delete cascade,
  model_id uuid not null references models(id) on delete restrict,
  status text not null default 'generated' check (status in ('generated', 'printed', 'sold', 'activated', 'service', 'replacement', 'closed')),
  production_date date default current_date not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_serial_number on serial_numbers(serial_number);

-- Serialization format validation helper function
create or replace function validate_serial_format(p_serial text)
returns boolean as $$
begin
  return p_serial ~ '^SLP-[0-9]{4}-[A-Z0-9]{8}$';
end;
$$ language plpgsql immutable;

create table serial_history (
  id uuid primary key default uuid_generate_v4(),
  serial_id uuid not null references serial_numbers(id) on delete cascade,
  event_type text not null check (event_type in ('generated', 'printed', 'shipped', 'sold', 'activated', 'support_opened', 'replaced', 'closed')),
  event_date timestamptz default now() not null,
  notes text,
  created_by uuid references profiles(id) on delete restrict
);

-- ==================================================
-- PRINTING TABLES
-- ==================================================

create table label_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid not null references categories(id) on delete restrict,
  label_width integer not null check (label_width > 0),
  label_height integer not null check (label_height > 0),
  template_json jsonb not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table print_jobs (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references label_templates(id) on delete restrict,
  printer_name text not null,
  copies integer not null check (copies > 0),
  created_by uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null
);

create table print_history (
  id uuid primary key default uuid_generate_v4(),
  print_job_id uuid not null references print_jobs(id) on delete cascade,
  serial_id uuid not null references serial_numbers(id) on delete cascade,
  printed_at timestamptz default now() not null
);

-- ==================================================
-- WARRANTY TABLES
-- ==================================================

create table warranty_policies (
  id uuid primary key default uuid_generate_v4(),
  level_type text not null check (level_type in ('category', 'brand', 'model')),
  category_id uuid references categories(id) on delete restrict,
  brand_id uuid references brands(id) on delete restrict,
  model_id uuid references models(id) on delete restrict,
  duration_years integer not null check (duration_years >= 0),
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  constraint unique_policy_level check (
    (level_type = 'category' and category_id is not null and brand_id is null and model_id is null) or
    (level_type = 'brand' and brand_id is not null and category_id is null and model_id is null) or
    (level_type = 'model' and model_id is not null and category_id is null and brand_id is null)
  )
);

create table warranty_activations (
  id uuid primary key default uuid_generate_v4(),
  serial_id uuid not null references serial_numbers(id) on delete restrict unique,
  customer_id uuid not null references customers(id) on delete restrict,
  invoice_number text not null,
  invoice_date date not null check (invoice_date <= current_date),
  activation_date timestamptz default now() not null,
  activated_by uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null,
  duration_years integer not null check (duration_years between 1 and 15),
  warranty_end_date date not null
);

create index idx_warranty_invoice on warranty_activations(invoice_number);

-- ==================================================
-- CUSTOMER SERVICE TABLES
-- ==================================================

create table service_cases (
  id uuid primary key default uuid_generate_v4(),
  case_number text not null unique check (case_number ~ '^CS-[0-9]{4}-[0-9]{6}$'),
  case_type text not null check (case_type in ('inquiry', 'complaint', 'warranty', 'maintenance', 'replacement', 'followup', 'other')),
  status text not null default 'open' check (status in ('open', 'assigned', 'inprogress', 'resolved', 'closed')),
  customer_id uuid not null references customers(id) on delete restrict,
  serial_id uuid not null references serial_numbers(id) on delete restrict,
  subject text not null,
  description text,
  assigned_to uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_cases_number on service_cases(case_number);

create table service_case_notes (
  id uuid primary key default uuid_generate_v4(),
  service_case_id uuid not null references service_cases(id) on delete cascade,
  note_text text not null,
  created_by uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null
);

create table service_attachments (
  id uuid primary key default uuid_generate_v4(),
  service_case_id uuid not null references service_cases(id) on delete cascade,
  file_path text not null,
  uploaded_by uuid references profiles(id) on delete restrict,
  uploaded_at timestamptz default now() not null
);

-- ==================================================
-- REPLACEMENT TABLES
-- ==================================================

create table replacement_requests (
  id uuid primary key default uuid_generate_v4(),
  request_number text not null unique check (request_number ~ '^RPL-[0-9]{4}-[0-9]{6}$'),
  customer_id uuid not null references customers(id) on delete restrict,
  serial_id uuid not null references serial_numbers(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested', 'under_review', 'approved', 'issued', 'completed', 'denied')),
  reason text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table replacement_history (
  id uuid primary key default uuid_generate_v4(),
  replacement_request_id uuid not null references replacement_requests(id) on delete cascade,
  event_type text not null,
  notes text,
  created_by uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null
);

-- ==================================================
-- AUDIT TABLES
-- ==================================================

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid not null,
  action_type text not null check (action_type in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  performed_by uuid references profiles(id) on delete restrict,
  created_at timestamptz default now() not null
);

-- Generic Audit Trigger Function
create or replace function process_audit_log()
returns trigger as $$
begin
  if (TG_OP = 'DELETE') then
    insert into audit_logs(table_name, record_id, action_type, old_data, performed_by)
    values (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    insert into audit_logs(table_name, record_id, action_type, old_data, new_data, performed_by)
    values (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    return NEW;
  elsif (TG_OP = 'INSERT') then
    insert into audit_logs(table_name, record_id, action_type, new_data, performed_by)
    values (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
    return NEW;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- ==================================================
-- EXECUTABLE REPORTING SQL VIEWS
-- ==================================================

create or replace view vw_production_orders as
select 
  PO.id, 
  PO.order_number, 
  PO.status, 
  PO.created_at, 
  PO.updated_at,
  P.full_name as creator_name,
  coalesce((select sum(quantity) from production_order_lines where production_order_id = PO.id), 0) as total_quantity
from production_orders PO
left join profiles P on PO.created_by = P.id
where PO.deleted_at is null;

create or replace view vw_batches as
select 
  PB.id, 
  PB.batch_number, 
  PB.production_order_id, 
  PB.status, 
  PB.created_at, 
  PB.updated_at,
  PO.order_number
from production_batches PB
join production_orders PO on PB.production_order_id = PO.id;

create or replace view vw_serial_numbers as
select 
  SN.id, 
  SN.serial_number, 
  SN.batch_id, 
  SN.model_id, 
  SN.status, 
  SN.production_date, 
  SN.created_at, 
  SN.updated_at,
  M.name_ar as model_name_ar, 
  M.name_en as model_name_en,
  B.name_ar as brand_name_ar, 
  B.name_en as brand_name_en,
  C.name_ar as category_name_ar, 
  C.name_en as category_name_en
from serial_numbers SN
join models M on SN.model_id = M.id
join brands B on M.brand_id = B.id
join categories C on M.category_id = C.id;

create or replace view vw_serials as
select * from vw_serial_numbers;

create or replace view vw_warranty_activations as
select 
  WA.id, 
  WA.serial_id, 
  WA.customer_id, 
  WA.invoice_number, 
  WA.invoice_date, 
  WA.activation_date, 
  WA.created_at,
  SN.serial_number,
  C.full_name as customer_name, 
  C.phone as customer_phone
from warranty_activations WA
join serial_numbers SN on WA.serial_id = SN.id
join customers C on WA.customer_id = C.id;

create or replace view vw_service_cases as
select 
  SC.id, 
  SC.case_number, 
  SC.case_type, 
  SC.status, 
  SC.subject, 
  SC.description, 
  SC.created_at, 
  SC.updated_at,
  C.full_name as customer_name, 
  C.phone as customer_phone,
  SN.serial_number,
  P.full_name as assignee_name
from service_cases SC
join customers C on SC.customer_id = C.id
join serial_numbers SN on SC.serial_id = SN.id
left join profiles P on SC.assigned_to = P.id;

create or replace view vw_replacements as
select 
  RR.id, 
  RR.request_number, 
  RR.status, 
  RR.reason, 
  RR.created_at, 
  RR.updated_at,
  C.full_name as customer_name, 
  C.phone as customer_phone,
  SN.serial_number
from replacement_requests RR
join customers C on RR.customer_id = C.id
join serial_numbers SN on RR.serial_id = SN.id;

create or replace view vw_dashboard_kpis as
select
  (select count(*) from production_orders where status != 'completed') as active_orders_count,
  (select count(*) from production_batches where status = 'created') as pending_batches_count,
  (select count(*) from serial_numbers where status = 'printed') as printed_labels_count,
  (select count(*) from warranty_activations) as active_warranties_count,
  (select count(*) from service_cases where status = 'open') as open_cases_count,
  (select count(*) from replacement_requests where status = 'requested') as open_replacements_count;

-- ==================================================
-- RPC FUNCTIONS
-- ==================================================

create or replace function generate_serials(
  p_batch_id uuid,
  p_model_id uuid,
  p_qty integer,
  p_user_id uuid
) returns void as $$
declare
  v_year text;
  v_seq text;
  i integer;
begin
  v_year := to_char(current_date, 'YYYY');
  for i in 1..p_qty loop
    loop
      v_seq := upper(substring(md5(gen_random_uuid()::text) from 1 for 8));
      if not exists (select 1 from serial_numbers where serial_number = 'SLP-' || v_year || '-' || v_seq) then
        exit;
      end if;
    end loop;

    insert into serial_numbers (id, serial_number, batch_id, model_id, status)
    values (gen_random_uuid(), 'SLP-' || v_year || '-' || v_seq, p_batch_id, p_model_id, 'generated');
  end loop;

  update production_batches set status = 'serialized' where id = p_batch_id;
end;
$$ language plpgsql security definer;

create or replace function create_batch(
  p_order_id uuid,
  p_qty integer
) returns uuid as $$
declare
  v_batch_id uuid;
  v_year text;
  v_seq text;
begin
  v_batch_id := uuid_generate_v4();
  v_year := to_char(current_date, 'YYYY');
  
  loop
    v_seq := lpad(floor(random() * 1000000)::text, 6, '0');
    if not exists (select 1 from production_batches where batch_number = 'BAT-' || v_year || '-' || v_seq) then
      exit;
    end if;
  end loop;

  insert into production_batches (id, batch_number, production_order_id, status)
  values (v_batch_id, 'BAT-' || v_year || '-' || v_seq, p_order_id, 'created');

  return v_batch_id;
end;
$$ language plpgsql security definer;

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

  select id into v_existing_act
  from warranty_activations
  where serial_id = p_serial_id;

  if v_existing_act is not null then
    raise exception 'WARRANTY_ALREADY_ACTIVE: Serial is already activated in the database.';
  end if;

  if p_invoice_number is null or trim(p_invoice_number) = '' then
    raise exception 'VALIDATION_ERROR: Invoice number is mandatory.';
  end if;

  if p_invoice_date is null then
    raise exception 'VALIDATION_ERROR: Invoice date is mandatory.';
  end if;

  if p_invoice_date > current_date then
    raise exception 'VALIDATION_ERROR: Invoice date cannot be in the future.';
  end if;

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

  if p_customer_id is not null then
    if not exists (select 1 from customers where id = p_customer_id) then
      raise exception 'CUSTOMER_NOT_FOUND: Customer ID % does not exist.', p_customer_id;
    end if;
    v_resolved_customer_id := p_customer_id;
  elsif p_customer is not null then
    if (p_customer->>'full_name') is null or trim(p_customer->>'full_name') = '' or
       (p_customer->>'phone') is null or trim(p_customer->>'phone') = '' or
       (p_customer->>'national_id') is null or trim(p_customer->>'national_id') = '' or
       (p_customer->>'governorate') is null or trim(p_customer->>'governorate') = '' or
       (p_customer->>'city') is null or trim(p_customer->>'city') = '' or
       (p_customer->>'address') is null or trim(p_customer->>'address') = '' then
      raise exception 'VALIDATION_ERROR: Customer full name, phone, national ID, governorate, city, and address are required.';
    end if;

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
-- RECORD WARRANTY EVENT RPC (VERIFIED / UPDATED)
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

create or replace function create_service_case(
  p_customer_id uuid,
  p_serial_id uuid,
  p_case_type text,
  p_subject text,
  p_description text,
  p_user_id uuid
) returns uuid as $$
declare
  v_case_id uuid;
  v_year text;
  v_seq text;
begin
  v_case_id := uuid_generate_v4();
  v_year := to_char(current_date, 'YYYY');
  
  loop
    v_seq := lpad(floor(random() * 1000000)::text, 6, '0');
    if not exists (select 1 from service_cases where case_number = 'CS-' || v_year || '-' || v_seq) then
      exit;
    end if;
  end loop;

  insert into service_cases (id, case_number, case_type, status, customer_id, serial_id, subject, description, assigned_to)
  values (v_case_id, 'CS-' || v_year || '-' || v_seq, p_case_type, 'open', p_customer_id, p_serial_id, p_subject, p_description, p_user_id);

  insert into service_case_notes (service_case_id, note_text, created_by)
  values (v_case_id, 'تم فتح تذكرة خدمة العملاء برقم ' || 'CS-' || v_year || '-' || v_seq, p_user_id);

  update serial_numbers set status = 'service' where id = p_serial_id;

  return v_case_id;
end;
$$ language plpgsql security definer;

create or replace function approve_replacement(
  p_request_id uuid,
  p_user_id uuid,
  p_new_serial_id uuid
) returns void as $$
begin
  update replacement_requests 
  set status = 'approved', updated_at = now() 
  where id = p_request_id;

  insert into replacement_history (replacement_request_id, event_type, notes, created_by)
  values (p_request_id, 'approved', 'تم اعتماد طلب التعويض وإصدار الكود البديل.', p_user_id);

  if p_new_serial_id is not null then
    update serial_numbers set status = 'replacement' where id = (
      select serial_id from replacement_requests where id = p_request_id
    );
    update serial_numbers set status = 'activated' where id = p_new_serial_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function get_dashboard_kpis()
returns json as $$
begin
  return (
    select row_to_json(r) from (
      select * from vw_dashboard_kpis
    ) r
  );
end;
$$ language plpgsql security definer;

create or replace function global_search(p_query text)
returns table (
  match_type text,
  record_id uuid,
  display_text text,
  meta json
) as $$
begin
  return query
  select 
    'customer'::text as match_type,
    id as record_id,
    full_name as display_text,
    json_build_object('phone', phone, 'national_id', national_id) as meta
  from customers
  where phone ilike '%' || p_query || '%' or national_id ilike '%' || p_query || '%'
  
  union all
  
  select 
    'serial'::text as match_type,
    id as record_id,
    serial_number as display_text,
    json_build_object('status', status) as meta
  from serial_numbers
  where serial_number ilike '%' || p_query || '%'
  
  union all
  
  select 
    'service_case'::text as match_type,
    id as record_id,
    case_number as display_text,
    json_build_object('status', status, 'type', case_type) as meta
  from service_cases
  where case_number ilike '%' || p_query || '%'
  
  union all
  
  select 
    'warranty'::text as match_type,
    id as record_id,
    invoice_number as display_text,
    json_build_object('invoice_date', invoice_date) as meta
  from warranty_activations
  where invoice_number ilike '%' || p_query || '%';
end;
$$ language plpgsql security definer;

-- ==================================================
-- REAL ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table categories enable row level security;
alter table brands enable row level security;
alter table models enable row level security;
alter table mattress_sizes enable row level security;
alter table product_sizes enable row level security;
alter table product_types enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table production_orders enable row level security;
alter table production_order_lines enable row level security;
alter table production_batches enable row level security;
alter table serial_numbers enable row level security;
alter table serial_history enable row level security;
alter table label_templates enable row level security;
alter table print_jobs enable row level security;
alter table print_history enable row level security;
alter table warranty_policies enable row level security;
alter table warranty_activations enable row level security;
alter table service_cases enable row level security;
alter table service_case_notes enable row level security;
alter table service_attachments enable row level security;
alter table replacement_requests enable row level security;
alter table replacement_history enable row level security;
alter table audit_logs enable row level security;

-- HARDENED ROLE RESOLUTION FUNCTION (FIX 02)
create or replace function get_current_user_role()
returns text
language plpgsql
security definer
as $$
declare
    v_role text;
begin
    select role_name
    into v_role
    from user_roles
    where user_id = auth.uid()
    limit 1;

    if v_role is null then
        raise exception 'USER_ROLE_NOT_ASSIGNED';
    end if;

    return v_role;
end;
$$;

-- 1. Profiles & Roles Policies
create policy "Profiles viewable by authenticated users" on profiles for select to authenticated using (true);
create policy "Users can update own profile" on profiles for update to authenticated using (id = auth.uid());
create policy "Roles viewable by staff" on user_roles for select to authenticated using (true);
create policy "Roles manageable by Administrator" on user_roles for all to authenticated using (get_current_user_role() = 'Administrator');

-- 2. Master Data Policies
create policy "Master data viewable categories" on categories for select to authenticated using (true);
create policy "Master data viewable brands" on brands for select to authenticated using (true);
create policy "Master data viewable models" on models for select to authenticated using (true);
create policy "Master data viewable mattress_sizes" on mattress_sizes for select to authenticated using (true);
create policy "Master data viewable product_sizes" on product_sizes for select to authenticated using (true);
create policy "Master data viewable product_types" on product_types for select to authenticated using (true);
create policy "Master data viewable products" on products for select to authenticated using (true);

create policy "Master data edit categories" on categories for all to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager'));
create policy "Master data edit brands" on brands for all to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager'));
create policy "Master data edit models" on models for all to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager'));

-- 3. Customers Policies
create policy "Customers select policy" on customers for select to authenticated using (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Warranty Officer', 'Service Manager', 'Production Manager'));
create policy "Customers insert policy" on customers for insert to authenticated with check (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Warranty Officer', 'Service Manager'));
create policy "Customers update policy" on customers for update to authenticated using (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Warranty Officer', 'Service Manager')) with check (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Warranty Officer', 'Service Manager'));

-- 4. Production Orders & Batches Policies
create policy "Production orders select" on production_orders for select to authenticated using (true);
create policy "Production order lines select" on production_order_lines for select to authenticated using (true);
create policy "Production batches select" on production_batches for select to authenticated using (true);

create policy "Production orders create" on production_orders for insert to authenticated with check (get_current_user_role() in ('Administrator', 'Production Manager'));
create policy "Production orders update" on production_orders for update to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager', 'Production Operator'));
create policy "Production order lines insert" on production_order_lines for all to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager'));
create policy "Batches insert" on production_batches for all to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager', 'Production Operator'));

-- 5. Serial Numbers Policies
create policy "Serials select" on serial_numbers for select to authenticated using (true);
create policy "Serials history select" on serial_history for select to authenticated using (true);
create policy "Serials history insert" on serial_history for insert to authenticated with check (get_current_user_role() in ('Administrator', 'Production Manager', 'Production Operator', 'Printing Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager'));
create policy "Serials manage" on serial_numbers for all to authenticated using (get_current_user_role() in ('Administrator', 'Production Manager', 'Production Operator', 'Printing Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager')) with check (get_current_user_role() in ('Administrator', 'Production Manager', 'Production Operator', 'Printing Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager'));

-- 6. Label Printing Policies
create policy "Templates select" on label_templates for select to authenticated using (true);
create policy "Templates insert" on label_templates for insert to authenticated with check (get_current_user_role() in ('Administrator', 'Printing Operator'));
create policy "Templates update" on label_templates for update to authenticated using (get_current_user_role() in ('Administrator', 'Printing Operator')) with check (get_current_user_role() in ('Administrator', 'Printing Operator'));
create policy "Templates delete" on label_templates for delete to authenticated using (get_current_user_role() in ('Administrator', 'Printing Operator'));
create policy "Print jobs select" on print_jobs for select to authenticated using (true);
create policy "Print history select" on print_history for select to authenticated using (true);
create policy "Print jobs manage" on print_jobs for all to authenticated using (get_current_user_role() in ('Administrator', 'Printing Operator', 'Production Manager'));
create policy "Print history insert" on print_history for all to authenticated using (get_current_user_role() in ('Administrator', 'Printing Operator'));

-- 7. Warranty Policies
create policy "Warranty policies select" on warranty_policies for select to authenticated using (true);
create policy "Warranty policies insert" on warranty_policies for insert to authenticated with check (get_current_user_role() in ('Administrator', 'Warranty Officer'));
create policy "Warranty policies update" on warranty_policies for update to authenticated using (get_current_user_role() in ('Administrator', 'Warranty Officer')) with check (get_current_user_role() in ('Administrator', 'Warranty Officer'));
create policy "Warranty policies delete" on warranty_policies for delete to authenticated using (get_current_user_role() in ('Administrator', 'Warranty Officer'));
create policy "Warranty activations select" on warranty_activations for select to authenticated using (true);

-- 8. Customer Service & Replacements Policies
create policy "Service cases select" on service_cases for select to authenticated using (true);
create policy "Service case notes select" on service_case_notes for select to authenticated using (true);
create policy "Service attachments select" on service_attachments for select to authenticated using (true);
create policy "Service cases manage" on service_cases for all to authenticated using (get_current_user_role() in ('Administrator', 'Customer Service Agent', 'Service Manager'));

create policy "Replacements select" on replacement_requests for select to authenticated using (true);
create policy "Replacements history select" on replacement_history for select to authenticated using (true);
create policy "Replacements manage" on replacement_requests for all to authenticated using (get_current_user_role() in ('Administrator', 'Service Manager'));

-- 9. Audit Logs Policies
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
