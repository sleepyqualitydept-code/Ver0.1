-- READ ONLY: check required runtime contract objects after an explicitly approved deployment.
select
  to_regclass('public.models') is not null as has_models,
  to_regclass('public.replacement_requests') is not null as has_replacement_requests,
  to_regclass('public.service_cases') is not null as has_service_cases,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='replacement_requests' and column_name='service_case_id') as has_replacement_service_case_link,
  to_regprocedure('public.generate_serials(uuid,integer)') is not null as has_generate_serials_rpc,
  to_regprocedure('public.global_search(text)') is not null as has_global_search_rpc,
  to_regprocedure('public.get_dashboard_kpis()') is not null as has_dashboard_kpi_rpc,
  to_regprocedure('public.create_replacement_request_for_case_v1(uuid,text)') is not null as has_case_linked_replacement_rpc,
  to_regprocedure('public.approve_replacement_v2(uuid,uuid)') is not null as has_replacement_approval_rpc,
  to_regprocedure('public.activate_warranty(uuid,uuid,jsonb,text,date)') is not null as has_phase09_warranty_rpc,
  to_regprocedure('public.record_warranty_event(uuid,text,text,jsonb)') is not null as has_phase09_warranty_event_rpc,
  to_regprocedure('public.update_print_job_status_v1(uuid,text,text)') is not null as has_secure_print_status_rpc,
  to_regprocedure('public.replace_production_order_lines_v1(uuid,jsonb)') is not null as has_atomic_order_line_replace_rpc,
  to_regprocedure('public.update_production_batch_status_v1(uuid,text)') is not null as has_controlled_batch_status_rpc;

-- Inspect replacement state constraints without changing them.
select c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public' and t.relname='replacement_requests' and c.contype='c'
order by c.conname;
