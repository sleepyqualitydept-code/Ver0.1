# RPC Validation Report — Phase 06 (Updated)
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document verifies the implementation, parameters, return types, and transactional safety of all required stored procedure (RPC) functions in the live Supabase PostgreSQL database.

---

### Active Production RPC Functions Status

| RPC Function Name | Active Production Contract | Return Type | Transactional Logic & Security | Status |
| :--- | :--- | :--- | :--- | :---: |
| **`generate_serials`** | `p_batch_id uuid`, `p_qty integer` | `void` | Resolves model & quantity from `production_order_lines`, generates `SLP-YYYY-XXXXXXXX` barcodes via `gen_random_uuid()`, inserts into `serial_numbers` (`production_date`), writes `serial_history`, updates `production_batches` status to `serialized`. | **PASS** |
| **`create_batch`** | `p_order_id uuid`, `p_qty integer` | `uuid` | Generates `BAT-YYYY-XXXXXX` unique number, creates `production_batches` record, links to order. | **PASS** |
| **`activate_warranty`** | `p_serial_id uuid`, `p_customer_id uuid`, `p_customer jsonb`, `p_invoice_number text`, `p_invoice_date date` | `uuid` | SECURITY DEFINER, search_path=public. Authoritative actor `auth.uid()`, server-side policy resolution (Model -> Brand -> Category), invoice validation, duplicate prevention, atomic customer resolution/creation, writes `warranty_activations`, updates serial to `activated`, writes `serial_history`. | **PASS** |
| **`create_service_case`** | `p_customer_id uuid`, `p_serial_id uuid`, `p_case_type text`, `p_subject text`, `p_description text`, `p_user_id uuid` | `uuid` | Generates `CS-YYYY-XXXXXX`, inserts `service_cases`, logs note in `service_case_notes`, sets serial status to `service`. | **PASS** |
| **`approve_replacement`** | `p_request_id uuid`, `p_user_id uuid`, `p_new_serial_id uuid` | `void` | Updates `replacement_requests` status to `approved`, logs event in `replacement_history`, updates serial statuses. | **PASS** |
| **`get_dashboard_kpis`** | *None* | `json` | Aggregates counts across active orders, batches, printed labels, active warranties, open cases, and replacements into a single JSON object. | **PASS** |
| **`global_search`** | `p_query text` | `table(...)` | Unified search across customer phone/national ID, serial number, case number, and invoice number. | **PASS** |

---

### Historical / Legacy RPC Signatures (Deprecated)

> **NOTE**: The legacy 4-parameter `generate_serials` RPC signature (`p_batch_id uuid, p_model_id uuid, p_qty integer, p_user_id uuid`) is **[HISTORICAL / DEPRECATED]**. Do NOT use this legacy contract in active Phase 06 runtime code. Model and quantity are authoritatively derived in PostgreSQL from `production_order_lines`.

---

### Additional Helper Functions
* **`validate_serial_format(p_serial text)`**: Returns `boolean` verifying regex `^SLP-[0-9]{4}-[A-Z0-9]{8}$`.
* **`process_audit_log()`**: Pl/pgSQL trigger function logging state changes into `audit_logs`.
* **`get_current_user_role()`**: Helper function resolving `role_name` from `user_roles` for RLS evaluation.
