-- Sleepee Manufacturing Engineering — ADDITIVE CANDIDATE MIGRATION
-- Canonical reference: Sleepee_Single_Source_Of_Truth_v1.0
-- IMPORTANT: Review the live schema, take/export a backup, and obtain owner approval before execution.
-- This migration adds only new engineering tables; it does not alter/drop/reset existing Phase 01–09 objects.
-- The lifecycle for BOM/Routing approval is not finalized. The UI creates/edits drafts only.

begin;

do $$
begin
  if to_regclass('public.models') is null then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: required table public.models was not found. Do not run this migration on an unverified database.';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: required table public.profiles was not found. Confirm the live identity/profile schema first.';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_current_user_role'
  ) then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: public.get_current_user_role() was not found. Confirm the live role/RLS design first.';
  end if;
  if to_regclass('public.model_engineering_specs') is not null
     or to_regclass('public.product_bom_versions') is not null
     or to_regclass('public.product_bom_components') is not null
     or to_regclass('public.manufacturing_routing_versions') is not null
     or to_regclass('public.manufacturing_routing_steps') is not null then
    raise exception 'SLEEPEE_PREFLIGHT_FAILED: one or more target engineering tables already exist. Compare their schemas and prepare a reconciled migration; do not overlay blindly.';
  end if;
end $$;

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
  status text not null default 'draft',
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
  constraint product_bom_version_status_allowed check (status in ('draft','approved','retired')),
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
  updated_at timestamptz not null default now()
);

create index idx_product_bom_versions_model on public.product_bom_versions(model_id, created_at desc);
create index idx_product_bom_components_version_sequence on public.product_bom_components(bom_version_id, sequence_no);

create table public.manufacturing_routing_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete restrict,
  version_code text not null,
  status text not null default 'draft',
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
  constraint routing_version_status_allowed check (status in ('draft','approved','retired')),
  constraint routing_effective_dates_valid check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint routing_model_version_unique unique (model_id, version_code)
);

create table public.manufacturing_routing_steps (
  id uuid primary key default gen_random_uuid(),
  routing_version_id uuid not null references public.manufacturing_routing_versions(id) on delete restrict,
  step_sequence integer not null check (step_sequence > 0),
  department_code text not null check (department_code in ('wire_chassis','quilting_tailoring','upholstery_assembly','tape_edge','packaging')),
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
  constraint routing_step_sequence_unique unique (routing_version_id, step_sequence)
);

create index idx_routing_versions_model on public.manufacturing_routing_versions(model_id, created_at desc);
create index idx_routing_steps_version_sequence on public.manufacturing_routing_steps(routing_version_id, step_sequence);

