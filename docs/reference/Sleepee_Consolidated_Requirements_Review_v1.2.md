# Sleepee — Consolidated Requirements Review v1.2

**Canonical Reference:** `Sleepee_Single_Source_Of_Truth_v1.0`  
**Project:** Sleepee Manufacturing, Warranty & Customer Service Platform  
**Review date:** 2026-10-10  
**Status:** Consolidated review after owner comments; **not an approval to modify code or live database**.

## 1. Authority and limits

The uploaded portable reference `Sleepee_Single_Source_Of_Truth_v1.0_Portable_Reference(1).md` was read in full (1,206 lines). Its Section A, the original MASTER REFERENCE SPECIFICATION VERSION 1.0, remains the authoritative business source. This document is a separate review/update addendum; it does **not** replace or edit the canonical source. Existing ZIPs are implementation evidence, not authority over the original specification. Do not execute SQL or modify code, GitHub, or Supabase as part of this review.

Authority order:
1. Original SSoT v1.0 Section A.
2. Technology/scope governance in the portable reference.
3. Owner clarifications recorded in this addendum, to be handled as a separately versioned amendment where they extend/change the original reference.
4. ZIPs and source files are evidence only.

## 2. Technology and scope freeze

- React + TypeScript + Vite; Supabase PostgreSQL/Auth/RLS/Storage/RPC/Realtime only.
- No Firebase/Firestore, alternate backend/database, LocalStorage/IndexedDB as primary storage, JSON DB, mock/fake/demo data sources, static arrays as operational source, or in-memory repositories.
- No ERP, CRM, accounting/costing module, HR/payroll, purchasing, warehouse ERP, vendor portal, POS or e-commerce.
- Use the existing GitHub repository and existing Supabase project/database. No reset, drop/recreate or new project.
- Preserve Phase 09 warranty behavior and immutable activation snapshots. No migration to be run before schema comparison, backup, and explicit approval.

## 3. Target workspaces

The desired user-facing structure is a dashboard plus these consolidated workspaces: (1) Production & Manufacturing, (2) Warranty & Customer Service, (3) Reports & Analytics, (4) Administration, plus the public `/verify` page. Operational capabilities can remain internally modular, but must not proliferate into unnecessary top-level centers or unrelated ERP modules.

Known company details from the canonical reference: `الشركة العربية لصناعة مراتب السوست والإسفنج`; English name `Arabian Spring & Foam Mattresses Mfg. Company LTD`; address `6th October City, Industrial Zone 2, Daewoo Street, Plot 145-146`; hotline `19707`; email `Online@sleephigh.com`; site `https://sleephigh.com/ar`.

## 4. Manufacturing and routing — owner-confirmed information

Actual factory departments:
1. Wire and chassis formation.
2. Quilting and tailoring.
3. Upholstery and assembly.
4. Tape edge.
5. Packaging.

The SAP representation groups the first three actual factory departments into a single first operation, then has tape and packaging as the other two operations. This is grouping of the same operating-time information, not a different source of time values. Do not split the current total minutes into five per-department values unless measured/source data is provided.

Known machine context: three Bonnell forming machines, one Pocket forming/assembly machine, and **10 production tables**. Routes vary by model, construction, brand, machine/line and whether a mattress has two symmetric faces, a top-only face, a Pillow Top/wall, or foam/rebond construction. A route may return to assembly after tape and then return to tape for final finishing. Support model-specific paths, alternatives and repeat operations; exact machine sequence/time by operation remains a shop-floor validation item.

### American system and frame
- Reference final mattress size example: width 100 cm × length 200 cm.
- Intended American chassis size for that example: width 97 cm × length 197 cm (3 cm smaller each way).
- Actual manufacturing can vary by 2–3 cm because frame cutting/bending is not perfectly exact; an actual chassis may be 98 × 198 cm. Preserve the intended target separately from measured output/tolerance.
- Frame thickness: **5 mm is correct**, with a commercial example of approximately 4.85 mm. The earlier 5 cm statement was an error.

