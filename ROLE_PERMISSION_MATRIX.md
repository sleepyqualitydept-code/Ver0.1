# Sleepee Role Permission Matrix — Phase 02
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document establishes the official Role-Based Access Control (RBAC) authorization matrix across all system operational modules and tables for the 7 approved roles defined in the reference specification.

---

### Approved Role Model

1. **`Administrator`**: Full System Access (Read, Write, Update, Delete, Security, User Management).
2. **`Production Manager`**: Production Planning, Orders, Order Lines, Batches, Master Data, Serial Oversight.
3. **`Production Operator`**: Production Floor Execution, Order Status Updates, Batch Execution.
4. **`Printing Operator`**: Serialization Label Printing, Print Jobs, Thermal Printer Station Queue.
5. **`Warranty Officer`**: Retail Warranty Activations, Warranty Policies, Invoice Verification.
6. **`Customer Service Agent`**: Customer Registration, Ticket Intake, CS Notes, Attachment Logging.
7. **`Service Manager`**: Service Supervision, Defect Escalations, Replacement Approvals, Case Closure.

---

### Matrix Mapping

| Module / Table | Administrator | Production Manager | Production Operator | Printing Operator | Warranty Officer | Customer Service Agent | Service Manager |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`categories`** | CRUD | CRUD | READ | READ | READ | READ | READ |
| **`brands`** | CRUD | CRUD | READ | READ | READ | READ | READ |
| **`models`** | CRUD | CRUD | READ | READ | READ | READ | READ |
| **`mattress_sizes`** | CRUD | CRUD | READ | READ | READ | READ | READ |
| **`product_types`** | CRUD | CRUD | READ | READ | READ | READ | READ |
| **`products`** | CRUD | CRUD | READ | READ | READ | READ | READ |
| **`customers`** | CRUD | READ | READ | READ | CRU | CRU | CRU |
| **`production_orders`** | CRUD | CRU | RU | READ | READ | READ | READ |
| **`production_order_lines`**| CRUD | CRU | READ | READ | READ | READ | READ |
| **`production_batches`** | CRUD | CRU | RU | RU | READ | READ | READ |
| **`serial_numbers`** | CRUD | CRU | RU | RU | RU | READ | RU |
| **`serial_history`** | CRUD | READ | READ | READ | CREATE | CREATE | CRU |
| **`label_templates`** | CRUD | READ | READ | CRU | READ | READ | READ |
| **`print_jobs`** | CRUD | READ | READ | CREATE | READ | READ | READ |
| **`print_history`** | CRUD | READ | READ | CREATE | READ | READ | READ |
| **`warranty_policies`** | CRUD | READ | READ | READ | CRU | READ | READ |
| **`warranty_activations`** | CRUD | READ | READ | READ | CREATE | READ | READ |
| **`service_cases`** | CRUD | READ | READ | READ | READ | CRU | CRU |
| **`service_case_notes`** | CRUD | READ | READ | READ | READ | CREATE | CREATE |
| **`service_attachments`** | CRUD | READ | READ | READ | READ | CREATE | CREATE |
| **`replacement_requests`**| CRUD | READ | READ | READ | READ | READ | CRU |
| **`replacement_history`** | CRUD | READ | READ | READ | READ | READ | CREATE |
| **`audit_logs`** | READ | NONE | NONE | NONE | NONE | NONE | NONE |

*Legend: C = Create, R = Read, U = Update, D = Delete*

---

### Verification
* All RLS policies in `schema.sql` enforce this permission matrix.
* UI navigation and menu tabs adapt according to `user_roles.role_name`.
