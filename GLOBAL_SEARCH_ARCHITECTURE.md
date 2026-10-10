# Global Search Architecture — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document details the unified alphanumeric search engine used across the Sleepee Platform.

---

### 1. Search Scope
The global search engine (`global_search` RPC function) indexes and searches across:
* **Serial Numbers** (`SLP-YYYY-XXXXXXXX`)
* **Production Orders** (`ORD-YYYY-XXXXXX`)
* **Production Batches** (`BAT-YYYY-XXXXXX`)
* **Customer Names & Phone Numbers** (`phone`, `national_id`)
* **Warranty Invoices** (`invoice_number`)
* **Service Cases** (`case_number`)
* **Replacement Requests** (`request_number`)

### 2. Execution Mechanism
Instead of client-side array filtering, global search executes a unified PostgreSQL `UNION ALL` query via Supabase RPC:
```sql
create or replace function global_search(p_query text)
returns table (
  match_type text,
  record_id uuid,
  display_text text,
  meta json
) as $$ ... $$;
```

### 3. User Experience
* Triggered globally via top navigation search button or `⌘K` shortcut.
* Presents categorized results in a modal overlay with one-click navigation directly to the target record screen.
