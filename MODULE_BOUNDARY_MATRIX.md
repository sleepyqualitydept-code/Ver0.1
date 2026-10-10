# Module Boundary Matrix — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document defines strict data ownership and boundary rules across all system modules. No module may modify data owned by another module without explicit workflow rules.

---

### Module Ownership Registry

| Module Name | Owned Entities & Tables | Boundary Rules & Access Rights |
| :--- | :--- | :--- |
| **Product Master Data** | `categories`, `brands`, `models`, `mattress_sizes`, `product_sizes`, `product_types`, `products` | Exclusive write ownership by `Administrator` and `Production Manager`. Read access shared with all modules. |
| **Production Center** | `production_orders`, `production_order_lines`, `production_batches` | Write ownership by Production team. References Master Data tables strictly by foreign keys. |
| **Serialization Engine** | `serial_numbers`, `serial_history` | Write ownership via `generate_serials` RPC. Immutable barcodes (`SLP-YYYY-XXXXXXXX`). |
| **Printing Center** | `label_templates`, `print_jobs`, `print_history` | Write ownership by Printing Operator. References serial numbers and templates. |
| **Warranty Center** | `warranty_policies`, `warranty_activations`, `customers` | Write ownership by Warranty Officer. Links customer records to active serial numbers. |
| **Customer Service 360**| `service_cases`, `service_case_notes`, `service_attachments` | Write ownership by Customer Service Agent and Service Manager. |
| **Replacement Center** | `replacement_requests`, `replacement_history` | Write ownership by Service Manager. Enforces original serial retention rules. |
| **Reports Center** | Reporting SQL Views (`vw_*`) | Read-only reporting layer aggregating data across all upstream modules. |
| **Administration Center**| `profiles`, `user_roles`, `audit_logs`, System Settings | Exclusive write ownership by `Administrator`. |
| **Public Warranty Portal**| Anonymous Query Gateway | Read-only public portal executing secure verified RPC queries. |

---

### Boundary Enforcement Rules
1. **No Direct Cross-Module Mutation**: Modules cannot bypass foreign key constraints or update tables outside their defined ownership domain.
2. **Workflow-Driven State Transitions**: State changes (e.g. from Production Order to Batch Creation to Serialization) require valid parent record IDs and proper role authorization.
