# Sleepee — Phase 10→18 Rebuilt Candidate v1.1

**Status:** REVIEW CANDIDATE — NOT CERTIFIED FOR PRODUCTION.

This package was reconstructed from the owner-designated Phase 10–18 ZIP first, then reconciled with the prior integration candidate's modifications and additive files. See `docs/integration/REBUILD_RECONCILIATION_REPORT_AR.md` for the file-level counts and `docs/reference/Sleepee_Architecture_Development_Blueprint_v1.0_DRAFT_AR.md` for the architecture and implementation gates.

### Included integration work

- Consolidated workspace navigation while preserving internal modular routes.
- Initial Manufacturing Engineering / BOM / Routing draft screens and a proposed additive migration outside the active migrations directory.
- Quick Production Wizard using existing application APIs and approval checks.
- 100×80 mm and custom label dimensions alongside original size presets.
- Public verification label/mapping corrections and official contact/reference cleanup.
- Fail-closed printing path until a real Zebra Browser Print SDK/renderer and physical acceptance test are available.
- Source-based operational master data instead of static fallback lists in production planning.
- Client-side role perspective switch removed from the user menu and AuthContext.
- New architecture blueprint, requirements, handoff, and reconciliation documentation.

### Verification limits

- Build and lint/typecheck have not been verified from a clean dependency installation in this environment.
- Live Supabase schema/Auth/RLS/RPC/Storage/Realtime are not verified.
- No SQL or migration was executed.
- The new GitHub repository, new isolated Supabase project, and Google AI Studio workspace have not yet been created/linked from this package.
- Physical Zebra printing and complete end-to-end regression tests have not run.

Do not treat the existence of source code, SQL, or a historical certification document as proof that a feature is deployed or currently passing tests.
