/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';
import { warrantyPoliciesApi, WarrantyPolicyRecord } from './warrantyPoliciesApi.ts';
import { serialNumbersApi } from './serialNumbersApi.ts';
import { auditLogsApi } from './auditLogsApi.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(val: string): boolean {
  return UUID_REGEX.test((val || '').trim());
}

export type WarrantyStatus = 'active' | 'expired';

export interface WarrantyActivationRecord {
  id: string;
  serial_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  activation_date: string;
  activated_by?: string | null;
  created_at: string;
  // Computed fields based on authoritative dates & policy
  duration_years: number;
  warranty_start_date: string;
  warranty_end_date: string;
  status: WarrantyStatus;
  days_remaining: number;
  // Joined relation objects
  serial_numbers?: any;
  customers?: any;
  profiles?: any;
  policy_hierarchy?: {
    resolvedLevel: string;
    policyDuration: number;
  };
}

export interface WarrantyHistoryRecord {
  id: string;
  serial_id: string;
  event_type: string;
  event_date: string;
  notes?: string | null;
  created_by?: string | null;
  serial_numbers?: any;
  profiles?: any;
  activation?: WarrantyActivationRecord | null;
}

const ACTIVATION_SELECT_QUERY = `
  *,
  serial_numbers (
    id,
    serial_number,
    status,
    production_date,
    batch_id,
    model_id,
    production_batches (
      id,
      batch_number,
      status,
      created_at,
      production_orders (
        id,
        order_number,
        status,
        created_at
      )
    ),
    models (
      id,
      name_ar,
      name_en,
      category_id,
      brand_id,
      brands (id, name_ar, name_en),
      categories (id, name_ar, name_en)
    )
  ),
  customers (
    id,
    full_name,
    phone,
    alternative_phone,
    national_id,
    governorate,
    city,
    address
  ),
  profiles:activated_by (
    id,
    full_name,
    email
  )
`;

const SERIAL_FULL_SELECT_QUERY = `
  *,
  production_batches (
    id,
    batch_number,
    status,
    created_at,
    production_orders (
      id,
      order_number,
      status,
      created_at
    )
  ),
  models (
    id,
    name_ar,
    name_en,
    category_id,
    brand_id,
    brands (id, name_ar, name_en),
    categories (id, name_ar, name_en)
  )
`;

export function calculateWarrantyEndDate(invoiceDateStr: string, durationYears: number): string {
  const parts = invoiceDateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10) + durationYears;
    const month = parts[1];
    const day = parts[2];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(invoiceDateStr);
  d.setFullYear(d.getFullYear() + durationYears);
  return d.toISOString().split('T')[0];
}

export function computeWarrantyStatus(endDateStr: string): { status: WarrantyStatus; daysRemaining: number } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(23, 59, 59, 999);

  const diffMs = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const status: WarrantyStatus = daysRemaining >= 0 ? 'active' : 'expired';

  return { status, daysRemaining };
}

/**
 * Enriches a raw PostgreSQL warranty_activations row using strict hierarchy policy resolution.
 * NO 10-year fallback is permitted.
 */
function enrichActivationRow(
  row: any,
  activePolicies: WarrantyPolicyRecord[]
): WarrantyActivationRecord {
  const modelId = row.serial_numbers?.models?.id || row.serial_numbers?.model_id;
  const brandId = row.serial_numbers?.models?.brand_id || row.serial_numbers?.models?.brands?.id;
  const categoryId = row.serial_numbers?.models?.category_id || row.serial_numbers?.models?.categories?.id;

  const storedDuration = Number(row.duration_years);
  const storedEndDate = typeof row.warranty_end_date === 'string' ? row.warranty_end_date : '';

  if (!Number.isInteger(storedDuration) || storedDuration < 1 || storedDuration > 15 || !storedEndDate) {
    throw new Error(`INVALID_WARRANTY_SNAPSHOT: Warranty activation ${row.id} is missing its immutable duration/end-date snapshot.`);
  }

  let resolvedLevel = 'historical';
  try {
    const policyRes = warrantyPoliciesApi.resolvePolicyFromList(activePolicies, {
      modelId,
      brandId,
      categoryId
    });
    resolvedLevel = policyRes.resolvedLevel;
  } catch {
    // Existing warranty remains authoritative even when its current policy is inactive or changed.
    resolvedLevel = 'historical';
  }

  const durationYears = storedDuration;
  const endDate = storedEndDate;
  const { status, daysRemaining } = computeWarrantyStatus(endDate);

  return {
    ...row,
    duration_years: durationYears,
    warranty_start_date: row.invoice_date,
    warranty_end_date: endDate,
    status,
    days_remaining: daysRemaining,
    policy_hierarchy: {
      resolvedLevel,
      policyDuration: durationYears
    }
  };
}

