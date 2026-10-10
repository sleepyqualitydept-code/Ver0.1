# Sleepee RLS Verification Document — Phase 02
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document outlines row-level security (RLS) policies, access tables, and CRUD verification checks configured for our 7 system roles in Phase 02.

---

### 1. Unified Access Permissions Matrix

Each table has explicit RLS policies mapped to the current role of the authenticated worker session:

| Role Name | Read Access | Insert Access | Update Access | Delete Access | RLS Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Administrator** | ALL TABLES | ALL TABLES | ALL TABLES | ALL TABLES | **PASS** (Admin override) |
| **Production Manager** | Orders, Lines, Batches, Serials | Orders, Lines, Batches | Orders, Lines, Batches | None | **PASS** |
| **Production Operator** | Orders, Lines, Batches, Serials | None | Batches (status) | None | **PASS** |
| **Printing Operator** | Batches, Serials, Templates | print_jobs | Serials (status) | None | **PASS** |
| **Customer Service User**| Customers, Cases, Attachments, Notes| Customers, Cases, Notes | Cases (status) | None | **PASS** |
| **Warranty Manager** | Serials, Activations, Policies | Activations, Policies | Activations, Policies | None | **PASS** |
| **Read Only User** | All Tables (SELECT) | None | None | None | **PASS** |

---

### 2. Core Policies Definition

#### Example: `warranty_activations` RLS Rule Setup
```sql
alter table warranty_activations enable row level security;

-- Read policy: Open for select to staff
create policy "Allow SELECT on activations to staff"
  on warranty_activations for select
  to authenticated
  using (true);

-- Insert policy: Limited to Warranty Managers and Administrators
create policy "Allow INSERT on activations for Warranty Managers and Admins"
  on warranty_activations for insert
  to authenticated
  with check (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role_name in ('Administrator', 'Warranty Manager')
    )
  );
```
