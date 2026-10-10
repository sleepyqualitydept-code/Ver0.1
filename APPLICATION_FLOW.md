# Application Flow Diagram — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document maps the end-to-end operational lifecycle flow in strict compliance with the Sleepee Single Source of Truth v1.0.

---

### Operational Lifecycle Flowchart

```
[Master Data Center]
  (Categories, Brands, Models, Sizes, Product Types)
       │
       ▼
[Production Center]
  (Planning Grid ➔ Production Order ➔ Approval ➔ Batch Creation)
       │
       ▼
[Serialization Engine]
  (Barcode Generation: SLP-YYYY-XXXXXXXX)
       │
       ▼
[Printing Center & Label Designer]
  (Zebra ZD220 Print Queue & Thermal Labels)
       │
       ▼
[Retail Sale]
  (Consumer Purchase & Invoice Issuance)
       │
       ▼
[Warranty Center]
  (Warranty Activation & Policy Hierarchy Verification)
       │
       ▼
[Customer Service 360]
  (Support Ticket Intake, Case Assignment & Resolution)
       │
       ▼
[Replacement Center]
  (Claim Review, Board Approval & Replacement Issuance)
       │
       ▼
[Closure & Audit Logging]
  (Permanent Traceability Archive in audit_logs)
```

---

### Key Workflow Invariants
1. **Traceability Retention**: Every replacement or service case retains the original serial number and lifecycle history.
2. **Audit Trail**: Every state change writes immutable JSON records to `audit_logs`.
