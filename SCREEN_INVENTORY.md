# Screen Inventory — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document inventories every screen across the 12 top-level modules, documenting Route, Purpose, Permissions, Data Sources, and Dependencies.

---

### Module Screens Inventory

| Module Name | Route | Purpose | Allowed Roles | Data Sources | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01. Dashboard** | `/dashboard` | Operational metrics & widgets | All 7 Roles | `vw_dashboard_kpis`, `production_orders`, `serial_numbers`, `service_cases` | Supabase Client |
| **02. Master Data** | `/master-data` | Product taxonomy governance | Administrator, Production Manager | `categories`, `brands`, `models`, `mattress_sizes`, `product_types` | Master APIs |
| **03. Production** | `/production` | Excel planning & orders execution | Admin, Prod Manager, Prod Operator | `production_orders`, `production_batches`, `serial_numbers` | Production APIs |
| **04. Serialization** | `/serialization` | Barcode generation & tracking | Admin, Prod Manager, Warranty Officer | `serial_numbers`, `serial_history` | Serialization RPCs |
| **05. Printing** | `/printing` | Zebra ZD220 thermal print queue | Administrator, Printing Operator | `print_jobs`, `print_history`, `serial_numbers` | Printing APIs |
| **06. Label Designer** | `/label-designer` | Drag-and-drop thermal template design | Administrator, Printing Operator | `label_templates` | Canvas Engine |
| **07. Warranty** | `/warranty` | Retail warranty policies & activation | Admin, Warranty Officer | `warranty_policies`, `warranty_activations`, `customers` | Warranty APIs |
| **08. Customer Service** | `/customer-service` | Unified 360 customer support workspace | Admin, CS Agent, Service Manager | `customers`, `service_cases`, `service_case_notes` | CS APIs |
| **09. Replacement** | `/replacement` | Replacement lifecycle & traceability | Admin, Service Manager | `replacement_requests`, `replacement_history`, `serial_numbers` | Replacement APIs |
| **10. Reports** | `/reports` | Analytical reports & CSV export | Admin, Prod Manager, Service Manager | Reporting Views (`vw_*`) | Supabase RPCs |
| **11. Administration** | `/admin` | System governance & audit logs | Administrator only | `profiles`, `user_roles`, `audit_logs` | Admin APIs |
| **12. Public Portal** | `/verify` | Anonymous consumer warranty verification | Anonymous (Public) | `serial_numbers`, `warranty_activations`, `customers` | Public RPCs |
