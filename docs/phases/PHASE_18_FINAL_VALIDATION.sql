-- Read-only final validation. Safe for the live database.
select 'phase18_objects' as check_name,
       exists(select 1 from pg_proc where proname='get_phase18_integrity_snapshot') as function_exists,
       exists(select 1 from pg_proc where proname='public_verify_warranty') as public_verify_exists,
       exists(select 1 from pg_proc where proname='create_service_case_v2') as service_case_rpc_exists,
       exists(select 1 from pg_proc where proname='approve_replacement_v2') as replacement_rpc_exists,
       exists(select 1 from pg_proc where proname='admin_set_user_role') as admin_role_rpc_exists,
       exists(select 1 from pg_views where schemaname='public' and viewname='vw_phase16_route_permissions') as phase16_view_exists,
       exists(select 1 from pg_views where schemaname='public' and viewname='vw_phase17_rpc_contracts') as phase17_view_exists;

select public.get_phase18_integrity_snapshot() as integrity_snapshot;
