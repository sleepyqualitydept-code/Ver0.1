-- ============================================================================
-- SLEEPEE AUTHORIZATION POLICIES — v1.6.0-rc.2
-- REVIEW ONLY. Keep under supabase/proposed-migrations; do not auto-execute.
-- Intended after 001 foundation + 002 runtime contracts, following owner approval.
-- Canonical role names only. No direct writes to warranty snapshots, serial history,
-- replacement workflow tables, audit logs, or print history. Printed status is never
-- writable via the browser; update_print_job_status_v1 controls non-success transitions.
-- This is a proposed least-privilege baseline; exercise with role-by-role tests before deploy.
-- ============================================================================
begin;

do $$
declare
  v_existing text;
begin
  select policyname into v_existing
  from pg_policies
  where policyname like 'sleepee_v16_%'
  limit 1;
  if v_existing is not null then
    raise exception 'SLEEPEE_AUTHZ_PREFLIGHT_FAILED: found existing policy %, review state before applying.', v_existing;
  end if;
end $$;

-- Do not grant app data access to anon. Authenticated rights are re-granted narrowly below.
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
from anon, authenticated;

-- Read grants are not sufficient alone: every public table is protected by RLS from 001.
grant select on public.profiles, public.user_roles to authenticated;
grant select on public.categories, public.brands, public.models, public.mattress_sizes, public.product_types to authenticated;
grant insert, update, delete on public.categories, public.brands, public.models, public.mattress_sizes, public.product_types to authenticated;
grant select, insert on public.customers to authenticated;
grant select, insert, update, delete on public.production_orders to authenticated;
grant select, insert on public.production_order_lines to authenticated;
grant select, insert on public.production_batches to authenticated;
grant select on public.serial_numbers, public.serial_history to authenticated;
grant select, insert, update, delete on public.label_templates to authenticated;
grant select, insert on public.print_jobs to authenticated;
grant select on public.print_history to authenticated;
grant select, insert, update, delete on public.warranty_policies to authenticated;
grant select on public.warranty_activations to authenticated;
grant select on public.service_cases, public.service_case_notes to authenticated;
grant select, insert on public.service_attachments to authenticated;
grant select on public.replacement_requests, public.replacement_history to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.model_engineering_specs to authenticated;
grant select, insert, update, delete on public.product_bom_versions, public.product_bom_components to authenticated;
grant select, insert, update, delete on public.manufacturing_routing_versions, public.manufacturing_routing_steps to authenticated;
grant select on public.vw_dashboard_kpis to authenticated;

-- Identity & role assignment: user sees own profile/role; only Administrator can inspect all.
create policy sleepee_v16_profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.get_current_user_role() = 'Administrator'
  or public.get_current_user_role() in ('Customer Service User','Warranty Manager')
);
create policy sleepee_v16_user_roles_select on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or public.get_current_user_role() = 'Administrator');
-- No direct insert/update/delete policies for profiles or user_roles. Auth profile trigger and admin RPC own writes.

