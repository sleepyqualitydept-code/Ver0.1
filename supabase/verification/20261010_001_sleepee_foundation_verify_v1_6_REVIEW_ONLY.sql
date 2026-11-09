-- SLEEPEE FOUNDATION v0.2 — POST-DEPLOYMENT VERIFICATION (READ ONLY)
-- Run ONLY after the reviewed migration is explicitly approved and deployed.
-- SELECT-only diagnostics; no schema/data changes.

WITH expected(table_name) AS (
  VALUES
    ('profiles'), ('user_roles'),
    ('categories'), ('brands'), ('models'), ('mattress_sizes'), ('product_types'),
    ('customers'),
    ('production_orders'), ('production_order_lines'), ('production_batches'),
    ('serial_numbers'), ('serial_history'),
    ('label_templates'), ('print_jobs'), ('print_history'),
    ('warranty_policies'), ('warranty_activations'),
    ('service_cases'), ('service_case_notes'), ('service_attachments'),
    ('replacement_requests'), ('replacement_history'), ('audit_logs'),
    ('model_engineering_specs'), ('product_bom_versions'), ('product_bom_components'),
    ('manufacturing_routing_versions'), ('manufacturing_routing_steps')
), relation_check AS (
  SELECT e.table_name,
         to_regclass(format('public.%I', e.table_name)) IS NOT NULL AS is_present,
         COALESCE(c.relrowsecurity, false) AS rls_enabled,
         c.relkind
  FROM expected e
  LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', e.table_name))
), bucket_check AS (
  SELECT b.id, b.public
  FROM storage.buckets b
  WHERE b.id IN ('labels','service','warranty')
)
SELECT 'TABLE' AS section, table_name AS object_name,
       jsonb_build_object('exists', is_present, 'rls_enabled', rls_enabled, 'relkind', relkind) AS details
FROM relation_check
UNION ALL
SELECT 'SUMMARY', 'expected_tables',
       jsonb_build_object('expected', count(*), 'present', count(*) FILTER (WHERE is_present),
                          'rls_enabled', count(*) FILTER (WHERE is_present AND rls_enabled))
FROM relation_check
UNION ALL
SELECT 'STORAGE_BUCKET', id, jsonb_build_object('public', public)
FROM bucket_check
UNION ALL
SELECT 'SUMMARY', 'private_expected_buckets',
       jsonb_build_object('expected', 3, 'present', count(*), 'private', count(*) FILTER (WHERE NOT public))
FROM bucket_check
UNION ALL
SELECT 'HELPER_FUNCTION', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       jsonb_build_object('security_definer', p.prosecdef, 'result', pg_get_function_result(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_updated_at','get_current_user_role','validate_serial_format',
    'guard_warranty_snapshot_immutability','guard_sleepee_engineering_version_immutability',
    'guard_sleepee_engineering_child_draft_only','reject_immutable_row_mutation',
    'reject_serial_number_delete','guard_serial_identity_immutability','handle_new_auth_user'
  )
UNION ALL
SELECT 'RLS_POLICY', schemaname || '.' || tablename || '.' || policyname,
       jsonb_build_object('command', cmd, 'roles', roles, 'using', qual, 'with_check', with_check)
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 'PROFILE_TRIGGER', t.tgname,
       jsonb_build_object('enabled', t.tgenabled, 'function', p.proname)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal
  AND t.tgname = 'trg_sleepee_profile_on_auth_user_created'
ORDER BY section, object_name;
