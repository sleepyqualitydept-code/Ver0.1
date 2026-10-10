# Sleepee — Technical Audit & Development Handoff

**Review date:** 2026-10-10  
**Project:** Sleepee Manufacturing, Warranty & Customer Service Platform  
**Canonical authority:** `Sleepee_Single_Source_Of_Truth_v1.0`  
**Status:** **BLOCKED FOR IMPLEMENTATION / PARTIALLY COMPLIANT / NOT CERTIFIED**  
**Purpose:** Establish the actual state supported by the uploaded packages, record code-level findings, identify decisions and tests required before implementation resumes.

## 1. Authority and safety boundaries

The portable reference is the business source of truth. The v1.2 review addendum is a separate review record; neither uploaded ZIP overrides the canonical reference. This audit did not edit the reference, either ZIP, GitHub, or Supabase. No SQL was run and no live Supabase data was queried.

Evidence classes used here:

- **FILE-VERIFIED:** directly confirmed from files in the uploaded archives.
- **CODE-VERIFIED:** confirmed by static inspection of source code; not proof of production behavior.
- **COMMAND-VERIFIED:** command was run in the supplied package and its actual output is recorded.
- **NOT VERIFIED:** requires installed dependencies, a live target environment, physical equipment, or owner approval.

## 2. Artifacts inspected

| Artifact | Observed contents | Audit conclusion |
|---|---|---|
| `Sleepee_Single_Source_Of_Truth_v1.0_Portable_Reference(2).md` | Complete portable reference; 1,206 lines | Canonical business/technology authority; preserve unchanged. |
| `Sleepee_Consolidated_Requirements_Review_v1.2(2).md` | v1.2 review addendum and execution gates | Supporting addendum, not a replacement for the canonical reference. |
| `Sleepee_Consolidated_Requirements_Review_v1.2(2).docx` | Formatted version of the review addendum | Supporting document; content generally follows the Markdown addendum. |
| `Sleepee_Review_Register_v1.2(2).xlsx` | 6 sheets: summary, decisions, operating time, data sources, ZIP audit, implementation gaps | Decision register has useful open items, but issue IDs do not align cleanly with the Markdown addendum: the live-Supabase inventory is O-17 in Markdown vs O-18 in the register; the unnamed operating-time row is O-18 in Markdown vs O-19 in the register; Markdown O-19 is the legal company-name spelling issue, while register O-20 is SH/legal-policy wording and the spelling issue is not represented consistently. Reconcile identifiers before marking any decision closed. |
| `SLEEPEE_PLATFORM_PHASE_10_18_UNIFIED_v1.0(2).zip` | 108 files; app source, unified Phase 10–18 migration, Phase 18 SQL validation, archived legacy SQL | Candidate implementation for review only; not a certified deployable baseline. |
| `sleepee-PHASE09_FIXED-v3(2).zip` | 98 files; app source, two root schema scripts, Phase 09 migration materials and lockfiles | Distinct older package; not interchangeable with or a safe overlay for Phase 10–18. |

The raw engineering/reference workbooks listed in the v1.2 review were not part of the current-message attachments, but were subsequently found in the Library and materialized for targeted inspection: `Models BOM.xlsx` (50 sheets), `وقت التشغيل.xlsx` (`A1:N45`), `توضيح الطبقات والحشو الداخلي.xlsx` (`A1:L1075`), `كل المواد الخام مصنع السست.xlsx` (`A1:P252`), and `EGYP RM FOR EDRAKY 23 MARCH 2025.xlsx` (three SAP mapping sheets). The Rrstcalm patch discrepancy and both unnamed 150-minute rows were confirmed against the source workbooks. This is targeted verification only, not a complete cell-by-cell reconciliation of every BOM, material identifier, quantity, formula, or SAP mapping. No source workbook was modified.

## 3. Package and source inspection results