### German system and patches
- Correct terms: `بلصة الطول` and `بلصة العرض` (length patch and width patch), not “طوب”.
- A model's patch sizes must come from that model's BOM; do not apply one global subtraction rule to every German mattress. Owner examples include Tranquility 30 German with a width patch at 86 cm (14 cm below the 100 cm reference), Romance 33 German with a width patch at 78 cm, and the unresolved Rrstcalm entry below.
- HR Foam and Memory Foam in Rrstcalm are **internal filling layers**, not patches. Keep those component types separate.

## 5. BOM, layer construction and material coding

Source roles:
- `Models BOM.xlsx`: source for model-specific BOM/components, internal material codes, descriptions/quantities and an embedded operating-time tab.
- `توضيح الطبقات والحشو الداخلي.xlsx`: engineering-layer construction and product specification context.
- `كل المواد الخام مصنع السست.xlsx`: material master references, including current/old material identifiers and descriptions. Price/valuation fields are not a request to build costing.
- `EGYP RM FOR EDRAKY 23 MARCH 2025.xlsx`: SAP/import mappings across `SAP KSA RM`, `6F01 FOR SAP`, `6F02 FOR SAP`; use for reference/mapping, not as a reason to change current source codes.

Product constructions can vary by top/bottom symmetry, Pillow Top/top-only wall, Bonnell wire diameter (e.g. 2.2 vs 2.4), Pocket, foam/rebond, foam density and height, felt type/attachment and glue. Treat each layer/component according to the source; do not classify internal HR/Memory Foam as patches.

Owner's tentative explanation for material code `228KN17X78X10`: leading type digit may encode sheet/roll/block (`2` possibly sheet, `3` roll, `1` block); `28` is density; `KN` relates to color/softness class; dimensions `17×78×10` mean height × length × width. Because the owner said the first-digit mapping is believed rather than confirmed, retain the original code and label this dictionary as **partially unverified** until supported by a formal list. Do not auto-generate/rename codes from this inference.

### Size reference
BOM reference size: **width 100 × length 200 cm**. Do not assume each raw material scales by the same formula; use explicit source BOM values until material-specific scaling rules are confirmed.

### Unresolved material-data conflict
For Rrstcalm width patch, `228KN17X78X10` implies a length dimension of 78 cm by the owner's interpretation; the spreadsheet description says 80 cm, and quantity `0.0272 m³` appears consistent with two pieces at 80×17×10 cm. The owner has not yet confirmed which dimension is correct. Do not edit code, description or quantity automatically. This conflict is about the patch component only; HR and Memory Foam are unrelated internal filling layers.

## 6. Operating-time source — authoritative current data

`وقت التشغيل.xlsx` is the separately supplied primary reference for the current operating-time values. The `وقت التشغيل` sheet has 41 product/material entries plus a `Total` row; its row includes monthly quantity columns, total production and `وقت التشغيل مرتبة / دقيقة`. The embedded `وقت التشغيل` tab in `Models BOM.xlsx` is a cross-reference, not a reason to overwrite the separate workbook.

- The minutes are current, estimated, model-level total operating times reflecting actual department work; they are **not** broken down into the five actual departments or into SAP's three grouped operations.
- Keep current values without editing; owner wants future editability by model, with user/date/reason and before/after value history.
- Values are provisional until measured/reviewed on the factory floor.
- Number of production tables is 10. Do not calculate capacity by dividing minutes by 10 unless actual parallel work assumptions are verified.
- Separate planned/standard time, actual measured time and throughput/capacity in future reporting.
- Ignore the cost sheet and any costing calculations as non-binding/out of scope; no costing/accounting module in this implementation.

## 7. Warranty and privacy

Current policy stated by owner:
- All mattress brands/models: 10 years currently.
- Pillows, cushions, and `مراتب تطرية`: 2 years currently.
- The future policy engine should allow specific warranty terms/duration at model level, without forcing a brand-wide change. Future examples such as Sleepee/Emareties models at 5 or 10 years are possibilities, not current defaults. Keep policy hierarchy category default → brand override → model override and current 1–15-year capability where configured by SSoT.
- Existing activations must preserve immutable duration/end-date snapshots; later policy changes must not rewrite previously activated warranties.

`شروط ضمان - منتجات سليب هاي.docx` is source material for SH wording; do not apply it wholesale to every brand. It contains a contradiction: rotate every three months in usage instructions vs monthly in an exclusion clause; text needs owner-approved harmonization before publication. No model-by-model SH duration table is present in that document.

