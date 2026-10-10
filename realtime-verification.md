# Supabase Realtime Verification Document — Phase 02 Final
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document verifies the activation and change data capture (CDC) subscription configuration for realtime updates on Supabase.

---

### Realtime Publication Registry

| Publication Name | Subscribed Tables | Events Listened | Status |
| :--- | :--- | :---: | :---: |
| **`supabase_realtime`** | `production_orders` | `INSERT`, `UPDATE`, `DELETE` | **ACTIVE & PASS** |
| **`supabase_realtime`** | `production_batches` | `INSERT`, `UPDATE`, `DELETE` | **ACTIVE & PASS** |
| **`supabase_realtime`** | `serial_numbers` | `INSERT`, `UPDATE`, `DELETE` | **ACTIVE & PASS** |
| **`supabase_realtime`** | `service_cases` | `INSERT`, `UPDATE`, `DELETE` | **ACTIVE & PASS** |
| **`supabase_realtime`** | `replacement_requests` (`replacements`) | `INSERT`, `UPDATE`, `DELETE` | **ACTIVE & PASS** |

---

### Enrolment Script

```sql
alter publication supabase_realtime add table production_orders;
alter publication supabase_realtime add table production_batches;
alter publication supabase_realtime add table serial_numbers;
alter publication supabase_realtime add table service_cases;
alter publication supabase_realtime add table replacement_requests;
```

---

### Final Result
**PASS — Realtime Verification Complete**