| Check | Phase 09 ZIP | Phase 10–18 ZIP |
|---|---:|---:|
| Total extracted files | 98 | 108 |
| `.ts/.tsx/.js/.jsx` files, including archived code | 50 | 55 |
| Relative imports scanned | 113 | 121 |
| Missing relative import targets | 0 | 0 |
| Root `schema.sql` | Present | Absent |
| Root `supabase-schema.sql` | Present | Absent |
| `package-lock.json` | Present | Absent |
| `bun.lock` | Present | Absent |
| Phase 10–18 unified migration | Absent | Present |
| Phase 18 validation SQL | Absent | Present |

The Phase 10–18 source count includes two archived source files; the current app source is 53 TS/TSX/JS files. The static import check passed, but import resolution alone does not establish a successful TypeScript build or correct runtime behavior.

### Build and lint commands actually run

In both extracted packages:

- `npm run build` **FAILED**: `sh: 1: vite: not found`.
- `npm run lint` **FAILED**: TypeScript reported `TS2688: Cannot find type definition file for 'vite/client'`.

These failures establish that the uploaded packages are not build-verified in this audit environment. They do not establish that source code would still fail after a clean, reproducible dependency install. Phase 10–18 lacks its own lockfile, so the dependency set is not frozen by that ZIP.

### Static technology scan

No Firebase/Firestore, `localStorage`, `sessionStorage`, or `indexedDB` references were found in the active Phase 10–18 `src` scan. This is a limited static scan, not a live/runtime certification. Residual `@google/genai`, Express-related dependencies, and `GEMINI_API_KEY` remain in package/configuration files although no source imports for those dependencies were found in the scan; do not remove them except through a reviewed cleanup.

## 4. Critical findings — resolve before any deployment or production use

### C-01 — GitHub baseline identity is unresolved

The only repository visible through the current GitHub connection is the public repository `highsleep/Codex`. Its root/package files identify a `react-example` application and contain Firebase/Firestore configuration; code search did not find Sleepee or Supabase matches. Its identity as the Sleepee project repository is therefore **not established** and its contents conflict with the approved Supabase-only technology freeze. A root `.env` is also present in that public repository; its contents were not inspected or disclosed. Verify whether it contains any live secret and rotate exposed secrets if necessary.

**Required:** Identify the exact authoritative Sleepee repository, branch, and commit SHA before comparing or synchronizing project code. Do not copy this repository's files or environment configuration into the Sleepee baseline.

### C-02 — Phase 09 root schemas are destructive to an existing database

Both `phase09/schema.sql` and `phase09/supabase-schema.sql` contain `DROP TABLE IF EXISTS ... CASCADE` statements for the application's tables (lines 28–53). Those scripts are suitable only for a deliberately disposable/fresh schema scenario, not for an existing Supabase project containing production data. This conflicts with the project's no-reset/no-recreate rule.

**Required:** Do not execute either root schema file against the existing Supabase database. Keep them as historical source evidence only. Any database change must begin with a read-only live schema inventory, a verified backup/export, reviewed preconditions, and explicit owner approval.

### C-03 — In-app role switcher lets the browser impersonate another UI role

`phase10_18/src/App.tsx` renders a “Role Perspective Switcher” for any signed-in user and offers `Administrator` among the options (around lines 536–560). `src/context/AuthContext.tsx` implements `switchRoleDebug()` by changing `user.role` in client memory only (around lines 224–226), while `ProtectedRoute` authorizes screens using that client-side role. This is a **client-side access-control bypass for UI navigation**; it is not proof that the database can be modified as Administrator because RPC/RLS checks may still reject privileged operations. It can nevertheless expose admin screens and must not ship as a normal production control.

**Required:** Remove the role switcher from production builds or gate it behind a development-only build setting; then test permissions using independently authenticated accounts and server-enforced RLS/RPC rules.

### C-04 — Printer success path is not connected to real printer execution

