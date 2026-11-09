-- ============================================================================
-- SLEEPEE DATABASE FOUNDATION — REVIEW ONLY v1.6.0-rc.2
-- Current location: supabase/proposed-migrations/ (NOT supabase/migrations/)
-- Status: REVIEW ONLY — DO NOT EXECUTE UNTIL OWNER APPROVAL
-- Authoritative business reference: Sleepee_Single_Source_Of_Truth_v1.0
-- Project target: NEW / EMPTY Supabase project only
--
-- SAFETY CONTRACT
-- * No DROP/TRUNCATE/DELETE statements or ALTER of existing application tables; no business/master-data seeds.
-- * The only data insert copies existing auth.users into profiles, without assigning roles.
-- * Entire script is transactional; any failure rolls back the full transaction.
-- * Preflight aborts if public already contains any table/view or if target buckets exist.
-- * Creates canonical business tables + constraints/indexes + trigger helpers + private bucket shells.
-- * Uses public.models as the canonical Product=Model entity (no duplicate products table).
-- * Enables RLS and revokes client table privileges, with NO permissive policies yet.
--   Therefore, after this schema-only phase, browser/API data access remains DENIED
--   until a separate security/RPC migration has been reviewed and approved.
-- * This draft intentionally does not create business RPCs or allow policies;
--   those are reviewed separately in 002 runtime contracts and 003 authorization policies.
-- * Role literals in 001-003 follow the seven names in the authoritative SSoT.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. PREFLIGHT: fail closed rather than overlaying an unexpected database.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: auth.users was not found; confirm this is a Supabase project.';
  end if;
  if to_regprocedure('auth.uid()') is null then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: auth.uid() was not found.';
  end if;
  if to_regclass('storage.buckets') is null then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: storage.buckets was not found.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: expected Supabase API roles anon/authenticated were not found.';
  end if;
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m','f')
  ) then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: public already contains a table/view. Stop and reconcile instead of running this foundation draft.';
  end if;
  if exists (
    select 1 from storage.buckets where id in ('labels','service','warranty') or name in ('labels','service','warranty')
  ) then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: one or more target Storage buckets already exist. Review bucket configuration manually.';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_current_user_role', 'validate_serial_format', 'set_updated_at',
        'guard_warranty_snapshot_immutability',
        'guard_sleepee_engineering_version_immutability',
        'guard_sleepee_engineering_child_draft_only',
        'reject_immutable_row_mutation', 'reject_serial_number_delete',
        'guard_serial_identity_immutability', 'handle_new_auth_user'
      )
  ) then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: one or more target helper functions already exist. Reconcile before proceeding.';
  end if;
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'trg_sleepee_profile_on_auth_user_created'
      and not t.tgisinternal
  ) then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: target Auth profile trigger already exists; inspect it before proceeding.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. IDENTITY AND ROLE ASSIGNMENT
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text,
  full_name text not null,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Application profile for a Supabase Auth user; not an authentication credential store.';

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  role_name text not null check (role_name in (
    'Administrator',
    'Production Manager',
    'Production Operator',
    'Printing Operator',
    'Customer Service User',
    'Warranty Manager',
    'Read Only User'
  )),
  created_at timestamptz not null default now()
);
comment on table public.user_roles is 'One server-assigned canonical SSoT role per application user. No self-selected role is accepted.';

-- ---------------------------------------------------------------------------
-- 2. MASTER DATA AND CATALOG
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categories_name_ar_nonempty check (length(trim(name_ar)) > 0),
  constraint categories_name_en_nonempty check (length(trim(name_en)) > 0)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint brands_name_ar_nonempty check (length(trim(name_ar)) > 0),
  constraint brands_name_en_nonempty check (length(trim(name_en)) > 0)
);

create table public.models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  name_ar text not null,
  name_en text not null,
  base_model_id uuid references public.models(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint models_name_ar_nonempty check (length(trim(name_ar)) > 0),
  constraint models_name_en_nonempty check (length(trim(name_en)) > 0),
  constraint models_not_own_base check (base_model_id is null or base_model_id <> id),
  constraint unique_model_brand_category_name unique (brand_id, category_id, name_en),
  constraint models_brand_category_id_unique unique (brand_id, category_id, id)
);
comment on column public.models.base_model_id is 'Optional lineage link for brand/model reuse; populate only from an approved catalog mapping.';

