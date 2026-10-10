# Sleepee Platform — Rebuilt Candidate v1.1 Deployment Guidance

## Deployment status: HOLD

This file describes a planned isolated development environment. It does not authorize deployment to production or changes to the prior repository/database.

## Intended target

- New private GitHub repository for this candidate.
- New isolated Supabase project for development/testing.
- New Google AI Studio workspace for architecture review and incremental work.
- React + TypeScript + Vite; Supabase only for backend services.
- Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit `.env` or service-role secrets.

## SQL artifacts

- `SLEEPEE_PHASE_10_18_UNIFIED_MIGRATION.sql`: historical Phase 10–18 candidate; not certified against the planned new database.
- `docs/proposed-migrations/20261010_additive_manufacturing_engineering.sql`: proposed additive migration for new engineering tables; not an active migration.
- `archive/legacy_sql/`: historical reference only; do not run automatically.

Even for a new empty Supabase project, first prepare and approve a baseline schema strategy, then review every migration for consistency with code, canonical rules, roles, and RPC contracts. Never use old scripts as a one-click reset/bootstrap step.

## Verification gates

1. Confirm new repository identity, privacy, branch and commit SHA.
2. Install dependencies cleanly and generate a valid lockfile.
3. Run `npm run lint` and `npm run build`.
4. Review and approve the new database baseline; test RLS/RPC.
5. Test Phase 09 warranty snapshot immutability and duplicate guards.
6. Test manufacturing engineering drafts only after schema approval.
7. Physically test Zebra ZD220 through the approved renderer before reporting print success.
8. Approve release only after actual evidence is recorded.