`src/api/printJobsApi.ts` sets `isHardwareConnected` to `!!options?.isDemoMode` (around line 474). Both normal print-button paths in `src/components/PrintView.tsx` call `handleStartPrint(job.id, false)`, so the current UI path always takes the offline/pending branch. No Browser Print integration/dispatch implementation was found in the source scan. More seriously, if `isDemoMode` is set to `true`, the code proceeds as though hardware were connected and writes print-history rows and `printed` statuses without a physical printer dispatch.

**Required:** Implement and test the approved Zebra ZD220 + Browser Print physical dispatch boundary. A job, batch, serial, or print-history entry must not be marked printed until the real printer/Browser Print execution returns confirmed success. Test offline, simulated mode, successful physical printing, and failure-after-processing behavior.

### C-05 — Current production-order state model omits `Partially Completed`

The canonical production workflow includes `Partially Completed`. However, the Phase 09 schema's `production_orders.status` constraint (`schema.sql` around line 195) allows only `draft`, `planned`, `approved`, `in_production`, `completed`, and `cancelled`; the TypeScript `ProductionOrder.status` union in `phase10_18/src/utils/store.ts` around line 92 omits `partially_completed` too. A translation string exists, but the type/database contract does not support the state.

**Required:** Treat this as a schema and application contract gap. Approve a minimal additive migration and update API/types/UI/tests together; do not alter a live constraint until the live schema has been inspected and the migration approved.

### C-06 — Master-data seed does not match the canonical catalog

`phase09/MASTER_DATA_SEED_FINAL.sql`:

- Seeds six categories, which matches the canonical category list.
- Omits the canonical `Rebound Memory` brand.
- Seeds `متخصص` as a conventional brand (`Specialist`), while the canonical reference says it is not a traditional brand and is used for project/contract manufacturing.
- Seeds only 8 mattress-size pairs, whereas the canonical reference defines 12 width groups from 90 to 200 cm × 3 lengths (190, 195, 200), or 36 standard pairs.
- Explicitly seeds **no models** (`NO MODELS SEEDED. CATALOG PENDING.`), although the canonical reference contains model lists.

**Required:** Do not run the seed blindly on the live project. Reconcile the brand/entity model and build a reviewed master-data loading plan that preserves official names, the complete standard size list, model-to-brand ownership, and the source BOM/material codes.

### C-07 — Role schema supports only one role per employee and uses conflicting role names

The Phase 09 `user_roles` table defines `user_id ... UNIQUE` and its role check uses `Warranty Officer`, `Customer Service Agent`, and `Service Manager`. The Phase 10–18 `admin_set_user_role()` RPC upserts on conflict `(user_id)` and replaces the previous role. This does not support the owner's recorded preference that one employee may hold multiple roles. The implementation names also conflict with the canonical roles `Customer Service User`, `Warranty Manager`, and `Read Only User`; `Read Only User` is not in the database role allowlist, and the client permission map does not define it.

**Required:** Block Auth/RLS changes until a versioned role mapping is approved. Then decide the data model and test the effective permissions for users with one role and multiple roles, without silently renaming canonical roles.

## 5. High-priority code and contract gaps

