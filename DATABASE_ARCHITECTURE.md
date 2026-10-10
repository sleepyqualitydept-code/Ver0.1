# Database Architecture & Governance Document — Phase 02
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document describes the design specifications, schemas, views, custom database procedures (RPC), and indices deployed in Supabase PostgreSQL for Phase 02.

---

### 1. Database Entity List (Tables Registry)

The public database layer is composed of 22 transactional tables and mappers structured to guarantee data integrity and reference normalization:

#### A. Master Data Schemas
* **`categories`**: Primary product taxonomy list.
* **`brands`**: Managed brand registry.
* **`models`**: Product models mapping to brands and categories.
* **`mattress_sizes`**: Permitted dimension definitions.
* **`product_types`**: Classifications of mattress or padding products.

#### B. Customer & Consumer Schemas
* **`customers`**: Unique end-user buyer records.

#### C. Production Operations Schemas
* **`production_orders`**: Scheduled factory orders.
* **`production_order_lines`**: Discrete specification rows for production orders.
* **`production_batches`**: Batches grouping order items for serialized printing.

#### D. Serialization & Traceability Schemas
* **`serial_numbers`**: Barcode records mapped to production batches and product models.
* **`serial_history`**: Audit ledger capturing state changes during serial life cycle.

#### E. Label Designing & Printing Schemas
* **`label_templates`**: Visual label template layout designs stored in JSONB formats.
* **`print_jobs`**: Logs of label printer execution jobs.
* **`print_history`**: Tracking history mapping print jobs directly to printed serials.

#### F. Warranty Registration Schemas
* **`warranty_policies`**: Target duration configurations for brands or categories.
* **`warranty_activations`**: Consumer purchase activations.

#### G. Customer Service & defect Inspection Schemas
* **`service_cases`**: Defect logs and complaints.
* **`service_case_notes`**: Comments and updates logged by support technicians.
* **`service_attachments`**: Defect photo files hosted in private storage.

#### H. Replacements & Compensations Schemas
* **`replacement_requests`**: Valid claims approved for product replacement.
* **`replacement_history`**: Logs of state changes for replacement claims.

#### I. Audit Logging Schema
* **`audit_logs`**: System audit ledger.

---

### 2. Indexes and Database Constraints Mappings

* **Check Constraints**:
  * `production_orders.order_number`: Regex check for standard format `ORD-YYYY-XXXXXX`.
  * `production_batches.batch_number`: Regex check for standard format `BAT-YYYY-XXXXXX`.
  * `serial_numbers.serial_number`: Regex check for standard format `SLP-YYYY-XXXXXXXX`.
  * `mattress_sizes.width_cm`, `mattress_sizes.length_cm`: Values must be positive integers.
  * `production_order_lines.quantity`: Value must be a positive integer.
* **Referential Constraints**:
  * `fk_line_model_brand` on `production_order_lines`: Multi-column constraint confirming that the selected model belongs to the selected brand.
* **Performance Indexes**:
  * Unique index on `production_orders(order_number)`
  * Unique index on `production_batches(batch_number)`
  * Unique index on `serial_numbers(serial_number)`
  * Index on `customers(phone)`
  * Index on `customers(national_id)`
  * Index on `warranty_activations(invoice_number)`
  * Index on `service_cases(case_number)`

---

### 3. Reporting Views Registry

The database exposes 7 views to simplify complex dashboard analytical calculations and provide secure read layers:
1. **`vw_production_orders`**: Aggregates scheduled orders with total run counts and user profiles.
2. **`vw_batches`**: Exposes batch metadata joined with order numbers.
3. **`vw_serials`**: Normalizes unique serial cards with model names, brands, and categories.
4. **`vw_warranty_activations`**: Joined views mapping consumer information to active warranty certificates.
5. **`vw_service_cases`**: Maps open complaints to active serial records and customer details.
6. **`vw_replacements`**: Maps active replacement claims.
7. **`vw_dashboard_kpis`**: Single-row KPI aggregator.