create table public.mattress_sizes (
  id uuid primary key default gen_random_uuid(),
  width_cm integer not null check (width_cm > 0),
  length_cm integer not null check (length_cm > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_mattress_size unique (width_cm, length_cm)
);

-- Product sizes are not duplicated: standard mattress dimensions live in public.mattress_sizes;
-- other product dimensions are captured on production_order_lines as source-confirmed values.

create table public.product_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  created_at timestamptz not null default now(),
  constraint product_types_code_nonempty check (length(trim(code)) > 0)
);

-- Canonical catalog rule: Product = Model. public.models is the canonical product/model entity.
-- No separate public.products table is created. The current health-check UI must be aligned to models.

-- ---------------------------------------------------------------------------
-- 3. CUSTOMER, PRODUCTION, BATCH AND SERIAL TRACEABILITY
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  alternative_phone text,
  governorate text,
  city text,
  address text,
  national_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customers_full_name_nonempty check (length(trim(full_name)) > 0),
  constraint customers_phone_nonempty check (length(trim(phone)) > 0)
);

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^ORD-[0-9]{4}-[0-9]{6}$'),
  status text not null default 'draft' check (status in (
    'draft','planned','approved','in_production','partially_completed','completed','cancelled'
  )),
  sales_channel text check (sales_channel is null or sales_channel in ('Factory','Branch','Dealer','Distributor','Showroom')),
  created_by uuid references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.production_order_lines (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  product_type_id uuid not null references public.product_types(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete restrict,
  model_id uuid not null,
  mattress_size_id uuid references public.mattress_sizes(id) on delete restrict,
  width_cm integer not null check (width_cm > 0),
  length_cm integer not null check (length_cm > 0),
  height_cm integer not null check (height_cm > 0),
  quantity integer not null check (quantity > 0),
  project_name text,
  project_customer_id uuid references public.customers(id) on delete restrict,
  project_reference text,
  project_specifications text,
  notes text,
  constraint production_order_lines_model_id_fkey foreign key (model_id)
    references public.models(id) on delete restrict,
  constraint production_order_lines_model_brand_category_fkey foreign key (brand_id, category_id, model_id)
    references public.models(brand_id, category_id, id) on delete restrict
);

create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique check (batch_number ~ '^BAT-[0-9]{4}-[0-9]{6}$'),
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  status text not null default 'created' check (status in ('created','serialized','printed','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.serial_numbers (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique check (serial_number ~ '^SLP-[0-9]{4}-[A-Z0-9]{8}$'),
  batch_id uuid not null references public.production_batches(id) on delete restrict,
  model_id uuid not null references public.models(id) on delete restrict,
  status text not null default 'generated' check (status in (
    'generated','printed','sold','activated','service','replacement','closed'
  )),
  production_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.serial_numbers is 'Globally unique, non-reusable serials. Client delete permissions are intentionally absent.';

create table public.serial_history (
  id uuid primary key default gen_random_uuid(),
  serial_id uuid not null references public.serial_numbers(id) on delete restrict,
  event_type text not null check (lower(trim(event_type)) in (
    'generated','printed','shipped','sold','activated','service','support_opened','replaced','replacement','closed','expired'
  )),
  event_date timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles(id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- 4. LABEL DESIGN, PRINT JOBS AND PRINT HISTORY
-- ---------------------------------------------------------------------------
create table public.label_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  label_width integer not null check (label_width > 0),
  label_height integer not null check (label_height > 0),
  template_json jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint label_templates_name_nonempty check (length(trim(name)) > 0)
);
comment on column public.label_templates.label_height is 'Positive millimetre dimension. Allows approved presets and custom sizes; no hard-coded 50/100-only restriction.';

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.label_templates(id) on delete restrict,
  printer_name text not null,
  copies integer not null check (copies > 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.print_history (
  id uuid primary key default gen_random_uuid(),
  print_job_id uuid not null references public.print_jobs(id) on delete restrict,
  serial_id uuid not null references public.serial_numbers(id) on delete restrict,
  printed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. WARRANTY POLICY AND IMMUTABLE ACTIVATION SNAPSHOT
-- ---------------------------------------------------------------------------
create table public.warranty_policies (
  id uuid primary key default gen_random_uuid(),
  level_type text not null check (level_type in ('category','brand','model')),
  category_id uuid references public.categories(id) on delete restrict,
  brand_id uuid references public.brands(id) on delete restrict,
  model_id uuid references public.models(id) on delete restrict,
  duration_years integer not null check (duration_years between 1 and 15),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint warranty_policy_scope_valid check (
    (level_type = 'category' and category_id is not null and brand_id is null and model_id is null) or
    (level_type = 'brand' and category_id is null and brand_id is not null and model_id is null) or
    (level_type = 'model' and category_id is null and brand_id is null and model_id is not null)
  )
);

create unique index ux_warranty_policy_active_category
  on public.warranty_policies(category_id) where is_active and level_type = 'category';
create unique index ux_warranty_policy_active_brand
  on public.warranty_policies(brand_id) where is_active and level_type = 'brand';
create unique index ux_warranty_policy_active_model
  on public.warranty_policies(model_id) where is_active and level_type = 'model';

create table public.warranty_activations (
  id uuid primary key default gen_random_uuid(),
  serial_id uuid not null unique references public.serial_numbers(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_number text not null check (length(trim(invoice_number)) > 0),
  invoice_date date not null check (invoice_date <= current_date),
  activation_date timestamptz not null default now(),
  activated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  duration_years integer not null check (duration_years between 1 and 15),
  warranty_end_date date not null,
  constraint warranty_end_not_before_invoice check (warranty_end_date >= invoice_date)
);
comment on table public.warranty_activations is 'One activation per serial; duration_years and warranty_end_date are immutable snapshots resolved at activation.';

-- ---------------------------------------------------------------------------
-- 6. CUSTOMER SERVICE, REPLACEMENTS AND AUDIT
-- ---------------------------------------------------------------------------
create table public.service_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique check (case_number ~ '^CS-[0-9]{4}-[0-9]{6}$'),
  case_type text not null check (case_type in ('inquiry','complaint','warranty','maintenance','replacement','followup','other')),
  status text not null default 'open' check (status in ('open','assigned','inprogress','resolved','closed')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  serial_id uuid not null references public.serial_numbers(id) on delete restrict,
  subject text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_cases_subject_nonempty check (length(trim(subject)) > 0)
);

create table public.service_case_notes (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references public.service_cases(id) on delete restrict,
  note_text text not null,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint service_case_notes_text_nonempty check (length(trim(note_text)) > 0)
);

create table public.service_attachments (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references public.service_cases(id) on delete restrict,
  file_path text not null,
  uploaded_by uuid references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  constraint service_attachments_path_nonempty check (length(trim(file_path)) > 0)
);

create table public.replacement_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique check (request_number ~ '^RPL-[0-9]{4}-[0-9]{6}$'),
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_case_id uuid references public.service_cases(id) on delete restrict,
  serial_id uuid not null references public.serial_numbers(id) on delete restrict,
  new_serial_id uuid references public.serial_numbers(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested','under_review','approved','issued','completed')),
  reason text not null,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint replacement_reason_nonempty check (length(trim(reason)) > 0),
  constraint replacement_serials_distinct check (new_serial_id is null or new_serial_id <> serial_id)
);
comment on column public.replacement_requests.service_case_id is 'Optional link to the originating service case; populated by the reviewed replacement RPC. No existing production data is migrated by this candidate.';

create table public.replacement_history (
  id uuid primary key default gen_random_uuid(),
  replacement_request_id uuid not null references public.replacement_requests(id) on delete restrict,
  event_type text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint replacement_history_event_nonempty check (length(trim(event_type)) > 0)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action_type text not null check (action_type in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  performed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
comment on table public.audit_logs is 'Append-oriented business audit record. Client-side direct writes remain disabled pending audited RPCs.';

-- ---------------------------------------------------------------------------
-- 7. MANUFACTURING ENGINEERING: MODEL SPECS, BOM VERSIONS AND ROUTING VERSIONS
-- No workbook rows or inferred BOM/routing timings are seeded.
-- ---------------------------------------------------------------------------
create table public.model_engineering_specs (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null unique references public.models(id) on delete restrict,
  construction_type text,
  manufacturing_system text,
  face_configuration text,
  spring_wire_diameter_mm numeric(5,2) check (spring_wire_diameter_mm is null or spring_wire_diameter_mm > 0),
  notes text,
  source_reference text,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_bom_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete restrict,
  version_code text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  source_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_bom_version_code_nonempty check (length(trim(version_code)) > 0),
  constraint product_bom_effective_dates_valid check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint product_bom_model_version_unique unique (model_id, version_code)
);

create table public.product_bom_components (
  id uuid primary key default gen_random_uuid(),
  bom_version_id uuid not null references public.product_bom_versions(id) on delete restrict,
  sequence_no integer not null default 1 check (sequence_no > 0),
  component_type text,
  component_code text,
  component_name_ar text not null,
  component_name_en text,
  quantity numeric(14,5) not null check (quantity > 0),
  unit_of_measure text not null,
  length_cm numeric(10,3) check (length_cm is null or length_cm > 0),
  width_cm numeric(10,3) check (width_cm is null or width_cm > 0),
  height_cm numeric(10,3) check (height_cm is null or height_cm > 0),
  face_scope text,
  attachment_method text,
  is_required boolean not null default true,
  source_reference text,
  source_description text,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_bom_component_name_ar_nonempty check (length(trim(component_name_ar)) > 0),
  constraint product_bom_component_uom_nonempty check (length(trim(unit_of_measure)) > 0)
);

create table public.manufacturing_routing_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete restrict,
  version_code text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  manufacturing_system text,
  forming_line text,
  source_total_minutes numeric(12,3) check (source_total_minutes is null or source_total_minutes > 0),
  source_output_quantity numeric(12,3) check (source_output_quantity is null or source_output_quantity > 0),
  source_time_scope text,
  source_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routing_version_code_nonempty check (length(trim(version_code)) > 0),
  constraint routing_effective_dates_valid check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint routing_model_version_unique unique (model_id, version_code)
);

create table public.manufacturing_routing_steps (
  id uuid primary key default gen_random_uuid(),
  routing_version_id uuid not null references public.manufacturing_routing_versions(id) on delete restrict,
  step_sequence integer not null check (step_sequence > 0),
  department_code text not null check (department_code in (
    'wire_chassis','quilting_tailoring','upholstery_assembly','tape_edge','packaging'
  )),
  operation_name_ar text not null,
  operation_name_en text,
  machine_or_line text,
  estimated_minutes numeric(12,3) check (estimated_minutes is null or estimated_minutes > 0),
  measured_minutes numeric(12,3) check (measured_minutes is null or measured_minutes > 0),
  repeat_group text,
  is_optional boolean not null default false,
  source_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routing_step_sequence_unique unique (routing_version_id, step_sequence),
  constraint routing_step_operation_name_ar_nonempty check (length(trim(operation_name_ar)) > 0)
);

-- ---------------------------------------------------------------------------
-- 8. INDEXES FOR JOIN/FILTER/TIMELINE PATHS
-- ---------------------------------------------------------------------------
create index idx_customers_phone on public.customers(phone);
create index idx_models_brand_category on public.models(brand_id, category_id);
create index idx_production_orders_status_created on public.production_orders(status, created_at desc);
create index idx_production_order_lines_order on public.production_order_lines(production_order_id);
create index idx_production_order_lines_model on public.production_order_lines(model_id);
create index idx_production_order_lines_mattress_size on public.production_order_lines(mattress_size_id);
create index idx_production_batches_order_status on public.production_batches(production_order_id, status);
create index idx_serial_numbers_batch on public.serial_numbers(batch_id);
create index idx_serial_numbers_model_status on public.serial_numbers(model_id, status);
create index idx_serial_history_serial_event on public.serial_history(serial_id, event_date);
create index idx_print_history_serial on public.print_history(serial_id, printed_at);
create index idx_warranty_activations_invoice on public.warranty_activations(invoice_number);
create index idx_service_cases_customer on public.service_cases(customer_id);
create index idx_service_cases_serial on public.service_cases(serial_id);
create index idx_service_cases_assignee on public.service_cases(assigned_to);
create index idx_service_case_notes_case on public.service_case_notes(service_case_id, created_at);
create index idx_service_attachments_case on public.service_attachments(service_case_id);
create index idx_replacement_requests_customer on public.replacement_requests(customer_id);
create index idx_replacement_requests_serial on public.replacement_requests(serial_id);
create index idx_replacement_requests_new_serial on public.replacement_requests(new_serial_id);
create index idx_replacement_history_request on public.replacement_history(replacement_request_id, created_at);
create index idx_audit_logs_record on public.audit_logs(table_name, record_id, created_at desc);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index idx_bom_versions_model on public.product_bom_versions(model_id, created_at desc);
create index idx_bom_components_version_sequence on public.product_bom_components(bom_version_id, sequence_no);
create index idx_routing_versions_model on public.manufacturing_routing_versions(model_id, created_at desc);
create index idx_routing_steps_version_sequence on public.manufacturing_routing_steps(routing_version_id, step_sequence);

-- ---------------------------------------------------------------------------
-- 9. SUPPORT FUNCTIONS AND TRIGGERS (NO BUSINESS RPC CONTRACTS YET)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select ur.role_name
  from public.user_roles ur
  where ur.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.validate_serial_format(p_serial text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select coalesce(p_serial ~ '^SLP-[0-9]{4}-[A-Z0-9]{8}$', false);
$$;

create or replace function public.guard_warranty_snapshot_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- Warranty activation is a historical event. Corrections must use an explicitly
  -- reviewed correction workflow/audit event, never UPDATE or DELETE this row.
  raise exception 'WARRANTY_ACTIVATION_IMMUTABLE: warranty activation records are append-only; record a reviewed correction event instead.';
end;
$$;

create or replace function public.guard_sleepee_engineering_version_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'ENGINEERING_VERSION_IMMUTABLE: create a new version instead of deleting a non-draft version.';
    end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if old.status = 'approved' and new.status = 'retired'
       and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'ENGINEERING_VERSION_IMMUTABLE: create a new version instead of changing an approved/retired version.';
  end if;
  if new.status = 'retired' then
    raise exception 'ENGINEERING_VERSION_TRANSITION_INVALID: approve a draft before retiring it.';
  end if;
  if new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    if new.effective_from is null then new.effective_from := current_date; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_sleepee_engineering_child_draft_only()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_old_status text;
  v_new_status text;
  v_old_parent uuid;
  v_new_parent uuid;
  v_parent_table text;
begin
  if tg_table_name = 'product_bom_components' then
    v_parent_table := 'product_bom_versions';
    if tg_op <> 'INSERT' then v_old_parent := old.bom_version_id; end if;
    if tg_op <> 'DELETE' then v_new_parent := new.bom_version_id; end if;
  else
    v_parent_table := 'manufacturing_routing_versions';
    if tg_op <> 'INSERT' then v_old_parent := old.routing_version_id; end if;
    if tg_op <> 'DELETE' then v_new_parent := new.routing_version_id; end if;
  end if;

  if tg_op = 'UPDATE' and v_old_parent is distinct from v_new_parent then
    raise exception 'ENGINEERING_CHILD_PARENT_IMMUTABLE: move a component/step by deleting and recreating it while both versions are drafts.';
  end if;

  if tg_op <> 'INSERT' then
    if v_parent_table = 'product_bom_versions' then
      select status into v_old_status from public.product_bom_versions where id = v_old_parent for update;
    else
      select status into v_old_status from public.manufacturing_routing_versions where id = v_old_parent for update;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if v_parent_table = 'product_bom_versions' then
      select status into v_new_status from public.product_bom_versions where id = v_new_parent for update;
    else
      select status into v_new_status from public.manufacturing_routing_versions where id = v_new_parent for update;
    end if;
  end if;

  if tg_op = 'INSERT' and v_new_status is distinct from 'draft' then
    raise exception 'ENGINEERING_PARENT_NOT_DRAFT: child rows may only be inserted while the parent version is draft.';
  elsif tg_op = 'UPDATE' and (v_old_status is distinct from 'draft' or v_new_status is distinct from 'draft') then
    raise exception 'ENGINEERING_PARENT_NOT_DRAFT: child rows may only be changed while the parent version is draft.';
  elsif tg_op = 'DELETE' and v_old_status is distinct from 'draft' then
    raise exception 'ENGINEERING_PARENT_NOT_DRAFT: child rows may only be deleted while the parent version is draft.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Append-only audit/history guard. Corrections are recorded as new events.
create or replace function public.reject_immutable_row_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'APPEND_ONLY_RECORD: UPDATE/DELETE is not permitted on %.%; append a new event instead.',
    tg_table_schema, tg_table_name;
end;
$$;

-- Serial records are never deleted; status changes happen through reviewed business operations.
create or replace function public.reject_serial_number_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'SERIAL_NEVER_DELETED: serial numbers are traceability records and cannot be deleted or reused.';
end;
$$;

-- Serial identity is immutable even when a later role can update lifecycle status.
create or replace function public.guard_serial_identity_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.serial_number is distinct from old.serial_number
     or new.batch_id is distinct from old.batch_id
     or new.model_id is distinct from old.model_id
     or new.production_date is distinct from old.production_date then
    raise exception 'SERIAL_IDENTITY_IMMUTABLE: serial code, batch, model, and production date cannot be changed after generation.';
  end if;
  return new;
end;
$$;

-- Create a profile for each Supabase Auth account without assigning a business role.
-- Role assignment remains administrator-controlled in the later security/RPC migration.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- updated_at triggers
create trigger trg_categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger trg_brands_set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger trg_models_set_updated_at before update on public.models for each row execute function public.set_updated_at();
create trigger trg_mattress_sizes_set_updated_at before update on public.mattress_sizes for each row execute function public.set_updated_at();
create trigger trg_customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger trg_production_orders_set_updated_at before update on public.production_orders for each row execute function public.set_updated_at();
create trigger trg_production_batches_set_updated_at before update on public.production_batches for each row execute function public.set_updated_at();
create trigger trg_serial_numbers_set_updated_at before update on public.serial_numbers for each row execute function public.set_updated_at();
create trigger trg_label_templates_set_updated_at before update on public.label_templates for each row execute function public.set_updated_at();
create trigger trg_service_cases_set_updated_at before update on public.service_cases for each row execute function public.set_updated_at();
create trigger trg_replacement_requests_set_updated_at before update on public.replacement_requests for each row execute function public.set_updated_at();
create trigger trg_model_engineering_specs_set_updated_at before update on public.model_engineering_specs for each row execute function public.set_updated_at();
create trigger trg_product_bom_versions_set_updated_at before update on public.product_bom_versions for each row execute function public.set_updated_at();
create trigger trg_product_bom_components_set_updated_at before update on public.product_bom_components for each row execute function public.set_updated_at();
create trigger trg_routing_versions_set_updated_at before update on public.manufacturing_routing_versions for each row execute function public.set_updated_at();
create trigger trg_routing_steps_set_updated_at before update on public.manufacturing_routing_steps for each row execute function public.set_updated_at();

create trigger trg_warranty_snapshot_immutable
before update or delete on public.warranty_activations
for each row execute function public.guard_warranty_snapshot_immutability();

create trigger trg_serial_numbers_never_delete
before delete on public.serial_numbers
for each row execute function public.reject_serial_number_delete();
create trigger trg_serial_identity_immutable
before update on public.serial_numbers
for each row execute function public.guard_serial_identity_immutability();

create trigger trg_serial_history_append_only
before update or delete on public.serial_history
for each row execute function public.reject_immutable_row_mutation();
create trigger trg_print_history_append_only
before update or delete on public.print_history
for each row execute function public.reject_immutable_row_mutation();
create trigger trg_replacement_history_append_only
before update or delete on public.replacement_history
for each row execute function public.reject_immutable_row_mutation();
create trigger trg_audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.reject_immutable_row_mutation();

create trigger trg_sleepee_profile_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill profile shells for Auth users that may already exist in this new project.
-- This does not assign roles or copy any business/customer data.
insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'User'
  )
from auth.users u
on conflict (id) do nothing;

create trigger trg_product_bom_version_immutability
before update or delete on public.product_bom_versions
for each row execute function public.guard_sleepee_engineering_version_immutability();
create trigger trg_routing_version_immutability
before update or delete on public.manufacturing_routing_versions
for each row execute function public.guard_sleepee_engineering_version_immutability();
create trigger trg_product_bom_component_draft_only
before insert or update or delete on public.product_bom_components
for each row execute function public.guard_sleepee_engineering_child_draft_only();
create trigger trg_manufacturing_routing_step_draft_only
before insert or update or delete on public.manufacturing_routing_steps
for each row execute function public.guard_sleepee_engineering_child_draft_only();

-- ---------------------------------------------------------------------------
-- 10. CLOSED-BY-DEFAULT SECURITY BOUNDARY
-- RLS on every business table; this migration deliberately creates zero allow policies.
-- A separate, reviewed access/RPC migration must define least-privilege policies.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.models enable row level security;
alter table public.mattress_sizes enable row level security;
alter table public.product_types enable row level security;
alter table public.customers enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_order_lines enable row level security;
alter table public.production_batches enable row level security;
alter table public.serial_numbers enable row level security;
alter table public.serial_history enable row level security;
alter table public.label_templates enable row level security;
alter table public.print_jobs enable row level security;
alter table public.print_history enable row level security;
alter table public.warranty_policies enable row level security;
alter table public.warranty_activations enable row level security;
alter table public.service_cases enable row level security;
alter table public.service_case_notes enable row level security;
alter table public.service_attachments enable row level security;
alter table public.replacement_requests enable row level security;
alter table public.replacement_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.model_engineering_specs enable row level security;
alter table public.product_bom_versions enable row level security;
alter table public.product_bom_components enable row level security;
alter table public.manufacturing_routing_versions enable row level security;
alter table public.manufacturing_routing_steps enable row level security;

revoke all privileges on table
  public.profiles, public.user_roles,
  public.categories, public.brands, public.models, public.mattress_sizes, public.product_types,
  public.customers, public.production_orders, public.production_order_lines, public.production_batches,
  public.serial_numbers, public.serial_history,
  public.label_templates, public.print_jobs, public.print_history,
  public.warranty_policies, public.warranty_activations,
  public.service_cases, public.service_case_notes, public.service_attachments,
  public.replacement_requests, public.replacement_history, public.audit_logs,
  public.model_engineering_specs, public.product_bom_versions, public.product_bom_components,
  public.manufacturing_routing_versions, public.manufacturing_routing_steps
from PUBLIC, anon, authenticated;

-- Helper function permissions only; this does not grant access to the underlying tables.
revoke all on function public.get_current_user_role() from public, anon;
grant execute on function public.get_current_user_role() to authenticated;
revoke all on function public.validate_serial_format(text) from public, anon;
grant execute on function public.validate_serial_format(text) to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.guard_warranty_snapshot_immutability() from public, anon, authenticated;
revoke all on function public.guard_sleepee_engineering_version_immutability() from public, anon, authenticated;
revoke all on function public.guard_sleepee_engineering_child_draft_only() from public, anon, authenticated;
revoke all on function public.reject_immutable_row_mutation() from public, anon, authenticated;
revoke all on function public.reject_serial_number_delete() from public, anon, authenticated;
revoke all on function public.guard_serial_identity_immutability() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. REQUIRED PRIVATE STORAGE BUCKET SHELLS
-- No storage.objects policies are created in this foundation migration.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('labels', 'labels', false),
  ('service', 'service', false),
  ('warranty', 'warranty', false);

commit;

-- END OF REVIEW DRAFT v1.6.
-- Includes service_case_id linkage for the customer-service-to-replacement workflow.
-- Must remain in docs/proposed-migrations until owner approval; do not run automatically.
-- Do not execute until the review report's blockers/decisions are acknowledged.