| ID | Finding and evidence | Required action |
|---|---|---|
| H-01 | `src/components/PublicPortalView.tsx` displays `searchedSerial.warranty_start` while using the `invoice_no` label (around lines 139–140). The RPC's `warranty_start` value comes from `wa.invoice_date` in the unified migration. | Correct the field/label pairing in a reviewed source fix; test Arabic and English rendering. |
| H-02 | The current app exposes distinct routes/screens for `/master-data`, `/production`, `/serialization`, `/printing`, `/label-designer`, `/warranty`, `/customer-service`, `/replacement`, `/reports`, and `/admin` in `src/App.tsx` around lines 595–685. The v1.2 desired structure groups functions into a small number of workspaces. | Prepare a route/navigation compliance matrix against the approved workspace design. Keep internal component modularity; do not merge or rename screens arbitrarily. |
| H-03 | `src/components/ProductionView.tsx` around lines 183–194 selects the first model for a brand when no model matches the selected category. This can silently leave the planning row with a model/category mismatch. | Clear the model selection and require an explicit valid choice when no exact brand/category match exists; test before implementation. |
| H-04 | The unified migration uses new identifier/status conventions including `CS-YYYY-XXXXXX`, `RPL-YYYY-XXXXXX`, and replacement status `denied`, which are not specified in the canonical Section A workflow/number-format list. | Confirm whether these implementation-added conventions are approved; do not treat them as canonical without an amendment. |
| H-05 | `SLEEPEE_PHASE_10_18_UNIFIED_MIGRATION.sql` contains a stale comment saying `record_application_event_v2` is defined in `PHASE_10_18_UNIFIED_AUDIT_RPC.sql` and must be applied later, while that file is absent from the ZIP and the function is at the start of the same migration. | Reconcile the comment and deployment documents before release. |
| H-06 | `DEPLOYMENT_CHECKLIST.md` tells the operator to execute `schema.sql` and labels multiple deployment checks `READY`, but the Phase 10–18 ZIP has no root `schema.sql`. The separate deployment document says not to run archived/legacy schema and calls for the unified migration instead. | Publish one internally consistent deployment sequence after comparison with the actual live schema. Do not follow the stale checklist. |
| H-07 | Phase 10–18 includes no lockfile, whereas Phase 09 has npm and Bun lockfiles; the `package.json` versions/names differ. | Choose one approved source baseline and generate/commit one reproducible lockfile only after repository identity and dependencies are resolved. Do not copy lockfiles across package variants blindly. |
| H-08 | `PHASE_09_FINAL_ATOMIC_CUSTOMER_MIGRATION.sql` does not show an explicit top-level `BEGIN`/`COMMIT` wrapper, despite the “atomic” filename, and it alters/backfills snapshot columns before later operations. | Review execution/rollback behavior and preconditions before reuse; do not infer whole-file atomicity from its name. Validate existing activation rows and snapshot completeness first. |
| H-09 | `src/App.tsx` authorizes `/master-data/*` for both `Administrator` and `Production Manager`; `src/security/permissions.ts` also grants `/master-data` to `Production Manager`. The v1.2 owner clarification says master-data administration remains with `Administrator`. | Reconcile route/UI and database/RPC permissions with an approved permission matrix. Do not rely on client-side route protection alone. Test direct route, direct RPC, and RLS permissions per role. |

## 6. Additional specification and source-data gates retained from v1.2

These items remain **BLOCKED / owner or source-data decision required**; this audit does not guess resolutions:

1. **Roles and “Sales permissions”:** decide formal role mapping and whether “Sales” is a permission domain or role before Auth/RLS changes.
2. **Rrstcalm width patch:** code interpretation implies 78 cm; sheet description and quantity suggest 80 cm. Preserve original code/description/quantity pending confirmation.
3. **SH care wording:** mattress rotation says three months in one place and monthly in another. Approve one wording before publication; do not generalize SH terms to other brands.
4. **Factory routing/time:** current runtime minutes are model-level estimates, not measured values per each of five physical departments or per machine. Do not derive splits or throughput by guesswork; validate with factory measurements.
5. **Material code dictionary:** the leading-digit interpretation is tentative; keep current identifiers until a formal mapping is confirmed.
6. **Serial lifecycle additions:** decide which of Lost, Destroyed, Cancelled, Returned and Transferred are states versus immutable events and approve transition/audit effects.
7. **Replacement/compensation policy:** obtain an approved company policy and legal review; do not invent statutory periods or eligibility rules.
8. **Notifications:** WhatsApp/email vendor and configuration are undefined. Do not add a provider or commit secrets by assumption.
9. **Labels and physical printing:** no physical label design has been approved; agree on wording and layout, then test the actual Zebra ZD220, barcode, QR and required sizes (100×100, 100×80, 100×50 mm, plus configurable sizes).
10. **Operating-time source anomaly:** targeted inspection of the Library copy of `وقت التشغيل.xlsx` confirmed row 45 has `150` under February and no item name. The embedded `وقت التشغيل` sheet in `Models BOM.xlsx` also contains an unnamed `150` row (row 49). Neither value is to be assigned to a model automatically.
11. **Raw engineering source files:** the BOM, operating-time, layer-construction, material-master and SAP-mapping workbooks were found in the Library and materialized for targeted checks. Their sheet/range inventories and the specific Rrstcalm/operating-time anomalies were checked; a full cell-by-cell BOM, material-code, formula, or SAP mapping reconciliation has not been completed. Keep all source codes/descriptions/quantities unchanged until conflicts are resolved.
12. **Phase 19:** the uploaded unified package covers Phase 10–18 only; no Phase 19 implementation artifact is present.

