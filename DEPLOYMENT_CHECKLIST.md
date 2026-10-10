# Release and Database Integration Checklist — Rebuilt Candidate v1.1

**Status: HOLD / NOT CERTIFIED.** This checklist is for a new isolated development environment. It does not authorize changes to the old GitHub repository or Supabase project.

## Repository and build

- [ ] Create a new private GitHub repository; keep the old repository unchanged.
- [ ] Upload extracted project contents, not only the ZIP file.
- [ ] Commit the canonical reference and new architecture blueprint unchanged.
- [ ] Regenerate and commit a valid lockfile from the chosen package manager in a clean environment.
- [ ] Clean dependency install succeeds.
- [ ] `npm run lint` succeeds.
- [ ] `npm run build` succeeds.
- [ ] Route/role checks pass after the role-name mapping has been approved.

## New isolated Supabase project

- [ ] Create a new project for development/testing; do not reset or alter the old project.
- [ ] Do not copy real customer/invoice/warranty data unless separately approved and protected.
- [ ] Review and create an approved baseline schema plan. Do not run archived SQL or old unified migrations automatically, even on a new project.
- [ ] Inventory schema, constraints, indexes, functions/RPC, RLS, Storage buckets/policies, and Realtime configuration after setup.
- [ ] Resolve canonical/runtime role-name mapping before changing Auth or RLS.
- [ ] Validate Phase 09 warranty snapshot immutability, duplicate activation guards, public verification privacy, and RLS.
- [ ] Review every migration and test it before release approval.

## Product engineering and manufacturing

- [ ] Review BOM/Routing draft schema and lifecycle/approval model.
- [ ] Keep source operating times separate from per-operation estimated/measured times. Never split total minutes by guesswork.
- [ ] Reconcile 9 upholstery/assembly tables vs 10 total production tables.
- [ ] Resolve source conflicts for Rrstcalm 78/80 cm and other material codes before import.
- [ ] Verify no unapproved master data has been inserted.

## Labels and printing

- [ ] Owner approves label design/content.
- [ ] Verify 100×50, 100×80, 100×100 mm and custom dimensions.
- [ ] Configure actual Zebra Browser Print SDK and approved template renderer.
- [ ] Physical test USB connection, discovery, test print, QR/barcode scan, failures, retries, and reprints.
- [ ] Confirm database records `printed` only after real printer confirmation.

## Release decision

- [ ] Attach build, tests, schema diff, security/RLS, privacy, and physical-printer evidence.
- [ ] Owner approves release.
- [ ] Create release ZIP and SHA-256 checksum after final validation.
