SLEEPEE SINGLE SOURCE OF TRUTH v1.0
PORTABLE PROJECT REFERENCE AND DEVELOPMENT GOVERNANCE

Canonical reference name: Sleepee_Single_Source_Of_Truth_v1.0
Official project: Sleepee Manufacturing, Warranty & Customer Service Platform

IMPORTANT USE INSTRUCTION
This document is intended to be uploaded or pasted into a new ChatGPT conversation or AI Builder before requesting any project development, ZIP review, code changes, database changes, or implementation work.

AUTHORITY ORDER
1. The original MASTER REFERENCE SPECIFICATION VERSION 1.0 reproduced in SECTION A below is the official business source of truth. Preserve its business data, names, rules, and workflows.
2. The mandatory technology and scope restrictions in SECTION B govern implementation.
3. Existing project source code and ZIP files are evidence to inspect, not authority to override the specification.
4. Previously generated phase documents are derived drafts. If they conflict with the original specification, do not silently choose or invent a resolution. Report the conflict and preserve the original specification until the project owner explicitly approves a change.

MANDATORY WORKING RULES
- Do not remove requirements.
- Do not rename entities, brands, models, categories, roles, workflows, warranty rules, serialization rules, or number formats defined by the authoritative specification.
- Do not add business rules, records, fields, statuses, roles, modules, or assumptions that are not supported by the reference or explicitly approved by the project owner.
- If a required technical detail is missing, mark it as BLOCKED / SPECIFICATION GAP and explain exactly what decision or source is missing. Do not disguise missing information with invented values or pretend the implementation is complete.
- Never claim a feature, test, deployment, table, view, RPC, RLS policy, bucket, or certification exists unless it has been verified in the supplied files or live target environment. Distinguish CODE-VERIFIED, DATABASE-VERIFIED, LIVE-VERIFIED, and NOT VERIFIED.
- Review each supplied ZIP by inspecting its actual contents. Do not base certification only on the uploader's summary.
- Preserve existing work where compliant. Make the smallest necessary changes, and provide a gap report before destructive or architecture-changing work.
- Never enable Firebase/Firestore or another backend as a shortcut. If an AI Builder proposes it, reject that proposal and use Supabase only.

TECHNOLOGY FREEZE
Frontend: React + TypeScript + Vite.
Backend platform: Supabase only.
Database: Supabase PostgreSQL.
Authentication: Supabase Auth.
Authorization: Supabase RLS.
Storage: Supabase Storage.
Business logic/API: Supabase Client + Supabase RPC.
Realtime: Supabase Realtime.
Deployment target: Web application.
UI priority: Desktop first; Arabic RTL first; English second.

FORBIDDEN
Firebase, Firestore, MongoDB, MySQL, SQLite, Airtable, LocalStorage as a database, JSON database, IndexedDB as primary storage, mock/fake/demo data, fallback/static arrays as a data source, in-memory repositories, or any backend/database other than the approved Supabase stack.

PROJECT SCOPE EXCLUSIONS
Do not add ERP, CRM, Accounting, HR, Payroll, Purchasing, Warehouse ERP, Vendor Portal, POS, or E-Commerce.

ZIP / SOURCE CODE REVIEW PROTOCOL
When a ZIP, source-code package, schema, or deployment package is supplied:
1. Inventory the actual files and identify the app entry points, package configuration, environment-variable examples, SQL schema/migrations, RPCs, views, triggers, RLS policies, storage setup, and verification documents.
2. Compare actual implementation against this reference and the requested phase.
3. Check for forbidden technologies and mock/static data.
4. Check business names, catalogs, number formats, workflows, role names, and public portal rules.
5. Check database consistency: tables, columns, types, PK/FK, unique/check constraints, indexes, soft-delete/history, audit logging, and traceability. Do not infer deployed database state from SQL files alone.
6. Check Supabase Auth, RLS, RPC, Storage, and Realtime individually.
7. Run available build, TypeScript, lint, and tests when the environment permits; report commands and actual results.
8. Produce a compliance matrix with PASS / FAIL / PARTIAL / NOT VERIFIED, evidence paths, exact violations, risks, and minimal corrective actions.
9. Do not label a phase CERTIFIED or production-ready while required checks remain failed or unverified.
10. Do not make architecture changes or destructive edits without explicit approval.

