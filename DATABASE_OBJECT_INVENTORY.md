# Database Object Inventory — Phase 02
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document provides a comprehensive inventory of all physical PostgreSQL database objects, security rules, storage buckets, and realtime publications in the Sleepee platform.

---

### 1. Tables (26)
1. `profiles`: User account details linked to `auth.users(id)`.
2. `user_roles`: Role assignments (7 approved roles).
3. `categories`: Product categories taxonomy.
4. `brands`: Bedding brands taxonomy.
5. `models`: Product models taxonomy.
6. `mattress_sizes`: Mattress dimension standards (`width_cm`, `length_cm`).
7. `product_sizes`: Size register (`size_value`).
8. `product_types`: Product type classifications (`code`, names).
9. `products`: Master product catalog records.
10. `customers`: End-consumer details (`full_name`, `phone`, `national_id`).
11. `production_orders`: Factory order headers (`order_number`).
12. `production_order_lines`: Line item specifications.
13. `production_batches`: Serialized production batches (`batch_number`).
14. `serial_numbers`: Unique item barcodes (`serial_number`).
15. `serial_history`: Lifecycle history trail.
16. `label_templates`: Thermal printing layout JSON templates.
17. `print_jobs`: Thermal print station execution logs.
18. `print_history`: Mapping between print jobs and printed barcodes.
19. `warranty_policies`: Duration rules by model, brand, or category.
20. `warranty_activations`: Consumer purchase activation records.
21. `service_cases`: Support cases and tickets (`case_number`).
22. `service_case_notes`: Action logs and technician comments.
23. `service_attachments`: Private defect photo files.
24. `replacement_requests`: Replacement claims (`request_number`).
25. `replacement_history`: Action log for replacement claims.
26. `audit_logs`: Transaction audit trails (`old_data`, `new_data`).

---

### 2. Views (8)
1. `vw_production_orders`
2. `vw_batches`
3. `vw_serial_numbers`
4. `vw_serials` (Alias)
5. `vw_warranty_activations`
6. `vw_service_cases`
7. `vw_replacements`
8. `vw_dashboard_kpis`

---

### 3. Stored Functions / RPC (8)
1. `generate_serials(p_batch_id, p_model_id, p_qty, p_user_id)`
2. `create_batch(p_order_id, p_qty)`
3. `activate_warranty(p_serial_id uuid, p_customer_id uuid, p_customer jsonb, p_invoice_number text, p_invoice_date date)` — Atomic retail warranty activation (Actor: `auth.uid()`, Duration: resolved policy Model -> Brand -> Category, Customer: existing or atomic creation inside transaction).
4. `create_service_case(p_customer_id, p_serial_id, p_case_type, p_subject, p_description, p_user_id)`
5. `approve_replacement(p_request_id, p_user_id, p_new_serial_id)`
6. `get_dashboard_kpis()`
7. `global_search(p_query)`
8. `validate_serial_format(p_serial)`

---

### 4. Triggers (1)
1. `process_audit_log`: Fires on `INSERT`, `UPDATE`, `DELETE` to populate `audit_logs`.

---

### 5. Indexes (9)
1. `idx_customers_phone` on `customers(phone)`
2. `idx_customers_national_id` on `customers(national_id)`
3. `idx_serial_number` on `serial_numbers(serial_number)`
4. `idx_warranty_invoice` on `warranty_activations(invoice_number)`
5. `idx_cases_number` on `service_cases(case_number)`
6. `production_orders_order_number_key` (Unique)
7. `production_batches_batch_number_key` (Unique)
8. `serial_numbers_serial_number_key` (Unique)
9. `service_cases_case_number_key` (Unique)

---

### 6. RLS Security Policies (32)
* Role-based `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies on all 26 physical tables evaluated against `user_roles.role_name`.

---

### 7. Supabase Storage Buckets (4)
1. `product-images`: Public bucket for product catalog photos and brand graphics.
2. `warranty-documents`: Private bucket for consumer purchase receipts and national ID scans.
3. `service-attachments`: Private bucket for defect photos and technician notes.
4. `replacement-documents`: Private bucket for board approval letters and replacement forms.

---

### 8. Realtime CDC Publications (1)
* `supabase_realtime`: Subscribed to `production_orders`, `production_batches`, `serial_numbers`, `service_cases`, and `replacement_requests`.

---

### Final Inventory Status
**PASS — Complete Inventory Verified**
