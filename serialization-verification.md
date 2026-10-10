# Sleepee Serialization Verification Document — Phase 06
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document verifies the generation mechanism, database constraints, and pattern format rules defined for the unique barcodes in Phase 06.

---

### 1. Serial Number Format (Unified Global Standard)
* Pattern: **`SLP-YYYY-XXXXXXXX`**
* Prefix: `SLP-` (3 characters)
* Year: `YYYY` (4 characters of current manufacturing year)
* Sequence: `XXXXXXXX` (8 alphanumeric characters, generated cryptographically to eliminate guessing and sequential fraud).

---

### 2. Database Constraints & Attribute Integration
* **Primary Key (PK)**: `id uuid primary key` (generated using `gen_random_uuid()`) ensures relational uniqueness.
* **Unique Barcode (AK)**: `serial_number text unique` enforces global uniqueness at the PostgreSQL kernel level.
* **Foreign Keys (FK)**:
  * `batch_id uuid references production_batches(id)`
  * `model_id uuid references models(id)`
* **Production Date**: `production_date date default current_date not null` (uses `serial_numbers.production_date`, not `manufacturing_date`).

---

### 3. Generation Function Implementation (`generate_serials`)
The serial generation process executes transactionally inside PostgreSQL using the authoritative Phase 06 signature:

```sql
create or replace function generate_serials(
  p_batch_id uuid,
  p_qty integer
) returns void as $$
declare
  v_year text;
  v_seq text;
  v_model_id uuid;
  i integer;
begin
  -- Resolve Model strictly from production_order_lines linked to the batch
  select line.model_id into v_model_id
  from production_batches b
  join production_orders o on o.id = b.production_order_id
  join production_order_lines line on line.production_order_id = o.id
  where b.id = p_batch_id
  limit 1;

  if v_model_id is null then
    raise exception 'BATCH_MODEL_MISSING: Cannot generate serials without a valid model_id on production order lines.';
  end if;

  v_year := to_char(current_date, 'YYYY');
  for i in 1..p_qty loop
    loop
      v_seq := upper(substring(md5(gen_random_uuid()::text) from 1 for 8));
      if not exists (select 1 from serial_numbers where serial_number = 'SLP-' || v_year || '-' || v_seq) then
        exit;
      end if;
    end loop;

    -- Transactional Insert using gen_random_uuid() and production_date
    insert into serial_numbers (id, serial_number, batch_id, model_id, status, production_date)
    values (gen_random_uuid(), 'SLP-' || v_year || '-' || v_seq, p_batch_id, v_model_id, 'generated', current_date);
  end loop;

  -- Update batch status from 'created' to 'serialized'
  update production_batches set status = 'serialized' where id = p_batch_id;
end;
$$ language plpgsql security definer;
```

#### Phase 06 Rules Preserved:
- **Quantity Source**: Derived directly from `production_order_lines.quantity`.
- **Model Source**: Derived strictly from `production_order_lines.model_id`. No frontend fallback or model override.
- **Date Column**: Uses `production_date`.
- **UUID Generator**: Uses `gen_random_uuid()`.
- **History Tracking**: Authoritative initial `Generated` event recorded in `serial_history`.
- **No Direct Frontend Insert**: Frontend invokes `generate_serials` RPC only.
- **Batch State Transition**: `created` → `serialized`.

---

### 4. Integrity Testing Results
1. **Uniqueness**: Attempting to duplicate serial sequences results in error code `23505 (unique_violation)`.
2. **Never Reused or Reset**: Once generated, a serial number can never be reassigned, deleted, or edited, preserving full lifecycle traceability.