-- Master data is shared across assigned roles; Administrator/Production Manager maintain it.
create policy sleepee_v16_categories_select on public.categories for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_categories_write on public.categories for all to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'))
with check (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_brands_select on public.brands for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_brands_write on public.brands for all to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'))
with check (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_models_select on public.models for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_models_write on public.models for all to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'))
with check (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_mattress_sizes_select on public.mattress_sizes for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_mattress_sizes_write on public.mattress_sizes for all to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'))
with check (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_product_types_select on public.product_types for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_product_types_write on public.product_types for all to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'))
with check (public.get_current_user_role() in ('Administrator','Production Manager'));

-- Customers: private record access is limited to roles that handle service/warranty.
create policy sleepee_v16_customers_select on public.customers for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager'));
create policy sleepee_v16_customers_insert on public.customers for insert to authenticated
with check (public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager'));

-- Production order and line reads support traceability. Mutation is Admin/Production Manager only.
create policy sleepee_v16_production_orders_select on public.production_orders for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_production_orders_insert on public.production_orders for insert to authenticated
with check (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_production_orders_update on public.production_orders for update to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'))
with check (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_production_orders_delete_orphan_draft on public.production_orders for delete to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager') and status='draft'
  and not exists (select 1 from public.production_order_lines l where l.production_order_id = production_orders.id));
create policy sleepee_v16_production_lines_select on public.production_order_lines for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_production_lines_insert on public.production_order_lines for insert to authenticated
with check (public.get_current_user_role() in ('Administrator','Production Manager')
  and exists (select 1 from public.production_orders po where po.id=production_order_id and po.status='draft'));

-- Batch maintenance is role-controlled; serial identities/status/history remain RPC-only.
create policy sleepee_v16_batches_select on public.production_batches for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_batches_insert on public.production_batches for insert to authenticated
with check (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator'));
create policy sleepee_v16_serial_numbers_select on public.serial_numbers for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_serial_history_select on public.serial_history for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
-- There are deliberately no browser INSERT/UPDATE/DELETE policies for serial_numbers or serial_history.

-- Label templates can be maintained by the print operator, production manager or Administrator.
create policy sleepee_v16_label_templates_select on public.label_templates for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_label_templates_write on public.label_templates for all to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Printing Operator'))
with check (public.get_current_user_role() in ('Administrator','Production Manager','Printing Operator'));

-- Print jobs can be created/read directly. Status mutation is granted only through the RPC.
create policy sleepee_v16_print_jobs_select on public.print_jobs for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_print_jobs_insert on public.print_jobs for insert to authenticated
with check (public.get_current_user_role() in ('Administrator','Production Manager','Printing Operator'));
create policy sleepee_v16_print_history_select on public.print_history for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Printing Operator','Read Only User'));
-- There are deliberately no browser UPDATE/DELETE policies for print_jobs and no INSERT policy for print_history.

-- Warranty policy is editable by Administrator/Warranty Manager. Activation rows are append-only.
create policy sleepee_v16_warranty_policies_select on public.warranty_policies for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'));
create policy sleepee_v16_warranty_policies_write on public.warranty_policies for all to authenticated
using (public.get_current_user_role() in ('Administrator','Warranty Manager'))
with check (public.get_current_user_role() in ('Administrator','Warranty Manager'));
create policy sleepee_v16_warranty_activations_select on public.warranty_activations for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager','Read Only User'));
-- There are deliberately no browser INSERT/UPDATE/DELETE policies for warranty_activations.

-- Customer service workflow writes are RPC-only except case-linked file upload metadata.
create policy sleepee_v16_service_cases_select on public.service_cases for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager'));
create policy sleepee_v16_service_notes_select on public.service_case_notes for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager'));
create policy sleepee_v16_service_attachments_select on public.service_attachments for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager'));
create policy sleepee_v16_service_attachments_insert on public.service_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager')
  and exists (select 1 from public.service_cases c where c.id=service_case_id)
);

-- Replacements and audit/history are server-owned; client writes are RPC-only.
create policy sleepee_v16_replacement_requests_select on public.replacement_requests for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User'));
create policy sleepee_v16_replacement_history_select on public.replacement_history for select to authenticated
using (public.get_current_user_role() in ('Administrator','Customer Service User'));
create policy sleepee_v16_audit_logs_select on public.audit_logs for select to authenticated
using (public.get_current_user_role() = 'Administrator');

-- Engineering data is readable by Admin/Production Manager; only Administrator authors versions.
create policy sleepee_v16_model_engineering_select on public.model_engineering_specs for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_model_engineering_write on public.model_engineering_specs for all to authenticated
using (public.get_current_user_role() = 'Administrator')
with check (public.get_current_user_role() = 'Administrator');
create policy sleepee_v16_bom_versions_select on public.product_bom_versions for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_bom_versions_write on public.product_bom_versions for all to authenticated
using (public.get_current_user_role() = 'Administrator')
with check (public.get_current_user_role() = 'Administrator');
create policy sleepee_v16_bom_components_select on public.product_bom_components for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_bom_components_write on public.product_bom_components for all to authenticated
using (public.get_current_user_role() = 'Administrator')
with check (public.get_current_user_role() = 'Administrator');
create policy sleepee_v16_routing_versions_select on public.manufacturing_routing_versions for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_routing_versions_write on public.manufacturing_routing_versions for all to authenticated
using (public.get_current_user_role() = 'Administrator')
with check (public.get_current_user_role() = 'Administrator');
create policy sleepee_v16_routing_steps_select on public.manufacturing_routing_steps for select to authenticated
using (public.get_current_user_role() in ('Administrator','Production Manager'));
create policy sleepee_v16_routing_steps_write on public.manufacturing_routing_steps for all to authenticated
using (public.get_current_user_role() = 'Administrator')
with check (public.get_current_user_role() = 'Administrator');

-- Private service bucket. Objects must be inside a real accessible service case folder.
create policy sleepee_v16_service_objects_select on storage.objects for select to authenticated
using (bucket_id='service'
  and public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager')
  and exists (select 1 from public.service_cases c where c.id::text = (storage.foldername(name))[1]));
create policy sleepee_v16_service_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='service'
  and public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager')
  and exists (select 1 from public.service_cases c where c.id::text = (storage.foldername(name))[1]));
create policy sleepee_v16_service_objects_delete on storage.objects for delete to authenticated
using (bucket_id='service'
  and public.get_current_user_role() in ('Administrator','Customer Service User','Warranty Manager')
  and exists (select 1 from public.service_cases c where c.id::text = (storage.foldername(name))[1]));
-- labels/warranty buckets stay private with no user-storage access policy until required workflows are approved.

commit;
-- END REVIEW ONLY. Add role-by-role RLS/storage tests and owner approval before deployment.