REQUIRED REVIEW REPORT FORMAT
- Reference used
- ZIP/package inspected
- Phase under review
- Verified evidence (file paths and relevant symbols)
- Compliance matrix: PASS / FAIL / PARTIAL / NOT VERIFIED
- Missing requirements and conflicts
- Forbidden technology/data findings
- Build/test results (only those actually run)
- Minimal remediation plan
- Final status: APPROVED, PARTIALLY COMPLIANT, REJECTED, or BLOCKED

IMPORTANT DATABASE RULE
The intended database source of truth is the Supabase PostgreSQL schema. However, this document does not authorize inventing missing physical database details. A schema file proves what is written in that file; it does not by itself prove that the schema is deployed or working in a live Supabase project.

==================================================
SECTION A — ORIGINAL MASTER REFERENCE SPECIFICATION VERSION 1.0
==================================================
The text below is reproduced from the supplied original reference. Preserve its business content and terminology.

MASTER REFERENCE SPECIFICATION
ARCHITECTURE FREEZE
VERSION 1.0

==================================================
PROJECT IDENTITY
==================================================

Project Name:
Sleepee Manufacturing, Warranty & Customer Service Platform

Purpose:

Unified platform for:

- Production Management
- Serialization
- Printing
- Warranty Management
- Warranty Verification
- Customer Service 360
- Replacement Management
- Reports
- Administration

This is NOT:

- ERP
- CRM
- Accounting System
- HR System
- Purchasing System
- Warehouse ERP
- Vendor Portal
- POS
- E-Commerce

==================================================
COMPANY INFORMATION
==================================================

Arabic Legal Name:

الشركة العربية لصناعة مراتب السوست والإسفنج

English Legal Name:

Arabian Spring & Foam Mattresses Mfg. Company LTD

Brand:

Sleepee

Address:

6th October City
Industrial Zone 2
Daewoo Street
Plot 145-146

Hotline:

19707

Email:

Online@sleephigh.com

Website:

https://sleephigh.com/ar

==================================================
LANGUAGES
==================================================

Primary:

Arabic RTL

Secondary:

English

==================================================
DESIGN LANGUAGE
==================================================

Apple Glass White

Desktop First

Premium Manufacturing Experience

Modern Industrial UI

Single Workspace Philosophy

No unnecessary tabs

No duplicate screens

No ERP complexity

==================================================
DATABASE STRATEGY
==================================================

Database First

Platform:

Supabase PostgreSQL

Single Source Of Truth

Strict Rules:

No LocalStorage Database

No JSON Database

No Mock Data

No Fake Data

No Demo Records

No Fallback Arrays

==================================================
STORAGE BUCKETS
==================================================

labels

service

warranty

==================================================
USER ROLES
==================================================

Administrator

Production Manager

Production Operator

Printing Operator

Customer Service User

Warranty Manager

Read Only User

==================================================
PRODUCT CATALOG
==================================================

Categories:

1. Mattresses
2. Pillows
3. Cushions
4. Protective Covers
5. Accessories
6. Beds

==================================================
BRANDS
==================================================

Sleepee

Comfort

SH

Rebound Memory

Rich House

Emareties

متخصص

==================================================
BRAND RULES
==================================================

Sleepee:
Primary Brand

Comfort:
Independent Brand

SH:
Independent Brand

Rebound Memory:
Independent Brand

Rich House:
Independent Brand

Emareties:
Separate Brand

Uses Sleepee models as base models

Differences:

- Branding
- Packaging
- Handles
- Product identity details

متخصص:

Not a traditional brand.

Used for:

- Hotel Projects
- Institutional Projects
- Government Projects
- Custom Projects
- Contract Manufacturing

==================================================
SLEEPEE MODELS
==================================================

سيلفر 24 سم

جامبو 25 سم هارد

جولد سليبي 25 سم أمريكي

كمفورت 28 سم

فورسيزون 30 سم

انفينتي 32 سم

سليبي توب 34 سم

بوكيت ميرا 25 سم

بوكيت ريجنسي بيلو توب 30 سم

بوكيت ميموري سليبي 33 سم

بوكيت ليكزيس 33 سم

كلاسيك ألماني 25 سم

نيو كلاسيك 26 سم

ريلاكس 28 سم

رومانس 33 سم

ميديكال 18 سم

ميديكال 20 سم

ميديكال 22 سم

ميديكال 25 سم

ميديكال 30 سم

ميديكال 35 سم

نيو ميديكال 25

نيو ميديكال 30

