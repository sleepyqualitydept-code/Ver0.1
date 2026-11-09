import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(e => {
  const rel = path.posix.join(dir, e.name);
  if (e.isDirectory()) return ['node_modules','.git','dist','archive'].includes(e.name) ? [] : walk(rel);
  return [rel];
});
const sourceFiles = walk('src').filter(p => /\.(ts|tsx|js|jsx)$/.test(p));
const migrationPaths = [
  'supabase/proposed-migrations/20261010_001_sleepee_foundation_schema_v1_6_REVIEW_ONLY.sql',
  'supabase/proposed-migrations/20261010_002_sleepee_runtime_contracts_v1_6_REVIEW_ONLY.sql',
  'supabase/proposed-migrations/20261010_003_sleepee_authorization_policies_v1_6_REVIEW_ONLY.sql'
];
const migrations = migrationPaths.map(read);
const allSource = sourceFiles.map(read).join('\n');
const runtime = migrations[1];
const foundation = migrations[0];
const authz = migrations[2];
const roles = ['Administrator','Production Manager','Production Operator','Printing Operator','Customer Service User','Warranty Manager','Read Only User'];
const perms = read('src/security/permissions.ts');
for (const role of roles) assert.ok(perms.includes(`'${role}'`), `Missing canonical role: ${role}`);
for (const obsolete of ['Warranty Officer','Customer Service Agent','Service Manager']) {
  assert.ok(!allSource.includes(obsolete), `Obsolete role alias remains in active application source: ${obsolete}`);
}
assert.ok(foundation.includes('create table public.models'), 'Canonical models entity missing');
assert.ok(!/create\s+table\s+(if\s+not\s+exists\s+)?public\.products\b/i.test(foundation), 'Duplicate products table must not be created');
for (const rpc of ['activate_warranty','record_warranty_event','generate_serials','create_service_case_v2','record_service_case_note','update_service_case_status_v2','create_replacement_request_for_case_v1','update_replacement_status_v2','approve_replacement_v2','admin_set_user_role','public_verify_warranty','global_search','get_dashboard_kpis','update_print_job_status_v1','replace_production_order_lines_v1','update_production_batch_status_v1']) {
  assert.ok(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${rpc}\\b`, 'i').test(runtime), `Missing runtime RPC: ${rpc}`);
}
for (const bad of [/\bdrop\s+(table|schema|function|policy)\b/i,/\btruncate\s+table\b/i]) {
  for (let i=0;i<migrations.length;i++) assert.ok(!bad.test(migrations[i]), `Destructive SQL pattern ${bad} in ${migrationPaths[i]}`);
}
assert.ok(!/\bdelete\s+from\b/i.test(migrations[0]), 'Foundation migration must not delete business rows');
assert.ok(!/\bdelete\s+from\b/i.test(migrations[2]), 'Authorization migration must not delete business rows');
assert.ok(/delete from public\.production_order_lines where production_order_id=p_order_id/i.test(runtime), 'Atomic order line replacement must be scoped to one explicitly requested draft order');
assert.ok(runtime.includes("if p_status not in ('processing','paused','failed','cancelled')"), 'Print success status must remain blocked');
assert.ok(authz.includes('sleepee_v16_warranty_activations_select'), 'Warranty read RLS policy missing');
assert.ok(!/create policy[^;]+on public\.warranty_activations[^;]+for\s+(insert|update|delete|all)/is.test(authz), 'Direct warranty mutation policy must not exist');
assert.ok(!/create policy[^;]+on public\.serial_numbers[^;]+for\s+(insert|update|delete|all)/is.test(authz), 'Direct serial mutation policy must not exist');
assert.ok(!/create policy[^;]+on public\.print_jobs[^;]+for\s+(update|delete|all)/is.test(authz), 'Direct print job update policy must not exist');
assert.ok(!/create policy[^;]+on public\.production_batches[^;]+for\s+update/is.test(authz), 'Direct production-batch update policy must not exist');
assert.ok(!/create policy[^;]+on public\.production_order_lines[^;]+for\s+(update|delete|all)/is.test(authz), 'Order-line edits must use an atomic RPC');
assert.ok(!/\.from\(['"]products['"]\)/.test(allSource), 'An API still directly queries products');
assert.ok(/rpc\(['"]update_print_job_status_v1['"]/.test(read('src/api/printJobsApi.ts')), 'Print job status API does not use the controlled RPC');
assert.ok(!/\.from\(['"]warranty_activations['"]\)\s*\.update|\.from\(['"]warranty_activations['"]\)\s*\.insert/.test(allSource), 'Client writes warranty activations directly');
assert.ok(/rpc\(['"]replace_production_order_lines_v1['"]/.test(read('src/api/productionOrdersApi.ts')), 'Order line replacement is not atomic');
assert.ok(/rpc\(['"]update_production_batch_status_v1['"]/.test(read('src/api/batchesApi.ts')), 'Batch status API does not use controlled RPC');
assert.ok(fs.existsSync(path.join(root,'docs/architecture/SLEEPEE_SYSTEM_CONTEXT.svg')), 'System SVG missing');
assert.ok(fs.existsSync(path.join(root,'docs/architecture/SLEEPEE_OPERATING_FLOW.svg')), 'Operating flow SVG missing');
assert.ok(fs.existsSync(path.join(root,'supabase/operations/BOOTSTRAP_FIRST_ADMIN_TEMPLATE.sql')), 'First-admin bootstrap template missing');

// Confirm that API table/view/RPC references have a matching proposed database contract.
const allMigrations = migrations.join('\n');
const createdTables = new Set([...allMigrations.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z_][\w]*)/gi)].map(m => m[1]));
const createdViews = new Set([...allMigrations.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.([a-zA-Z_][\w]*)/gi)].map(m => m[1]));
const referencedTables = new Set([...allSource.matchAll(/\.from\(\s*['\"]([a-zA-Z_][\w]*)['\"]\s*\)/g)].map(m => m[1]));
for (const table of referencedTables) {
  if (table === 'service') continue; // Supabase Storage bucket, not a PostgreSQL relation.
  assert.ok(createdTables.has(table) || createdViews.has(table), `API relation missing from proposed schema: ${table}`);
}
const calledRpcs = new Set([...allSource.matchAll(/\.rpc\(\s*['\"]([a-zA-Z_][\w]*)['\"]\s*/g)].map(m => m[1]));
const definedRpcs = new Set([...runtime.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-zA-Z_][\w]*)/gi)].map(m => m[1]));
for (const rpc of calledRpcs) assert.ok(definedRpcs.has(rpc), `API RPC has no proposed definition: ${rpc}`);

const lock = JSON.parse(read('package-lock.json'));
const pkg = JSON.parse(read('package.json'));
assert.equal(lock.name, pkg.name, 'Lockfile name differs from package.json');
assert.equal(lock.version, pkg.version, 'Lockfile version differs from package.json');
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root version differs from package.json');
for (const section of ['dependencies','devDependencies']) {
  assert.deepEqual(lock.packages[''][section] || {}, pkg[section] || {}, `Lockfile root ${section} differs from package.json`);
}
const packages = lock.packages;
const resolvePackage = (parent, dependency) => {
  let current = parent;
  for (;;) {
    const candidate = (current ? `${current}/` : '') + `node_modules/${dependency}`;
    if (packages[candidate]) return candidate;
    if (!current) return null;
    const marker = current.lastIndexOf('/node_modules/');
    current = marker >= 0 ? current.slice(0, marker) : '';
  }
};
const visited = new Set(['']);
const pending = [''];
while (pending.length) {
  const parent = pending.pop();
  const item = packages[parent] || {};
  const deps = {...(item.dependencies || {}), ...(item.optionalDependencies || {})};
  if (parent === '') Object.assign(deps, item.devDependencies || {});
  for (const [dependency, range] of Object.entries(deps)) {
    const target = resolvePackage(parent, dependency);
    if (!target) {
      if ((item.optionalDependencies || {})[dependency]) continue;
      assert.fail(`Lockfile dependency is missing: ${parent || '<root>'} -> ${dependency}@${range}`);
    }
    if (!visited.has(target)) { visited.add(target); pending.push(target); }
  }
}
assert.ok(!fs.existsSync(path.join(root,'.env.local')), 'Local environment secrets must not be packaged');
assert.ok(!fs.existsSync(path.join(root,'supabase/migrations')), 'Review-only SQL must not be moved into auto-deploy migrations');
const redundantRootReports = fs.readdirSync(root).filter(name => /^(?:APPLICATION_|DATABASE_|PHASE_|.*_AUDIT|.*_VERIFICATION|ROLE_PERMISSION_MATRIX|ROUTE_PERMISSION_MATRIX)/i.test(name));
assert.deepEqual(redundantRootReports, [], `Duplicate root reports remain: ${redundantRootReports.join(', ')}`);

console.log(JSON.stringify({status:'PASS', checks:[
  `canonical role names (${roles.length})`,
  `active source files inspected (${sourceFiles.length})`,
  `runtime RPC contracts (${definedRpcs.size})`,
  `API database contracts (${referencedTables.size} relations/buckets; ${calledRpcs.size} RPCs)`,
  'no destructive SQL in proposed migrations',
  'no direct warranty/serial/print-success writes',
  'controlled print-state RPC wired from API',
  `lockfile dependency closure (${visited.size} package paths)`,
  'no local environment secrets or duplicate root audit reports',
  'editable SVG diagrams and admin bootstrap instructions present'
]}, null, 2));
