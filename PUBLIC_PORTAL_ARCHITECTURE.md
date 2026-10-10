# Public Portal Architecture — Phase 03
## Sleepee Manufacturing, Warranty & Customer Service Platform

This document outlines the architecture and security boundaries of the Public Warranty Verification Portal (`/verify`).

---

### 1. Purpose & Access Model
* **Route**: `/verify`
* **Access Level**: Anonymous / Public (No authentication required)
* **Mode**: Read-Only

### 2. Search Methods
Consumers and retail partners can verify product authenticity using:
* Serial Barcode (`SLP-YYYY-XXXXXXXX`)
* QR Code scan
* Linear Barcode scanner

### 3. Result Information Displayed
* Product Brand & Model Name
* Mattress / Product Dimensions
* Warranty Duration & Status (`ACTIVE & VALID` or `EXPIRED`)
* Activation Date & Invoice Reference Number

### 4. Security Boundaries
* Read-only RPC query execution restricted strictly to public serial verification fields.
* Zero exposure of internal customer personally identifiable information (PII) such as national ID numbers or alternative phone contacts.