فوما 100

مخدة 100 سم

خدادية 60×70

ملتون 100 سم

==================================================
COMFORT MODELS
==================================================

فاسينيشن 33 ألماني

ترانكواليتي 30 ألماني

كادل 29 ألماني

انوايند لاتكس طبيعي 30 ألماني

انوايند

==================================================
SH MODELS
==================================================

Kidstrong

Total Support

Superstrong

Rrstcalm

Durafirm

Essential

Sensa

Smartcool

Cooltech

Delight

Joy

==================================================
REBOUND MEMORY MODELS
==================================================

ريبوند ميموري 25

ريبوند ميموري 30

==================================================
RICH HOUSE MODELS
==================================================

ميديكال 20 سم

ميديكال 25 سم

ميديكال 30 سم

تيوليب

جولد

سيلفر

==================================================
EMARETIES MODELS
==================================================

Uses approved Sleepee models.

No duplicated model catalog.

Reference Source:

Sleepee Models

==================================================
STANDARD MATTRESS SIZES
==================================================

90×190
90×195
90×200

100×190
100×195
100×200

110×190
110×195
110×200

120×190
120×195
120×200

130×190
130×195
130×200

140×190
140×195
140×200

150×190
150×195
150×200

160×190
160×195
160×200

170×190
170×195
170×200

180×190
180×195
180×200

190×190
190×195
190×200

200×190
200×195
200×200

==================================================
PILLOW SIZES
==================================================

Default:

100×200

Custom Sizes Allowed

==================================================
CUSHION SIZES
==================================================

Default:

70×50

Custom Sizes Allowed

==================================================
PRODUCT TYPES
==================================================

STANDARD PRODUCT

Fields:

Category

Brand

Model

Standard Size

CUSTOM PRODUCT

Fields:

Width

Length

Height

Notes

PROJECT PRODUCT

Fields:

Project Name

Customer

Reference

Specifications

==================================================
MASTER DATA GOVERNANCE
==================================================

Product = Model

Single Source Of Truth

Model belongs to one Brand only

Model cannot belong to multiple brands

Emareties references Sleepee models

Master Data controlled by Administration

==================================================
SALES CHANNELS
==================================================

Factory

Branch

Dealer

Distributor

Showroom

==================================================
PRODUCTION WORKSPACE
==================================================

Single Workspace

No Tabs

No Separate Modules

Functions:

Production Planning

Production Orders

Production Batches

Serialization

Label Design

Printing

Monitoring

Approvals

All interactions through:

Modal

Drawer

Popup

==================================================
PLANNING GRID
==================================================

Excel Style

Unlimited Rows

Columns:

Type

Category

Brand

Model

Size

Quantity

Notes

==================================================
PRODUCTION ORDER WORKFLOW
==================================================

Draft

↓

Planned

↓

Approved

↓

In Production

↓

Partially Completed

↓

Completed

↓

Cancelled

Rules:

Can Edit

Can Cancel

Can Convert Partially

Can Convert Fully

==================================================
BATCH WORKFLOW
==================================================

Created

↓

Serialized

↓

Printed

↓

Completed

==================================================
SERIAL WORKFLOW
==================================================

Generated

↓

Printed

↓

Sold

↓

Activated

↓

Service

↓

Replacement

↓

Closed

==================================================
SERIAL RULES
==================================================

Global Unique

Never Reused

Never Reset

Searchable Anywhere

Full Traceability

Each Serial Keeps:

Production History

Batch History

Print History

Warranty History

Service History

Replacement History

==================================================
NUMBER FORMATS
==================================================

Production Order:

ORD-YYYY-XXXXXX

Batch:

BAT-YYYY-XXXXXX

Serial:

SLP-YYYY-XXXXXXXX

==================================================
WARRANTY POLICY HIERARCHY
==================================================

Category Default

↓

Brand Override

↓

Model Override

==================================================
WARRANTY DURATION
==================================================

Dynamic

1 Year

2 Years

3 Years

4 Years

5 Years

6 Years

7 Years

8 Years

9 Years

10 Years

11 Years

12 Years

13 Years

14 Years

15 Years

==================================================
WARRANTY START DATE
==================================================

Consumer Invoice Date

NOT Distributor Invoice

NOT Internal Transfer Date

==================================================
WARRANTY ACTIVATION
==================================================

Can Be Activated By:

Customer

Customer Service

Administrator

