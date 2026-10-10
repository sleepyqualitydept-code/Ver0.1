# Application Architecture — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

**Reference**: Sleepee Single Source of Truth v1.0  
**Architecture Style**: Single Workspace Enterprise Application (Desktop First, Arabic RTL First)

---

### 1. System Overview
The Sleepee Platform is an enterprise single-workspace application designed for the Arabian Spring & Foam Mattresses Mfg. Company LTD. It integrates factory planning, batch execution, thermal printing, serialization, consumer warranty registration, customer service 360, compensation management, audit logging, and public verification into a cohesive Supabase PostgreSQL backed architecture.

### 2. Module Boundaries
Modules are strictly partitioned to ensure single-responsibility and data ownership:
* **Master Data**: Owns Categories, Brands, Models, Sizes, and Product Types.
* **Production**: Owns Production Orders, Order Lines, Batches, and Monitoring.
* **Serialization**: Owns Unique Barcode Generation (`SLP-YYYY-XXXXXXXX`) and Serial Lifecycle States.
* **Printing Center & Label Designer**: Owns Zebra ZD220 print queues, thermal jobs, and drag-and-drop label templates.
* **Warranty Center**: Owns Warranty Policies (Category ➔ Brand ➔ Model hierarchy) and Consumer Activations.
* **Customer Service 360**: Owns Customer records, Support Tickets, Notes, and Timelines.
* **Replacement Center**: Owns Replacement Requests, Approvals, and traceability linkage.
* **Reports Center**: Owns analytical reports and data exports across all domains.
* **Administration Center**: Owns User Profiles, Role Assignments, System Settings, and Audit Logs.
* **Public Warranty Portal**: Owns anonymous, read-only barcode verification.

### 3. Route Tree
* `/dashboard` — Operational Dashboard Home
* `/master-data` — Product Master Data Center (Categories, Brands, Models, Sizes, Product Types)
* `/production` — Manufacturing Execution & Planning Board
* `/serialization` — Barcode Generation, Lifecycle, and Search
* `/printing` — Thermal Print Queue, Jobs, and History
* `/label-designer` — Template Library & Visual Label Canvas
* `/warranty` — Warranty Policies, Activations, and Search
* `/customer-service` — Customer 360, Cases, and Timeline
* `/replacement` — Replacement Requests and Tracking
* `/reports` — Analytical Reports & Export Desk
* `/admin` — System Governance, Users, Roles, Audit Logs
* `/verify` — Public Warranty Verification Portal (Anonymous)

### 4. Authentication & Authorization Flow
* **Authentication**: Supabase Auth (Email/Password) with real-time profile resolution.
* **Authorization**: Hardened `get_current_user_role()` PostgreSQL function and client-side `ProtectedRoute` component validating against the 7 approved roles. Unauthorized access triggers an explicit Access Denied state.

### 5. Global Search Flow
* Unified alphanumeric search query dispatched via Supabase RPC `global_search(p_query)` spanning Customer phone/national ID, Serial Barcode, Service Case Number, and Warranty Invoice Number with 1-click navigation.

### 6. State Ownership Rules
* Server-side database state is the single source of truth. Real-time Change Data Capture (CDC) via Supabase realtime channels ensures multi-user workspace synchronization.