export const warrantyActivationsApi = {
  /**
   * Authoritative Serial Lookup by UUID or Serial Code (SLP-YYYY-XXXXXXXX).
   * Prevents PostgreSQL 22P02 UUID cast errors when querying by serial_number string.
   */
  async findSerialRecord(serialNumberOrId: string): Promise<any | null> {
    const clean = (serialNumberOrId || '').trim();
    if (!clean) return null;

    const client = getClient();
    let query = client.from('serial_numbers').select(SERIAL_FULL_SELECT_QUERY);

    if (isUuid(clean)) {
      query = query.eq('id', clean);
    } else {
      query = query.ilike('serial_number', clean);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async getAll(): Promise<WarrantyActivationRecord[]> {
    const client = getClient();
    const [{ data, error }, activePolicies] = await Promise.all([
      client
        .from('warranty_activations')
        .select(ACTIVATION_SELECT_QUERY)
        .order('activation_date', { ascending: false }),
      warrantyPoliciesApi.getAll()
    ]);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map(row => enrichActivationRow(row, activePolicies));
  },

  async getById(id: string): Promise<WarrantyActivationRecord | null> {
    const cleanId = (id || '').trim();
    if (!cleanId) return null;

    const { data, error } = await getClient()
      .from('warranty_activations')
      .select(ACTIVATION_SELECT_QUERY)
      .eq('id', cleanId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const modelId = data.serial_numbers?.models?.id || data.serial_numbers?.model_id;
    const brandId = data.serial_numbers?.models?.brand_id || data.serial_numbers?.models?.brands?.id;
    const categoryId = data.serial_numbers?.models?.category_id || data.serial_numbers?.models?.categories?.id;

    // Warranty duration/end-date are immutable activation snapshots stored by the atomic RPC.
    // Current policy changes must never recalculate an existing warranty.
    const storedDuration = Number(data.duration_years);
    const endDate = typeof data.warranty_end_date === 'string' ? data.warranty_end_date : '';

    if (!Number.isInteger(storedDuration) || storedDuration < 1 || storedDuration > 15 || !endDate) {
      throw new Error(`INVALID_WARRANTY_SNAPSHOT: Warranty activation ${data.id} is missing its immutable duration/end-date snapshot.`);
    }

    let resolvedLevel = 'historical';
    try {
      const policyRes = await warrantyPoliciesApi.resolvePolicy({ modelId, brandId, categoryId });
      resolvedLevel = policyRes.resolvedLevel;
    } catch {
      // Historical warranty remains readable even if its original policy is no longer active.
      resolvedLevel = 'historical';
    }

    const { status, daysRemaining } = computeWarrantyStatus(endDate);

    return {
      ...data,
      duration_years: storedDuration,
      warranty_start_date: data.invoice_date,
      warranty_end_date: endDate,
      status,
      days_remaining: daysRemaining,
      policy_hierarchy: {
        resolvedLevel,
        policyDuration: storedDuration
      }
    };
  },

  async getBySerial(serialNumberOrId: string): Promise<WarrantyActivationRecord | null> {
    const serial = await this.findSerialRecord(serialNumberOrId);
    if (!serial) return null;

    const { data: actRow, error } = await getClient()
      .from('warranty_activations')
      .select('id')
      .eq('serial_id', serial.id)
      .maybeSingle();

    if (error) throw error;
    if (!actRow) return null;

    return this.getById(actRow.id);
  },

  /**
   * Server-Side Warranty Search on PostgreSQL (Never uses getAll() + client-side filtering)
   */
  async search(filters: {
    query?: string;
    status?: 'active' | 'expired' | 'all';
    governorate?: string;
    brandId?: string;
    modelId?: string;
    categoryId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<WarrantyActivationRecord[]> {
    const client = getClient();
    let q = client.from('warranty_activations').select(ACTIVATION_SELECT_QUERY);

    // 1. Server-side date range filters
    if (filters.dateFrom && filters.dateFrom.trim()) {
      q = q.gte('invoice_date', filters.dateFrom.trim());
    }
    if (filters.dateTo && filters.dateTo.trim()) {
      q = q.lte('invoice_date', filters.dateTo.trim());
    }

    // 2. Server-side Governorate filter via PostgreSQL customers table
    if (filters.governorate && filters.governorate !== 'all') {
      const { data: govCustomers, error: govErr } = await client
        .from('customers')
        .select('id')
        .eq('governorate', filters.governorate);

      if (govErr) throw govErr;
      const govCustIds = (govCustomers || []).map((c: any) => c.id);
      if (govCustIds.length === 0) return [];
      q = q.in('customer_id', govCustIds);
    }

    // 3. Server-side Product Hierarchy filters (Category / Brand / Model) via PostgreSQL models & serial_numbers
    if (
      (filters.categoryId && filters.categoryId !== 'all') ||
      (filters.brandId && filters.brandId !== 'all') ||
      (filters.modelId && filters.modelId !== 'all')
    ) {
      let modelFilterIds: string[] = [];
      if (filters.modelId && filters.modelId !== 'all') {
        modelFilterIds = [filters.modelId];
      } else {
        let modelQuery = client.from('models').select('id');
        if (filters.categoryId && filters.categoryId !== 'all') {
          modelQuery = modelQuery.eq('category_id', filters.categoryId);
        }
        if (filters.brandId && filters.brandId !== 'all') {
          modelQuery = modelQuery.eq('brand_id', filters.brandId);
        }
        const { data: matchedModels, error: mErr } = await modelQuery;
        if (mErr) throw mErr;
        modelFilterIds = (matchedModels || []).map((m: any) => m.id);
        if (modelFilterIds.length === 0) return [];
      }

      const { data: matchedSerials, error: sErr } = await client
        .from('serial_numbers')
        .select('id')
        .in('model_id', modelFilterIds);

      if (sErr) throw sErr;
      const serialIds = (matchedSerials || []).map((s: any) => s.id);
      if (serialIds.length === 0) return [];
      q = q.in('serial_id', serialIds);
    }

    // 4. Server-side Text Query across Invoice, Serial, Batch, Order, Model, Brand, and Customer
    if (filters.query && filters.query.trim()) {
      const trimmed = filters.query.trim();
      const orConditions: string[] = [`invoice_number.ilike.%${trimmed}%`];

      // Match customers in PostgreSQL
      const { data: matchedCusts, error: custSearchErr } = await client
        .from('customers')
        .select('id')
        .or(
          `full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,alternative_phone.ilike.%${trimmed}%,national_id.ilike.%${trimmed}%`
        );
      if (custSearchErr) throw custSearchErr;
      const matchedCustIds = (matchedCusts || []).map((c: any) => c.id);
      if (matchedCustIds.length > 0) {
        orConditions.push(`customer_id.in.(${Array.from(new Set(matchedCustIds)).join(',')})`);
      }

      // Match serials in PostgreSQL (via serialNumbersApi.search which matches serial_number, batch, order, model)
      const matchedSerialRows = await serialNumbersApi.search({ query: trimmed });
      const matchedSerialIds = (matchedSerialRows || []).map((s: any) => s.id);

      // Also match brands by name -> models -> serials
      const { data: matchedBrands } = await client
        .from('brands')
        .select('id')
        .or(`name_ar.ilike.%${trimmed}%,name_en.ilike.%${trimmed}%`);
      if (matchedBrands && matchedBrands.length > 0) {
        const brandIds = matchedBrands.map((b: any) => b.id);
        const { data: brandModels } = await client
          .from('models')
          .select('id')
          .in('brand_id', brandIds);
        if (brandModels && brandModels.length > 0) {
          const bModelIds = brandModels.map((m: any) => m.id);
          const { data: brandSerials } = await client
            .from('serial_numbers')
            .select('id')
            .in('model_id', bModelIds);
          if (brandSerials) {
            matchedSerialIds.push(...brandSerials.map((s: any) => s.id));
          }
        }
      }

      const uniqueSerialIds = Array.from(new Set(matchedSerialIds));
      if (uniqueSerialIds.length > 0) {
        orConditions.push(`serial_id.in.(${uniqueSerialIds.join(',')})`);
      }

      q = q.or(orConditions.join(','));
    }

    const [{ data, error }, activePolicies] = await Promise.all([
      q.order('activation_date', { ascending: false }),
      warrantyPoliciesApi.getAll()
    ]);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const enriched = data.map(row => enrichActivationRow(row, activePolicies));

    // Filter by computed warranty expiration status if requested
    if (filters.status && filters.status !== 'all') {
      return enriched.filter(item => item.status === filters.status);
    }

    return enriched;
  },

  /**
   * Atomic Warranty Activation:
   * 1. Validate Serial (exists, valid, eligible status)
   * 2. Validate No Existing Active Warranty (Cannot activate twice)
   * 3. Validate Consumer Invoice Number & Consumer Invoice Date
   * 4. Resolve Warranty Policy strictly (Model -> Brand -> Category -> Reject)
   * 5. Resolve / Create Customer with full required fields (no fake fallbacks)
   * 6. Execute atomic activation in PostgreSQL (warranty_activations + serial_numbers + serial_history)
   */
  async activateWarranty(params: {
    serialNumberOrId: string;
    customerId?: string;
    newCustomer?: {
      full_name: string;
      phone: string;
      alternative_phone?: string;
      national_id: string;
      governorate: string;
      city: string;
      address: string;
    };
    invoiceNumber: string;
    invoiceDate: string;
  }): Promise<WarrantyActivationRecord> {
    const client = getClient();
    const cleanSerial = (params.serialNumberOrId || '').trim();

    if (!cleanSerial) {
      throw new Error('VALIDATION_ERROR: Serial Number is required.');
    }

    // 1. Validate Serial exists in PostgreSQL (safe UUID / serial_number lookup)
    const serial = await this.findSerialRecord(cleanSerial);
    if (!serial) {
      throw new Error(`SERIAL_NOT_FOUND: Serial Number "${cleanSerial}" is not registered in the production database.`);
    }

    if (serial.status === 'closed' || serial.status === 'replacement') {
      throw new Error(`SERIAL_NOT_ELIGIBLE: Serial Number ${serial.serial_number} has status "${serial.status}" and is not eligible for warranty activation.`);
    }

    // 2. Check for Duplicate Activation (Rule: Serial can have only ONE warranty activation)
    const { data: existingAct, error: dupErr } = await client
      .from('warranty_activations')
      .select('id, invoice_number, invoice_date, activation_date')
      .eq('serial_id', serial.id)
      .maybeSingle();

    if (dupErr) throw dupErr;

    if (existingAct) {
      throw new Error(
        `DUPLICATE_WARRANTY_ACTIVATION: Serial Number ${serial.serial_number} is already activated under invoice "${existingAct.invoice_number}" (Activated on ${new Date(existingAct.activation_date).toLocaleDateString()}). A serial cannot have duplicate warranties.`
      );
    }

    // 3. Validate Consumer Invoice Number & Consumer Invoice Date
    if (!params.invoiceNumber || !params.invoiceNumber.trim()) {
      throw new Error('VALIDATION_ERROR: Consumer Invoice Number is strictly required.');
    }

    if (!params.invoiceDate || !params.invoiceDate.trim()) {
      throw new Error('VALIDATION_ERROR: Consumer Invoice Date is required. Warranty cannot be activated without an authoritative invoice date.');
    }

    const invDate = new Date(params.invoiceDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (isNaN(invDate.getTime())) {
      throw new Error('VALIDATION_ERROR: Invalid invoice date format. Please provide a valid date (YYYY-MM-DD).');
    }
    if (invDate.getTime() > today.getTime()) {
      throw new Error('VALIDATION_ERROR: Consumer invoice date cannot be in the future.');
    }

    // 4. Validate customer reference or new customer object
    const hasExisting = Boolean(params.customerId?.trim());
    const hasNew = Boolean(params.newCustomer);
    if (!hasExisting && !hasNew) {
      throw new Error('VALIDATION_ERROR: Either customerId or newCustomer details must be provided.');
    }

    if (hasNew && params.newCustomer) {
      const nc = params.newCustomer;
      if (
        !nc.full_name?.trim() ||
        !nc.phone?.trim() ||
        !nc.national_id?.trim() ||
        !nc.governorate?.trim() ||
        !nc.city?.trim() ||
        !nc.address?.trim()
      ) {
        throw new Error(
          'VALIDATION_ERROR: Customer Full Name, Phone, National ID, Governorate, City, and Detailed Address are all required.'
        );
      }
    }

    // 5. Execute Atomic Warranty Activation exclusively via PostgreSQL RPC activate_warranty (No direct table INSERT fallback)
    const { data: activationId, error: rpcErr } = await client.rpc('activate_warranty', {
      p_serial_id: serial.id,
      p_customer_id: hasExisting ? params.customerId!.trim() : null,
      p_customer: hasNew && params.newCustomer ? {
        full_name: params.newCustomer.full_name.trim(),
        phone: params.newCustomer.phone.trim(),
        alternative_phone: params.newCustomer.alternative_phone?.trim() || null,
        national_id: params.newCustomer.national_id.trim(),
        governorate: params.newCustomer.governorate.trim(),
        city: params.newCustomer.city.trim(),
        address: params.newCustomer.address.trim()
      } : null,
      p_invoice_number: params.invoiceNumber.trim(),
      p_invoice_date: params.invoiceDate
    });

    if (rpcErr || !activationId) {
      throw new Error(rpcErr?.message || 'Failed to activate warranty via atomic PostgreSQL RPC transaction.');
    }

    const fullRecord = await this.getById(String(activationId));
    if (!fullRecord) {
      throw new Error('Failed to retrieve activated warranty record from PostgreSQL.');
    }
    return fullRecord;
  },

  /**
   * Warranty Verification Tool for QR/Barcode/Serial lookup.
   * Uses safe UUID / serial_number lookup so valid serial codes never fail with UUID syntax error.
   */
  async verifyWarranty(serialQuery: string): Promise<{
    found: boolean;
    isActivated: boolean;
    status: 'ACTIVE' | 'EXPIRED' | 'NOT_ACTIVATED' | 'NOT_FOUND';
    serial?: any;
    activation?: WarrantyActivationRecord | null;
    applicablePolicy?: { durationYears: number; resolvedLevel: string } | null;
    daysRemaining?: number;
    message: string;
  }> {
    const clean = (serialQuery || '').trim();
    if (!clean) {
      return {
        found: false,
        isActivated: false,
        status: 'NOT_FOUND',
        message: 'الرجاء إدخال الرقم التسلسلي أو مسح الباركود للتحقق.'
      };
    }

    // 1. Safe lookup of serial in PostgreSQL (no invalid UUID cast)
    const serial = await this.findSerialRecord(clean);

    if (!serial) {
      return {
        found: false,
        isActivated: false,
        status: 'NOT_FOUND',
        message: `الرقم التسلسلي (${clean}) غير مسجل في سجلات الإنتاج الرسمية لشركة Sleepee.`
      };
    }

    // 2. Check if warranty activation exists for this serial
    const { data: actRow, error: actErr } = await getClient()
      .from('warranty_activations')
      .select('id')
      .eq('serial_id', serial.id)
      .maybeSingle();

    if (actErr) throw actErr;

    const modelId = serial.models?.id || serial.model_id;
    const brandId = serial.models?.brand_id || serial.models?.brands?.id;
    const categoryId = serial.models?.category_id || serial.models?.categories?.id;

    let applicablePolicy: { durationYears: number; resolvedLevel: string } | null = null;
    try {
      const policyRes = await warrantyPoliciesApi.resolvePolicy({ modelId, brandId, categoryId });
      applicablePolicy = {
        durationYears: policyRes.durationYears,
        resolvedLevel: policyRes.resolvedLevel
      };
    } catch {
      applicablePolicy = null;
    }

    if (!actRow) {
      return {
        found: true,
        isActivated: false,
        status: 'NOT_ACTIVATED',
        serial,
        applicablePolicy,
        message: `المنتج أصلي ومسجل في سجلات الإنتاج (${serial.serial_number})، ولكن لم يتم تفعيل شهادة الضمان الرسمية له بعد.`
      };
    }

    const activation = await this.getById(actRow.id);
    if (!activation) {
      return {
        found: true,
        isActivated: false,
        status: 'NOT_ACTIVATED',
        serial,
        applicablePolicy,
        message: `المنتج أصلي ومسجل بالسجلات (${serial.serial_number})، ولكن تعذر استرجاع تفاصيل التفعيل.`
      };
    }

    return {
      found: true,
      isActivated: true,
      status: activation.status === 'active' ? 'ACTIVE' : 'EXPIRED',
      serial,
      activation,
      applicablePolicy: {
        durationYears: activation.duration_years,
        resolvedLevel: activation.policy_hierarchy?.resolvedLevel || 'category'
      },
      daysRemaining: activation.days_remaining,
      message:
        activation.status === 'active'
          ? `الضمان سارٍ ومعتمد رسمياً حتى ${activation.warranty_end_date} (متبقي ${activation.days_remaining} يوم).`
          : `الضمان منتهٍ منذ تاريخ ${activation.warranty_end_date}.`
    };
  },

  /**
   * Authoritative Dashboard KPIs computed directly via PostgreSQL count & projection queries.
   * Does NOT use getAll() + client-side filtering.
   */
  async getDashboardMetrics(): Promise<{
    activeWarranties: number;
    expiredWarranties: number;
    totalActivations: number;
    activationsToday: number;
    activationsThisMonth: number;
    activePoliciesCount: number;
  }> {
    const client = getClient();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthStartStr = `${todayStr.slice(0, 7)}-01T00:00:00.000Z`;
    const todayStartStr = `${todayStr}T00:00:00.000Z`;
    const todayEndStr = `${todayStr}T23:59:59.999Z`;

    const [
      totalCountRes,
      todayCountRes,
      monthCountRes,
      activePoliciesCountRes,
      activePoliciesRowsRes,
      activationDatesProjectionRes
    ] = await Promise.all([
      client.from('warranty_activations').select('id', { count: 'exact', head: true }),
      client
        .from('warranty_activations')
        .select('id', { count: 'exact', head: true })
        .gte('activation_date', todayStartStr)
        .lte('activation_date', todayEndStr),
      client
        .from('warranty_activations')
        .select('id', { count: 'exact', head: true })
        .gte('activation_date', currentMonthStartStr),
      client
        .from('warranty_policies')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      client
        .from('warranty_policies')
        .select('id, level_type, category_id, brand_id, model_id, duration_years, is_active, created_at')
        .eq('is_active', true),
      client
        .from('warranty_activations')
        .select(`
          id,
          invoice_date,
          serial_numbers (
            model_id,
            models (
              id,
              brand_id,
              category_id
            )
          )
        `)
    ]);

    if (totalCountRes.error) throw totalCountRes.error;
    if (todayCountRes.error) throw todayCountRes.error;
    if (monthCountRes.error) throw monthCountRes.error;
    if (activePoliciesCountRes.error) throw activePoliciesCountRes.error;
    if (activePoliciesRowsRes.error) throw activePoliciesRowsRes.error;
    if (activationDatesProjectionRes.error) throw activationDatesProjectionRes.error;

    const activePolicies = (activePoliciesRowsRes.data || []) as WarrantyPolicyRecord[];
    const projectionRows = activationDatesProjectionRes.data || [];

    let activeWarranties = 0;
    let expiredWarranties = 0;

    for (const row of projectionRows) {
      const sn: any = Array.isArray(row.serial_numbers) ? row.serial_numbers[0] : row.serial_numbers;
      const mdl: any = Array.isArray(sn?.models) ? sn.models[0] : sn?.models;
      const modelId = mdl?.id || sn?.model_id;
      const brandId = mdl?.brand_id;
      const categoryId = mdl?.category_id;

      const policyRes = warrantyPoliciesApi.resolvePolicyFromList(activePolicies, {
        modelId,
        brandId,
        categoryId
      });

      const endDate = calculateWarrantyEndDate(row.invoice_date, policyRes.durationYears);
      const { status } = computeWarrantyStatus(endDate);
      if (status === 'active') activeWarranties++;
      else expiredWarranties++;
    }

    return {
      activeWarranties,
      expiredWarranties,
      totalActivations: totalCountRes.count ?? projectionRows.length,
      activationsToday: todayCountRes.count ?? 0,
      activationsThisMonth: monthCountRes.count ?? 0,
      activePoliciesCount: activePoliciesCountRes.count ?? activePolicies.length
    };
  },

  /**
   * Authoritative Warranty Audit History from PostgreSQL serial_history & warranty_activations
   */
  async getWarrantyHistory(): Promise<WarrantyHistoryRecord[]> {
    const client = getClient();
    const [{ data: historyRows, error: histErr }, activations, auditLogs] = await Promise.all([
      client
        .from('serial_history')
        .select(`
          id,
          serial_id,
          event_type,
          event_date,
          notes,
          created_by,
          serial_numbers (
            id,
            serial_number,
            status,
            production_date,
            production_batches (
              id,
              batch_number,
              production_orders (
                id,
                order_number
              )
            ),
            models (
              id,
              name_ar,
              name_en,
              brands (id, name_ar, name_en),
              categories (id, name_ar, name_en)
            )
          ),
          profiles:created_by (
            id,
            full_name,
            email
          )
        `)
        .order('event_date', { ascending: false }),
      this.getAll(),
      auditLogsApi.getAll().catch(() => [])
    ]);

    if (histErr) throw histErr;

    const activationById = new Map<string, WarrantyActivationRecord>();
    const activationBySerialId = new Map<string, WarrantyActivationRecord>();
    for (const act of activations) {
      activationById.set(act.id, act);
      activationBySerialId.set(act.serial_id, act);
    }

    const baseHistory = (historyRows || []).map((row: any) => ({
      ...row,
      event_type: row.event_type || 'activated',
      activation: activationBySerialId.get(row.serial_id) || null
    }));

    const derivedHistory: WarrantyHistoryRecord[] = [];
    for (const act of activations) {
      if (act.status === 'expired') {
        derivedHistory.push({
          id: `expired-${act.id}`,
          serial_id: act.serial_id,
          event_type: 'expired',
          event_date: act.warranty_end_date,
          notes: `انتهت صلاحية الضمان بتاريخ ${act.warranty_end_date}`,
          created_by: act.activated_by,
          serial_numbers: act.serial_numbers,
          activation: act
        });
      }
    }

    for (const log of auditLogs) {
      const action = String(log.action || log.action_type || '').toUpperCase();
      const details = String(log.details || '');
      if (action.includes('WARRANTY') || details.includes('ضمان') || details.includes('تفعيل')) {
        let evType = 'updated';
        if (action.includes('VERIFY') || details.includes('تحقق')) evType = 'verified';

        let resolvedSerialId = '';
        if (log.record_id && activationById.has(log.record_id)) {
          resolvedSerialId = activationById.get(log.record_id)!.serial_id;
        } else if (log.record_id && activationBySerialId.has(log.record_id)) {
          resolvedSerialId = log.record_id;
        } else {
          const match = details.match(/SLP-\d{4}-[A-Z0-9]{8}/i);
          if (match) {
            const foundSerial = activations.find(a => a.serial_numbers?.serial_number?.toLowerCase() === match[0].toLowerCase());
            if (foundSerial) {
              resolvedSerialId = foundSerial.serial_id;
            }
          }
        }

        if (resolvedSerialId) {
          const matchedAct = activationBySerialId.get(resolvedSerialId) || null;
          derivedHistory.push({
            id: `audit-${log.id}`,
            serial_id: resolvedSerialId,
            event_type: evType,
            event_date: log.timestamp || log.created_at,
            notes: details,
            created_by: log.actor || null,
            serial_numbers: matchedAct?.serial_numbers || null,
            activation: matchedAct
          });
        }
      }
    }

    const combined = [...baseHistory, ...derivedHistory];
    combined.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    return combined;
  }
};