==================================================
INVOICE RULES
==================================================

Multiple Serials Allowed

Single Invoice Can Include:

1 Product

Or

Many Products

==================================================
MISSING INVOICE POLICY
==================================================

Customer Service Review

Warranty Certificate Review

Product Verification

Phone Verification

WhatsApp Verification

Manual Approval

==================================================
CUSTOMER SERVICE 360
==================================================

Single Workspace

Customer

Product

Warranty

Service Cases

Maintenance Cases

Replacement Cases

Attachments

Notes

Timeline

Audit History

==================================================
CUSTOMER DATA
==================================================

Name

Phone

Alternative Phone

Governorate

City

Address

National ID

Invoice Number

Invoice Date

==================================================
SERVICE CASE TYPES
==================================================

Inquiry

Complaint

Warranty

Maintenance

Replacement

Follow-Up

Other

==================================================
SERVICE CASE WORKFLOW
==================================================

Open

↓

Assigned

↓

In Progress

↓

Resolved

↓

Closed

==================================================
REPLACEMENT WORKFLOW
==================================================

Requested

↓

Under Review

↓

Approved

↓

Replacement Issued

↓

Completed

==================================================
REPLACEMENT RULES
==================================================

Keep Original Serial

Keep Original Warranty History

Keep Original Service History

Keep Original Customer History

Maintain Full Traceability

==================================================
PRINTING CENTER
==================================================

Supported Printer:

Zebra ZD220

==================================================
LABEL SIZES
==================================================

100×50 mm

100×100 mm

==================================================
LABEL DESIGNER
==================================================

Full Drag & Drop

Live Preview

Elements:

Logo

QR

Barcode

Brand

Model

Size

Warranty

Serial

Batch

Production Date

==================================================
LABEL TEMPLATE STRATEGY
==================================================

Template Per Category

Mattress Template

Pillow Template

Cushion Template

Protective Cover Template

Accessory Template

==================================================
PUBLIC WARRANTY PORTAL
==================================================

Public Read Only

Search Methods:

Serial Search

QR Search

Barcode Search

Future:

Voice Search

Image Upload Search

==================================================
GLOBAL SEARCH
==================================================

Search By:

Serial

Batch

Production Order

Customer

Phone

Invoice

Warranty

Service Case

==================================================
DASHBOARD KPIs
==================================================

Production Orders

Open Orders

Completed Orders

Generated Serials

Activated Warranties

Open Service Cases

Pending Replacements

==================================================
REPORTING
==================================================

Production Reports

Warranty Reports

Service Reports

Replacement Reports

Printing Reports

Management Reports

==================================================
DATABASE REQUIREMENTS
==================================================

Foreign Keys Required

Indexes Required

Unique Constraints Required

Check Constraints Required

Audit Logging Required

Soft Delete Required

Historical Preservation Required

Serial Traceability Required

Warranty Traceability Required

Replacement Traceability Required

==================================================
SUPABASE REQUIREMENTS
==================================================

Supabase Auth

Supabase Storage

Supabase RLS

Supabase RPC

Supabase Realtime

Typed Database Layer

==================================================
ARCHITECTURE STATUS
==================================================

Architecture Frozen

Ready For Database Design

Ready For Supabase Design

Ready For UI Architecture

Ready For Implementation

This document is the official single source of truth for the project.

==================================================
SECTION B — PROJECT HANDOFF / FIRST MESSAGE FOR A NEW CHAT
==================================================

You are assisting with the existing project “Sleepee Manufacturing, Warranty & Customer Service Platform.” Use this file, named Sleepee_Single_Source_Of_Truth_v1.0, as the canonical project reference. First read the complete reference before proposing changes. The original specification in Section A is authoritative. Do not treat earlier AI-generated blueprints or claims of phase certification as proof that implementation exists.

For any supplied ZIP, inspect the actual files and compare them with this reference. Do not start by rebuilding the project from scratch. First report the actual state, compliance gaps, conflicts, and test evidence. Preserve compliant work and propose minimal corrections. Never use Firebase/Firestore; the stack is React, TypeScript, Vite, and Supabase PostgreSQL/Auth/Storage/RLS/RPC/Realtime only. Do not invent missing business data or rules. If information is absent or conflicting, report a specification gap and stop that dependent decision until clarified.

Do not change the original reference itself. If a change is explicitly approved by the project owner, record it as a separately versioned amendment and explain its impact.