Replacement/compensation policy should be legally reviewed against applicable Egyptian Consumer Protection Law and approved company policy; do not invent the legal effect/periods. Privacy basis: collect customer data only as needed to activate/check warranty and administer related service; do not publish personal customer data. Public verification may return only necessary product/warranty fields, not customer name, phone, national ID, invoice or attachments.

## 8. Roles and access — owner intent plus naming gap

Owner intent:
- Administrator: full permissions for all app areas and manages access.
- Production Manager and Production Operator users need access to the functions belonging to Production & Manufacturing.
- The “Sales permissions” scope includes Customer Service, warranty pages, replacements and related work.

**Specification gap:** original canonical role names include `Customer Service User`, `Warranty Manager`, and `Read Only User`, while the Phase 10–18 ZIP uses `Customer Service Agent`, `Warranty Officer`, and `Service Manager`; the code/RPC allowlist uses those implementation names. The owner's “Sales permissions” may mean a permission domain or a named new role. Before changing role names, user_roles or RLS, formally approve a role mapping/amendment. Keep master-data administration ownership with Administrator. Differences between manager/operator approval rights should be specified rather than invented.

## 9. Serial history, ownership transfer, QR and public portal

Canonical serial format remains `SLP-YYYY-XXXXXXXX`, globally unique, never reused/reset; orders `ORD-YYYY-XXXXXX`; batches `BAT-YYYY-XXXXXX`. Owner wants Lost, Destroyed, Cancelled, Returned and Transferred reflected in lifecycle. Decide whether each is a status or an immutable event before schema changes; ownership transfer should be a transfer event keeping same product/serial and, while active, same warranty status/end date. Replacement with a new product/serial is a separate, linked replacement case.

QR enhancements requested: public product/warranty verification, relevant care instructions/manual, and service contact/request entry points. No full customer warranty portal exists today beyond public verification and the authenticated admin/application. Public QR must not expose personal data.

## 10. Label design, printing, notifications and analytics

- No currently approved physical label design; show proposed new designs for owner approval. Labels are for final product packaging.
- Zebra ZD220 over USB via Zebra Browser Print; actual printer test is still pending.
- Support at least 100×100, 100×80 and 100×50 mm plus configurable dimensions. Likely fields: official logo, brand/model/size, serial, Code128 barcode, QR, policy-derived warranty duration, approved text/contact details. Do not finalize legal wording or design before owner approval.
- Print jobs should retain status/history; do not mark printed without actual Browser Print/printer success response; retries/reprints must preserve previous print history.
- Notifications requested: in-app, WhatsApp and email. WhatsApp/email provider and credentials are not defined; do not invent them or commit secrets to source. In-app may be built with existing Supabase capability after implementation approval.
- Reporting requested across production, warranty, customer service, replacements and printing; export data to CSV/XLSX/JSON/PDF and provide documented, structured data for external analytics tools. Do not promise direct integration with every third-party product without connector scope.

## 11. Source files reviewed

| Source | What it supports | Limits |
|---|---|---|
| `Sleepee_Single_Source_Of_Truth_v1.0_Portable_Reference(1).md` | Original authoritative spec and governance | Must remain unchanged |
| `SLEEPEE_PLATFORM_PHASE_10_18_UNIFIED_v1.0(1).zip` | Actual Phase 10–18 app source, migration, validation SQL and reports | ZIP does not prove live DB deployment; package not buildable in current environment due missing dependencies |
| `sleepee-PHASE09_FIXED-v3(1).zip` | Phase 09 code, root schema/supabase-schema and migration material | Do not blindly overlay on 10–18; no live check in this review |
| `Models BOM.xlsx` | 50 sheets incl. material/model BOM tabs and embedded time tab | Price sheet is not a costing requirement |
| `وقت التشغيل.xlsx` | One `وقت التشغيل` sheet with monthly output and model-level minutes | Model-level estimated totals, not 5 department times |
| `توضيح الطبقات والحشو الداخلي.xlsx` | One engineering specification/layer sheet (`A1:L1075`) | Some codes/descriptions may need reconciliation |
| `كل المواد الخام مصنع السست.xlsx` | Material master/old material IDs/descriptions and other SAP fields | Price/valuation fields are out of current scope |
| `EGYP RM FOR EDRAKY 23 MARCH 2025.xlsx` | `SAP KSA RM`, `6F01 FOR SAP`, `6F02 FOR SAP` material mapping sheets | Mapping evidence, not authority to rename current codes |
| `شروط ضمان - منتجات سليب هاي.docx` | SH usage/warranty/return/repair source text | One-month/three-month rotation contradiction; not generic for all brands |
| Logo and operating screenshots uploaded in chat | Visual/engineering context | Do not imply the prior label is approved |