## 7. Compliance matrix

| Area | Status | Evidence / limitation |
|---|---|---|
| Canonical reference availability | PASS | Full portable reference uploaded. Must remain unchanged. |
| Technology scan of Phase 10–18 `src` | PARTIAL PASS | No prohibited browser storage/Firebase strings found in this scan; not runtime proof. |
| Relative imports | PASS (static only) | 121 checked, no missing relative targets in Phase 10–18; 113 checked for Phase 09. |
| Clean build / typecheck | NOT VERIFIED | Actual `npm run build` and `npm run lint` fail because dependencies/types are unavailable in the extracted environment. |
| Database baseline / migration preconditions | NOT VERIFIED | Phase 10–18 ZIP has no root schema; no live schema queried. |
| Live Supabase tables/Auth/RLS/RPC/Storage/Realtime | NOT VERIFIED | No live inspection or SQL execution in this audit. |
| Phase 09 warranty snapshot immutability / duplicate guards | CODE EVIDENCE ONLY | Source and migration artifacts exist; historical certification report is not a fresh live test. |
| Public portal privacy | PARTIAL PASS | Static RPC output omits customer PII fields; UI invoice-date label mismatch remains. Live RLS and RPC not tested. |
| Role security | FAIL / BLOCKED | Client-side role switcher; role names and multi-role model unresolved. Server controls still require live verification. |
| Production workflow | FAIL / GAP | `partially_completed` missing in DB check and TS type. |
| Printing | FAIL / NOT INTEGRATED | Normal UI path forces offline result; no Browser Print dispatch found. |
| Master data completeness | FAIL / GAP | Missing Rebound Memory, 28 of 36 standard size pairs, and all model seed rows; Specialist modeled as a brand. |
| GitHub baseline correspondence | BLOCKED | Only connected repository visible is not established as the Sleepee source of truth and contains Firebase/Firestore artifacts. |
| Physical Zebra test | NOT VERIFIED | No successful real printer evidence or Browser Print dispatch. |
| Overall | **PARTIALLY COMPLIANT / NOT CERTIFIED** | Do not release, deploy, or label phases certified on this evidence. |

## 8. Required test plan before reopening implementation