-- Keep model/BOM/routing engineering data inside the existing Supabase project.
-- Product engineering master data is editable only by Administrator under the existing governance rule.
-- Operational roles can read records; the live role mapping must still be reconciled before release.
alter table public.model_engineering_specs enable row level security;
alter table public.product_bom_versions enable row level security;
alter table public.product_bom_components enable row level security;
alter table public.manufacturing_routing_versions enable row level security;
alter table public.manufacturing_routing_steps enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='model_engineering_specs' and policyname='engineering_specs_read_roles') then
    create policy engineering_specs_read_roles on public.model_engineering_specs for select to authenticated
      using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='model_engineering_specs' and policyname='engineering_specs_admin_insert') then
    create policy engineering_specs_admin_insert on public.model_engineering_specs for insert to authenticated
      with check (public.get_current_user_role() = 'Administrator' and created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='model_engineering_specs' and policyname='engineering_specs_admin_update') then
    create policy engineering_specs_admin_update on public.model_engineering_specs for update to authenticated
      using (public.get_current_user_role() = 'Administrator') with check (public.get_current_user_role() = 'Administrator');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_versions' and policyname='bom_versions_read_roles') then
    create policy bom_versions_read_roles on public.product_bom_versions for select to authenticated
      using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_versions' and policyname='bom_versions_admin_insert') then
    create policy bom_versions_admin_insert on public.product_bom_versions for insert to authenticated
      with check (public.get_current_user_role() = 'Administrator' and status = 'draft' and created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_versions' and policyname='bom_versions_admin_update_draft') then
    create policy bom_versions_admin_update_draft on public.product_bom_versions for update to authenticated
      using (public.get_current_user_role() = 'Administrator' and status = 'draft')
      with check (public.get_current_user_role() = 'Administrator');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_components' and policyname='bom_components_read_roles') then
    create policy bom_components_read_roles on public.product_bom_components for select to authenticated
      using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_components' and policyname='bom_components_admin_insert_draft') then
    create policy bom_components_admin_insert_draft on public.product_bom_components for insert to authenticated
      with check (public.get_current_user_role() = 'Administrator' and created_by = auth.uid() and exists (select 1 from public.product_bom_versions v where v.id=bom_version_id and v.status='draft'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_components' and policyname='bom_components_admin_update_draft') then
    create policy bom_components_admin_update_draft on public.product_bom_components for update to authenticated
      using (public.get_current_user_role() = 'Administrator' and exists (select 1 from public.product_bom_versions v where v.id=bom_version_id and v.status='draft'))
      with check (public.get_current_user_role() = 'Administrator' and exists (select 1 from public.product_bom_versions v where v.id=bom_version_id and v.status='draft'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_bom_components' and policyname='bom_components_admin_delete_draft') then
    create policy bom_components_admin_delete_draft on public.product_bom_components for delete to authenticated
      using (public.get_current_user_role() = 'Administrator' and exists (select 1 from public.product_bom_versions v where v.id=bom_version_id and v.status='draft'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_versions' and policyname='routing_versions_read_roles') then
    create policy routing_versions_read_roles on public.manufacturing_routing_versions for select to authenticated
      using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_versions' and policyname='routing_versions_admin_insert') then
    create policy routing_versions_admin_insert on public.manufacturing_routing_versions for insert to authenticated
      with check (public.get_current_user_role() = 'Administrator' and status='draft' and created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_versions' and policyname='routing_versions_admin_update_draft') then
    create policy routing_versions_admin_update_draft on public.manufacturing_routing_versions for update to authenticated
      using (public.get_current_user_role() = 'Administrator' and status='draft') with check (public.get_current_user_role() = 'Administrator');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_steps' and policyname='routing_steps_read_roles') then
    create policy routing_steps_read_roles on public.manufacturing_routing_steps for select to authenticated
      using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Warranty Officer','Customer Service Agent','Service Manager'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_steps' and policyname='routing_steps_admin_insert_draft') then
    create policy routing_steps_admin_insert_draft on public.manufacturing_routing_steps for insert to authenticated
      with check (public.get_current_user_role() = 'Administrator' and created_by = auth.uid() and exists (select 1 from public.manufacturing_routing_versions v where v.id=routing_version_id and v.status='draft'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_steps' and policyname='routing_steps_admin_update_draft') then
    create policy routing_steps_admin_update_draft on public.manufacturing_routing_steps for update to authenticated
      using (public.get_current_user_role() = 'Administrator' and exists (select 1 from public.manufacturing_routing_versions v where v.id=routing_version_id and v.status='draft'))
      with check (public.get_current_user_role() = 'Administrator' and exists (select 1 from public.manufacturing_routing_versions v where v.id=routing_version_id and v.status='draft'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='manufacturing_routing_steps' and policyname='routing_steps_admin_delete_draft') then
    create policy routing_steps_admin_delete_draft on public.manufacturing_routing_steps for delete to authenticated
      using (public.get_current_user_role() = 'Administrator' and exists (select 1 from public.manufacturing_routing_versions v where v.id=routing_version_id and v.status='draft'));
  end if;
end $$;

-- Published engineering versions are immutable. Editing means creating a new draft version.
create or replace function public.guard_sleepee_engineering_version_immutability()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'ENGINEERING_VERSION_IMMUTABLE: create a new version instead of deleting a non-draft version.'; end if;
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
  if new.status = 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
    if new.effective_from is null then new.effective_from := current_date; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger guard_product_bom_version_immutability
before update or delete on public.product_bom_versions
for each row execute function public.guard_sleepee_engineering_version_immutability();
create trigger guard_routing_version_immutability
before update or delete on public.manufacturing_routing_versions
for each row execute function public.guard_sleepee_engineering_version_immutability();

create or replace function public.guard_sleepee_engineering_child_draft_only()
returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  if tg_table_name='product_bom_components' then
    if tg_op='DELETE' then select status into v_status from public.product_bom_versions where id=old.bom_version_id;
    else select status into v_status from public.product_bom_versions where id=new.bom_version_id; end if;
  else
    if tg_op='DELETE' then select status into v_status from public.manufacturing_routing_versions where id=old.routing_version_id;
    else select status into v_status from public.manufacturing_routing_versions where id=new.routing_version_id; end if;
  end if;
  if v_status is distinct from 'draft' then raise exception 'ENGINEERING_PARENT_NOT_DRAFT: child rows may only be changed while the parent version is draft.'; end if;
  if tg_op='DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger guard_product_bom_component_draft_only
before insert or update or delete on public.product_bom_components
for each row execute function public.guard_sleepee_engineering_child_draft_only();
create trigger guard_manufacturing_routing_step_draft_only
before insert or update or delete on public.manufacturing_routing_steps
for each row execute function public.guard_sleepee_engineering_child_draft_only();

commit;

-- No source workbook rows are imported by this migration. Import mapping and disputed dimensions must be reviewed and approved separately.
