# Schema Deployment Report — Phase 06 (Updated)
## Sleepee Manufacturing, Warranty & Customer Service Platform

> **IMPORTANT ARCHITECTURAL NOTICE**:
> The live Supabase PostgreSQL database environment is the runtime source of truth.
> This repository document is historical/reference documentation.
> The active production `generate_serials` RPC signature in Supabase is:
> **`generate_serials(p_batch_id uuid, p_qty integer)`**

---

### Physical Deployment Object Counts

| Object Category | Expected Count | Deployed Count | Execution Status | Validation Result |
| :--- | :---: | :---: | :---: | :---: |
| **Tables Created** | **26** | **26** | Executed cleanly | **PASS** |
| **Views Created** | **8** | **8** | Executed cleanly | **PASS** |
| **Functions (RPC) Created** | **8** | **8** | Executed cleanly | **PASS** |
| **Triggers Created** | **1** | **1** | Executed cleanly | **PASS** |
| **Policies Created (RLS)** | **32** | **32** | Executed cleanly | **PASS** |
| **Indexes Created** | **9** | **9** | Executed cleanly | **PASS** |

---

### Deployment Execution Checklist

1. **Live Authority**: Live Supabase PostgreSQL database is authoritative.
2. **Phase 06 RPC Contract**: Active `generate_serials` RPC takes `(p_batch_id uuid, p_qty integer)`. Model resolution and `production_date` population are handled inside PostgreSQL.
3. **Syntax Analysis**: Zero syntax errors detected.
4. **Dependency Sequence**: Entities initialized in topological order.
5. **Constraints Resolution**: All foreign keys, unique constraints (`serial_number`), and regex check constraints compiled without conflicts.
6. **RLS Activation**: All physical tables enabled with `ROW LEVEL SECURITY`.
7. **UUID Function**: Built-in `gen_random_uuid()` used for UUID generation across all active table schemas and functions.

---

### Final Result
**PASS — Deployment Verified against Live Supabase Database**