| Test ID | Priority | Test | Acceptance evidence |
|---|---|---|---|
| T-00 | Critical | Identify exact authoritative GitHub repo/branch/commit; compare it with both ZIPs and the canonical reference. | Repository identity recorded; approved baseline chosen; no Firebase/Firestore in the selected implementation. |
| T-01 | Critical | Read-only live Supabase inventory: tables/columns/constraints/indexes, functions/RPC signatures, views, triggers, RLS policies, storage buckets/policies, Realtime publication, roles, schema versions. | Exported inventory with timestamps and a backup/export confirmed before changes. |
| T-02 | Critical | Build reproducibility: install from the approved lockfile, run lint/typecheck/build and available tests. | Commands, tool versions, pass/fail output, and commit SHA recorded. |
| T-03 | Critical | Security regression: authenticated accounts for every approved role; try direct URL/UI manipulation including role-switch tampering; verify RPC, table RLS and storage policy enforcement. | Unauthorized operations fail at the database/RPC layer; no privileged UI switch is shipped. |
| T-04 | Critical | Phase 09 warranty regression: valid activation, duplicate activation rejection, invalid/missing/future invoice checks, category→brand→model policy resolution, stored duration/end-date snapshot preserved after policy changes, and history linkage. | Read/write/RPC results plus verification that old snapshots are unchanged. |
| T-05 | Critical | Database migration rehearsal and rollback plan against an approved compatible test target or controlled migration process; explicitly confirm no reset/drop/recreate behavior. | Reviewed migration diff, backup restore evidence/rollback plan, owner approval before live execution. |
| T-06 | High | Public `/verify`: serial/QR/barcode search, active/expired/not-activated display, correct invoice/date labels, Arabic/English, and privacy probing. | Correct field labels and no customer name, phone, national ID, invoice number, or attachments leaked publicly. |
| T-07 | Critical | Physical Zebra workflow: printer disconnected; Browser Print available; successful physical print; failure after processing; retry/reprint; history retention. | Offline leaves job pending and does not mutate serial/batch history; printed status/history only after confirmed physical execution. |
| T-08 | High | Production order state machine including `Partially Completed`, allowed transitions, quantity accounting, cancellation, and role-specific actions. | UI, TypeScript, RPC/database constraints and tests agree with canonical workflow. |
| T-09 | High | Master data: all canonical brands/categories/models and 36 standard mattress sizes; enforce one-brand-per-model; keep `متخصص` as the approved project entity rather than automatically treating it as a normal brand. | Source-to-database reconciliation report, counts, duplicate/conflict review, no blind upsert changes. |
| T-10 | High | Route/workspace matrix and all seven approved role outcomes (after role mapping amendment); customer-service/replacement workflows. | Owner-approved route matrix; tests for read/write/approval/closure privileges. |
| T-11 | High | Required storage bucket checks and tests for `labels`, `service`, and `warranty`; verify upload/download scope and file privacy. | Live bucket/policy inventory and permission test evidence. |
| T-12 | High | Complete source reconciliation using the now-available Library copies of `Models BOM.xlsx`, `وقت التشغيل.xlsx`, layer construction, raw material master, and SAP mappings. Start with Rrstcalm and the unnamed operating-time rows. | Versioned reconciliation log; preserve the code `228KN17X78X10`, description 80 cm, quantity `0.0272 m³`, and the unnamed 150-minute/monthly value(s) until the owner confirms the source truth. Keep internal HR/Memory Foam layers separate from patches. |
| T-13 | High | Review public GitHub `.env` exposure without copying values; establish whether any valid secret is present. | Exposure decision recorded; confirmed secrets rotated and removed from public history if applicable. |

## 9. Safe sequence to resume work

1. Confirm the correct Sleepee GitHub repository and baseline commit; the currently connected repository is not verified as the project repository.
2. Approve the current review addendum and resolve critical role/repository decisions.
3. Inspect and export the live Supabase schema/security configuration and confirm an adequate backup before any migration.
4. Select one package baseline. Do not overlay Phase 09 onto Phase 10–18. Do not run Phase 09 root schema scripts against the existing database.
5. Resolve the code-level release blockers: production role switcher, real printer integration, production status contract, master-data seed gaps, public verification mapping, migration/deployment docs.
6. Close owner/source-data decisions only with evidence; maintain a change log/amendment rather than modifying the canonical v1.0 reference.
7. Run the full test plan, publish an evidence-backed compliance matrix, and only then decide certification/release status.

**Audit result:** No uploaded project source or database was modified; no SQL was executed. The next safe activity is baseline identification and read-only live-environment inspection, not implementation or migration execution.
