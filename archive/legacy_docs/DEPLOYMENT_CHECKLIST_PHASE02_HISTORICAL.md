# Sleepee Platform Deployment Readiness Checklist — Phase 02
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document serves as the final deployment readiness check sheet for Phase 02 of the Sleepee Platform.

---

### Phase 02 Deployment Check Registry

| Check Item | Description | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **1. Database Schema Deployment** | Execute `schema.sql` completely inside Supabase SQL editor. | Table counts = 22 tables. | **[READY]** |
| **2. Storage Buckets Setup** | Create buckets `labels` (Public), `service` (Private), and `warranty` (Private). | File upload/download test runs | **[READY]** |
| **3. Realtime Publication** | Enroll `production_orders`, `production_batches`, `serial_numbers`, `service_cases`, and `replacement_requests` tables in replication publications. | Live channel event logs | **[READY]** |
| **4. RPC Functions Setup** | Check that `generate_serials`, `create_batch`, `activate_warranty`, `create_service_case`, `approve_replacement`, `get_dashboard_kpis`, and `global_search` functions are deployed. | Test execute standard calls | **[READY]** |
| **5. Core System Views** | Verify that `vw_production_orders`, `vw_batches`, `vw_serials`, `vw_warranty_activations`, `vw_service_cases`, `vw_replacements`, and `vw_dashboard_kpis` are created. | Query views select counts | **[READY]** |
| **6. RLS Policies Active** | Verify RLS policies are enabled on all tables and verify correct permissions matrix for all 7 roles. | CRUD permission testing | **[READY]** |
| **7. Primary Administrator Setup**| Create user `admin@sleephigh.com` in auth and map it to `profiles` and `user_roles`. | Central login verification | **[READY]** |
| **8. Environment Configuration** | Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured. | App compile verify | **[READY]** |
