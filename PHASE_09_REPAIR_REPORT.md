# PHASE 09 — FINAL REPAIR REPORT

## Scope
Final source cleanup for Warranty Audit and immutable Warranty Activation snapshots.

## Repairs Applied

1. **Removed the Warranty Activation generic audit path**
   - `WarrantyView.tsx` no longer calls `onLogAudit('WARRANTY_ACTIVATED', ...)` after a successful atomic activation.
   - Official activation persistence remains PostgreSQL `activate_warranty()` + `serial_history`.

2. **Removed fake/local audit fallback**
   - `App.tsx` no longer creates synthetic `aud-${Date.now()}` audit records in React state when PostgreSQL audit persistence fails.
   - Failures are reported to the console only; no fabricated audit record is presented as authoritative.

3. **Removed cross-serial Warranty History guessing**
   - Warranty history uses a real activation/serial relationship only.
   - No `activations[0]` fallback remains.

4. **Made Warranty Verification / Update audit events readable**
   - `auditLogsApi.getAll()` now maps real `warranty_activations` audit rows written by `record_warranty_event()` into `WARRANTY_VERIFIED` / `WARRANTY_UPDATED` events using the real `record_id` and stored notes.
   - This preserves the real database linkage required by Warranty History.

5. **Made Warranty duration/end-date immutable snapshots**
   - `warranty_activations` now contains:
     - `duration_years` (1–15)
     - `warranty_end_date`
   - `activate_warranty()` resolves the policy server-side and stores both values during the same transaction.
   - Existing activation rows are backfilled from their authoritative activation history notes when possible.
   - The migration aborts instead of silently inventing a snapshot when an existing activation cannot be safely reconstructed.
   - Client-side reads now use the stored activation snapshot and never recalculate an existing warranty duration from the current policy.

6. **Schema parity**
   - `schema.sql` and the Phase 09 final migration contain the immutable snapshot fields.
   - The atomic RPC writes the snapshot fields directly.

## Validation Performed

Static source validation:
- Warranty generic activation audit call removed — PASS
- Local synthetic audit fallback removed — PASS
- `activations[0]` history fallback removed — PASS
- Immutable warranty snapshot fields present in schema — PASS
- Atomic RPC writes `duration_years` and `warranty_end_date` — PASS
- Warranty audit event mapping present — PASS

## Build/Test Environment Note

The ZIP does not contain installed `node_modules`. `npm ci --no-audit --no-fund` could not complete within the available execution window, so a full TypeScript/Vite build was not independently certified here. The globally available TypeScript compiler also stopped immediately because `vite/client` dependencies were not installed.

## Live Database Action Required

Apply only:

`PHASE_09_FINAL_ATOMIC_CUSTOMER_MIGRATION.sql`

Do not run the obsolete Phase 09 migration files from earlier iterations.