## 12. ZIP review — verified findings

### Package A — `SLEEPEE_PLATFORM_PHASE_10_18_UNIFIED_v1.0(1).zip`
- Inspected actual archive: 108 files.
- Contains the app source, `SLEEPEE_PHASE_10_18_UNIFIED_MIGRATION.sql` and `docs/phases/PHASE_18_FINAL_VALIDATION.sql`.
- No root `schema.sql` or `supabase-schema.sql`; older schemas exist under `archive/legacy_sql/` and are explicitly marked legacy in deployment docs.
- No npm lockfile present in this ZIP; `package.json` includes unused-looking `@google/genai`, `express` and `@types/express` dependencies and `.env.example` has `GEMINI_API_KEY`; no source import of these dependencies was found in the static scan. Verify/remove residues in an approved cleanup; this scan alone does not prove runtime behavior.
- Static check: 53 TS/TSX/JS source files; 121 relative imports scanned; 0 missing relative import targets.
- Static scan found no Firebase/Firestore, localStorage, sessionStorage or indexedDB references in source.
- `npm run lint` failed in this environment because `vite/client` type definitions were unavailable; `npm run build` failed because `vite` command was unavailable. Full build/lint therefore NOT VERIFIED.
- `DEPLOYMENT_CHECKLIST.md` says to execute `schema.sql` and marks checks READY, but this ZIP has no root `schema.sql`; `SLEEPEE_PHASE_10_18_DEPLOYMENT.md` instead says not to run archived/legacy schema. This is a material deployment-document conflict to resolve before use.
- Migration contains policy replacement operations and additive columns/functions; static scan found no `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, `DROP SCHEMA`, `DROP DATABASE` or `DROP COLUMN` in the active unified migration. Policy changes are still security-impacting and need backup/live tests. No database migration was run.
- Migration contains a comment referencing `PHASE_10_18_UNIFIED_AUDIT_RPC.sql`, which is not a separate file in the ZIP; `record_application_event_v2` is declared at the start of the same migration. Clean stale comment/documentation before a release.
- Public warranty RPC response does not expose customer PII fields, but `PublicPortalView.tsx` renders `warranty_start` (mapped from invoice date) under a UI label keyed as `invoice_no`. Fix field label/mapping before release.
- Route and SQL permission mapping use `Warranty Officer`, `Customer Service Agent`, `Service Manager`, conflicting with role names in canonical Section A. Needs an approved mapping/amendment; no role changes performed.
- ZIP identifies itself as Phase 10–18, not Phase 10–19. A Phase 19 artifact is not included in this upload.

### Package B — `sleepee-PHASE09_FIXED-v3(1).zip`
- Inspected actual archive: 98 files.
- Contains root `schema.sql`, `supabase-schema.sql`, `package-lock.json`, `bun.lock`, Phase 09 repair/migration artifacts, and app source; does not include the unified Phase 10–18 migration and Phase 18 validation SQL.
- It is a distinct package variant, not a replacement for the newer Phase 10–18 package. Do not merge or deploy by blindly overlaying ZIP contents.

### Overall technical review status
**PARTIALLY COMPLIANT / NOT CERTIFIED IN THIS REVIEW.** Static checks show no obvious prohibited storage/backend references, but clean build/lint failed due missing installed dependencies, deployed schema and live Supabase/Auth/RLS/RPC/Storage/Realtimes were not queried, and there are important documentation/role/UI gaps. The separate Phase 09 certification note says the warranty phase was certified on 2026-10-07; this review did not re-run its live tests, so this statement is historical documentation, not fresh LIVE-VERIFIED status.

## 13. Open items / exact decisions or actions still needed

| ID | Priority | Gap | Required action |
|---|---|---|---|
| O-01 | Critical | Role names differ between canonical reference and runtime allowlist; “Sales permissions” may be a permission domain or role | Approve exact role mapping/names before Auth/RLS changes |
| O-02 | High | Rrstcalm width-patch code indicates 78 cm, while description and quantity suggest 80 cm | Confirm approved dimension; preserve source until then |
| O-03 | High | SH rotation instructions say every 3 months in one place and monthly in another | Approve one public wording before publishing |
| O-04 | High | WhatsApp/email providers and configuration are unspecified | Choose provider and secure configuration approach before enabling outbound messages |
| O-05 | High | Zebra ZD220 / Browser Print has not been physically tested | Run a real printer test with the approved label, barcode and QR |
| O-06 | High | Current runtime workbook has model-level estimated total minutes, not separately measured times by machine/department | Validate routing and times on the factory floor; do not derive split times by guesswork |
| O-07 | High | Full approved replacement/compensation policy for all brands was not supplied in this review | Approve company policy and verify current Egyptian legal requirements before implementation |
| O-08 | Medium | Material-code prefix interpretation is tentative, not a formal coding dictionary | Confirm code dictionary; preserve identifiers in the meantime |
| O-09 | Medium | Old/new material identifiers and names may not map one-to-one | Review mapping and duplicates before imports or recoding |
| O-10 | Medium | Lost/Destroyed/Cancelled/Returned/Transferred are not yet defined as statuses vs immutable events | Approve transition semantics, audit effects and traceability |
| O-11 | Medium | Proposed customer-service workflow has not been formally approved | Approve statuses, transitions, decision/closure requirements |
| O-12 | Medium | Label design and legal/commercial wording are not approved | Review design/content and approve before real printing |
| O-13 | Critical | Phase 10–18 ZIP has no root schema or npm lockfile; clean build/lint are not verified; deployment instructions conflict on schema.sql | Establish a single verified baseline, reconcile docs, install dependencies cleanly and run build/lint |
| O-14 | Medium | Public verification UI maps `warranty_start` (invoice date) to a label keyed as invoice number | Correct label/field mapping in an approved source fix |
| O-15 | Medium | `@google/genai`, Express and `GEMINI_API_KEY` look unused in source scan | Verify usage; remove only as part of an approved cleanup |
| O-16 | Medium | Uploaded implementation package covers Phase 10–18, not Phase 19 | Clarify whether Phase 19 is in scope; do not relabel the package as 10–19 |
| O-17 | Critical | Current live Supabase schema, Auth, RLS, RPC, Storage and Realtime state was not queried in this review | Inspect live state and take a suitable backup before any migration |
| O-18 | High | In `وقت التشغيل.xlsx`, source row 45 has `150` under February but no item name | Identify the source of the row; do not assign the value to a model automatically |
| O-19 | Medium | One technical-layer sheet uses “السست” while canonical legal name uses “السوست” | Preserve canonical company identity; confirm source spelling before any master-data import |

## 14. Safe execution gates

1. Owner approves this change/review addendum and closes critical open items.
2. Compare current GitHub branch/current application to both ZIPs and canonical spec; keep one chosen source baseline, not ZIP-overlay guesswork.
3. Inspect current Supabase deployed schema and Auth/RLS/RPC/storage state; export/backup before migrations. SQL files alone do not establish live state.
4. Reconcile deployment docs, lock dependencies, correct confirmed UI mapping issues and remove unused technology residues only with approval.
5. Design and approve detailed routing, model-level BOM/versioning, permission mapping, new serial state/event semantics, label layout/text, notification providers.
6. Apply reviewed additive migrations only; never reset/replace the existing database. Validate Phase 09 warranty snapshot immutability/duplicate guards and RLS regression.
7. Run clean install, lint, build, tests, route/RLS/RPC tests, live warranty verification, storage/privacy tests and real Zebra print tests.
8. Publish a compliance matrix with evidence and mark phases certified only after all required gates pass.

**No source code, ZIP, GitHub repository, or Supabase database was modified during this review.**
