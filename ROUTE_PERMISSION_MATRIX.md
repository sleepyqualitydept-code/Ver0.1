# Route Permission Matrix — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document maps every application route to its allowed and denied roles in compliance with the enterprise security model.

---

### Route Permission Mapping

| Route Path | Module Name | Allowed Roles | Denied Roles | Special Conditions |
| :--- | :--- | :--- | :--- | :--- |
| **`/dashboard`** | Dashboard Center | All 7 Roles | None | Operational widget views adapt to role. |
| **`/master-data`** | Product Master Data | Administrator, Production Manager | All Operational / CS Roles | Strict catalog governance. |
| **`/production`** | Production Center | Admin, Prod Manager, Prod Operator | Printing, Warranty, CS Roles | Planning & execution. |
| **`/serialization`** | Serialization Engine | Admin, Prod Manager, Warranty Officer | Printing Operator, CS Agent | Barcode lifecycle management. |
| **`/printing`** | Printing Center | Administrator, Printing Operator | Production, CS, Warranty Roles | Thermal printer station queue. |
| **`/label-designer`** | Label Designer | Administrator, Printing Operator | Non-Printing Roles | Template design canvas. |
| **`/warranty`** | Warranty Center | Administrator, Warranty Officer | Production, Printing Roles | Consumer activation & policies. |
| **`/customer-service`**| Customer Service 360 | Admin, CS Agent, Service Manager | Production, Printing Roles | Customer support & tickets. |
| **`/replacement`** | Replacement Center | Administrator, Service Manager | Production, Printing, CS Roles | Replacement claim approvals. |
| **`/reports`** | Reports Center | Admin, Prod Manager, Service Manager | Production Operator | Analytical data extraction. |
| **`/admin`** | Administration Center | Administrator only | All non-Admin Roles | Security, users & audit logs. |
| **`/verify`** | Public Warranty Portal | Anonymous (Public) | None | Read-only anonymous access. |

---

### Enforcement Mechanism
* Enforced via client-side `ProtectedRoute.tsx` wrapper and server-side PostgreSQL RLS policies in `schema.sql`. Unauthorized access redirects immediately to an explicit Access Denied screen.
