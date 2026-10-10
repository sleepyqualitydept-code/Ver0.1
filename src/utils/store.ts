/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ==================================================
// PHASE 02 RELATIONAL SCHEMA TYPE DEFINITIONS
// ==================================================

export interface Category {
  id: string; // UUID
  nameAr: string; // Compatibility
  nameEn: string; // Compatibility
  name_ar?: string;
  name_en?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Brand {
  id: string; // UUID
  nameAr: string; // Compatibility
  nameEn: string; // Compatibility
  name_ar?: string;
  name_en?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface ProductModel {
  id: string; // UUID
  brandId: string; // Compatibility
  category: string; // Compatibility
  name: string; // Compatibility
  brand_id?: string;
  category_id?: string;
  name_ar?: string;
  name_en?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface MattressSize {
  id: string; // UUID
  width_cm: number;
  length_cm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductType {
  id: string; // UUID
  code: string;
  name_ar: string;
  name_en: string;
  created_at: string;
}

export interface Customer {
  id: string; // UUID
  fullName: string; // Compatibility
  phone: string;
  alternativePhone: string; // Compatibility
  governorate: string;
  city: string;
  address: string;
  nationalId: string; // Compatibility
  full_name?: string;
  alternative_phone?: string | null;
  national_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface ProductionOrder {
  id: string; // UUID
  type: 'standard' | 'custom' | 'project';
  category: string;
  brandId: string;
  modelId: string;
  size: string;
  quantity: number;
  notes: string;
  status: 'draft' | 'planned' | 'approved' | 'in_production' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;

  order_number?: string;
  orderNumber?: string; // Compatibility
  created_by?: string;
  approved_by?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  
  // Optional custom Product details
  customWidth?: number;
  customLength?: number;
  customHeight?: number;
  
  // Optional project Product details
  projectName?: string;
  clientName?: string;
  referenceId?: string;
  specs?: string;
}

export interface ProductionOrderLine {
  id: string; // UUID
  production_order_id: string;
  product_type_id: string;
  category_id: string;
  brand_id: string;
  model_id: string;
  width_cm: number;
  length_cm: number;
  height_cm: number;
  quantity: number;
  notes?: string | null;
}

export interface ProductionBatch {
  id: string; // UUID
  batchNumber: string; // Compatibility
  orderId: string; // Compatibility
  status: 'created' | 'serialized' | 'printed' | 'completed';
  quantity: number; // Compatibility
  createdAt: string; // Compatibility
  batch_number?: string;
  production_order_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Serial {
  id: string; // UUID or Alphanumeric
  serialNumber: string; // Compatibility
  batchId: string; // Compatibility
  modelId: string; // Compatibility
  status: 'generated' | 'printed' | 'sold' | 'activated' | 'service' | 'replacement' | 'closed';
  createdAt: string; // Compatibility
  orderId: string;
  brandId: string;
  category: string;
  size: string;
  warrantyActive: boolean;
  warrantyStart: string;
  warrantyEnd: string;
  warrantyDurationYears: number;
  customerName: string;
  customerPhone: string;
  customerAltPhone: string;
  customerNationalId: string;
  customerGovernorate: string;
  customerCity: string;
  customerAddress: string;
  invoiceNo: string;
  invoiceDate: string;
  activationSource: string;

  serial_number?: string;
  batch_id?: string;
  model_id?: string;
  production_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SerialHistory {
  id: string; // UUID
  serial_id: string;
  event_type: 'generated' | 'printed' | 'shipped' | 'sold' | 'activated' | 'support_opened' | 'replaced' | 'closed';
  event_date: string;
  notes: string;
  created_by: string;
}

export interface LabelElement {
  id: string;
  type: 'logo' | 'qr' | 'barcode' | 'model' | 'brand' | 'size' | 'warranty' | 'serial' | 'batch' | 'date';
  x: number; // percentage values for canvas (0-100)
  y: number;
  fontSize: number;
  visible: boolean;
}

export interface LabelTemplate {
  id: string; // UUID
  category: string; // Compatibility
  size: '100x50' | '100x100'; // Compatibility
  elements: LabelElement[]; // Compatibility
  name?: string;
  category_id?: string;
  label_width?: number;
  label_height?: number;
  template_json?: {
    elements: LabelElement[];
  };
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PrintJob {
  id: string; // UUID
  template_id: string;
  printer_name: string;
  copies: number;
  created_by: string;
  created_at: string;
}

export interface PrintHistory {
  id: string; // UUID
  print_job_id: string;
  serial_id: string;
  printed_at: string;
}

export interface WarrantyPolicy {
  id: string; // UUID
  targetType: 'category' | 'brand' | 'model'; // Compatibility
  targetId: string; // Compatibility
  durationYears: number; // Compatibility
  level_type?: 'category' | 'brand' | 'model';
  category_id?: string;
  brand_id?: string;
  model_id?: string;
  duration_years?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface WarrantyActivation {
  id: string; // UUID
  serial_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  activation_date: string;
  activated_by: string;
  created_at: string;
}

export interface ServiceCase {
  id: string; // UUID
  serialId: string; // Compatibility
  type: 'inquiry' | 'complaint' | 'warranty' | 'maintenance' | 'replacement' | 'followup' | 'other'; // Compatibility
  status: 'open' | 'assigned' | 'inprogress' | 'resolved' | 'closed';
  assignee: string; // Compatibility
  customerName: string;
  customerPhone: string;
  notes: string;
  createdAt: string;
  timeline: {
    id: string;
    note: string;
    actor: string;
    timestamp: string;
  }[];

  case_number?: string;
  caseNumber?: string; // Compatibility
  case_type?: 'inquiry' | 'complaint' | 'warranty' | 'maintenance' | 'replacement' | 'followup' | 'other';
  customer_id?: string;
  customerId?: string;
  serial_id?: string;
  subject?: string;
  description?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceCaseNote {
  id: string; // UUID
  service_case_id: string;
  note_text: string;
  created_by: string;
  created_at: string;
}

export interface ServiceAttachment {
  id: string; // UUID
  service_case_id: string;
  file_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ReplacementCase {
  id: string; // UUID
  caseId: string;
  originalSerialId: string;
  status: 'requested' | 'under_review' | 'approved' | 'issued' | 'completed' | 'denied';
  reason: string;
  createdAt: string;

  request_number?: string;
  customer_id?: string;
  customerId?: string;
  serial_id?: string;
  created_at?: string;
  updated_at?: string;
  newSerialId?: string;
  reviewedBy?: string;
  approvedAt?: string;
}

export interface ReplacementHistory {
  id: string; // UUID
  replacement_request_id: string;
  event_type: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string; // UUID
  actor: string;
  action: string;
  details: string;
  timestamp: string;

  table_name?: string;
  record_id?: string;
  action_type?: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any | null;
  new_data?: any | null;
  performed_by?: string;
  created_at?: string;
}
