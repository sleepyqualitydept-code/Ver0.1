-- READ ONLY verification for proposed authorization migration (run only after approval/deployment).
select
  (select count(*) from pg_policies where schemaname='public' and policyname like 'sleepee_v16_%') as sleepee_public_policy_count,
  (select count(*) from pg_policies where schemaname='storage' and policyname like 'sleepee_v16_%') as sleepee_storage_policy_count,
  (select count(*) from pg_policies where schemaname='public' and tablename='warranty_activations'
     and cmd in ('INSERT','UPDATE','DELETE','ALL') and policyname like 'sleepee_v16_%') as client_warranty_mutation_policy_count,
  (select count(*) from pg_policies where schemaname='public' and tablename='serial_numbers'
     and cmd in ('INSERT','UPDATE','DELETE','ALL') and policyname like 'sleepee_v16_%') as client_serial_mutation_policy_count,
  (select count(*) from pg_policies where schemaname='public' and tablename='print_jobs'
     and cmd in ('UPDATE','DELETE','ALL') and policyname like 'sleepee_v16_%') as direct_print_job_update_policy_count,
  (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
     and policyname like 'sleepee_v16_service_objects_%') as service_storage_policy_count;

-- Review policy expressions and security definer grants.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where policyname like 'sleepee_v16_%'
order by schemaname, tablename, policyname;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('activate_warranty','record_warranty_event','update_print_job_status_v1','admin_set_user_role')
order by p.proname;
