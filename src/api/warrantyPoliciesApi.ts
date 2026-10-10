/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export type PolicyLevelType = 'category' | 'brand' | 'model';

export interface WarrantyPolicyRecord {
  id: string;
  name?: string;
  level_type: PolicyLevelType;
  category_id?: string | null;
  brand_id?: string | null;
  model_id?: string | null;
  duration_years: number;
  is_active: boolean;
  created_at: string;
  // Joined relation fields
  categories?: { id: string; name_ar: string; name_en: string } | null;
  brands?: { id: string; name_ar: string; name_en: string } | null;
  models?: { id: string; name_ar: string; name_en: string; brands?: { id: string; name_ar: string; name_en: string } } | null;
}

export const VALID_WARRANTY_DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const warrantyPoliciesApi = {
  async getAll(): Promise<WarrantyPolicyRecord[]> {
    const { data, error } = await getClient()
      .from('warranty_policies')
      .select(`
        *,
        categories (id, name_ar, name_en),
        brands (id, name_ar, name_en),
        models (
          id, 
          name_ar, 
          name_en,
          brands (id, name_ar, name_en)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<WarrantyPolicyRecord | null> {
    const { data, error } = await getClient()
      .from('warranty_policies')
      .select(`
        *,
        categories (id, name_ar, name_en),
        brands (id, name_ar, name_en),
        models (
          id, 
          name_ar, 
          name_en,
          brands (id, name_ar, name_en)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(payload: {
    level_type: PolicyLevelType;
    category_id?: string | null;
    brand_id?: string | null;
    model_id?: string | null;
    duration_years: number;
    is_active?: boolean;
  }): Promise<WarrantyPolicyRecord> {
    // 1. Validate duration range [1..15]
    const dur = Number(payload.duration_years);
    if (!VALID_WARRANTY_DURATIONS.includes(dur)) {
      throw new Error(`INVALID_DURATION: Warranty duration must be between 1 and 15 years. Received ${payload.duration_years}.`);
    }

    // 2. Validate scope strictly matching level_type
    if (payload.level_type === 'category' && !payload.category_id) {
      throw new Error('VALIDATION_ERROR: Category ID is required for Category-level policies.');
    }
    if (payload.level_type === 'brand' && !payload.brand_id) {
      throw new Error('VALIDATION_ERROR: Brand ID is required for Brand-level policies.');
    }
    if (payload.level_type === 'model' && !payload.model_id) {
      throw new Error('VALIDATION_ERROR: Model ID is required for Model-level policies.');
    }

    const cleanCategory = payload.level_type === 'category' ? payload.category_id : null;
    const cleanBrand = payload.level_type === 'brand' ? payload.brand_id : null;
    const cleanModel = payload.level_type === 'model' ? payload.model_id : null;

    // 3. Conflict Check: check if active policy already exists for this exact scope
    let existingQuery = getClient()
      .from('warranty_policies')
      .select('id, duration_years, is_active')
      .eq('level_type', payload.level_type)
      .eq('is_active', true);

    if (cleanCategory) existingQuery = existingQuery.eq('category_id', cleanCategory);
    if (cleanBrand) existingQuery = existingQuery.eq('brand_id', cleanBrand);
    if (cleanModel) existingQuery = existingQuery.eq('model_id', cleanModel);

    const { data: existingActive, error: checkErr } = await existingQuery;
    if (checkErr) throw checkErr;

    if (existingActive && existingActive.length > 0 && (payload.is_active !== false)) {
      throw new Error(`DUPLICATE_ACTIVE_POLICY: An active policy already exists for this ${payload.level_type} scope. Only one active policy per level scope is permitted.`);
    }

    // 4. Insert policy into PostgreSQL
    const { data, error } = await getClient()
      .from('warranty_policies')
      .insert([{
        level_type: payload.level_type,
        category_id: cleanCategory,
        brand_id: cleanBrand,
        model_id: cleanModel,
        duration_years: dur,
        is_active: payload.is_active !== undefined ? payload.is_active : true
      }])
      .select(`
        *,
        categories (id, name_ar, name_en),
        brands (id, name_ar, name_en),
        models (id, name_ar, name_en)
      `);

    if (error || !data?.[0]) {
      throw new Error(error?.message || 'Failed to persist warranty policy in database.');
    }

    return data[0];
  },

  async update(id: string, updates: {
    level_type?: PolicyLevelType;
    category_id?: string | null;
    brand_id?: string | null;
    model_id?: string | null;
    duration_years?: number;
    is_active?: boolean;
  }): Promise<WarrantyPolicyRecord> {
    if (!id || !id.trim()) {
      throw new Error('VALIDATION_ERROR: Policy ID is required for update.');
    }

    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`POLICY_NOT_FOUND: Warranty policy (${id}) does not exist in PostgreSQL.`);
    }

    const nextLevelType: PolicyLevelType = updates.level_type || existing.level_type;
    const nextDuration = updates.duration_years !== undefined ? Number(updates.duration_years) : existing.duration_years;
    const nextIsActive = updates.is_active !== undefined ? Boolean(updates.is_active) : existing.is_active;

    if (!VALID_WARRANTY_DURATIONS.includes(nextDuration)) {
      throw new Error(`INVALID_DURATION: Warranty duration must be between 1 and 15 years. Received ${updates.duration_years}.`);
    }

    const rawCategory = updates.category_id !== undefined ? updates.category_id : existing.category_id;
    const rawBrand = updates.brand_id !== undefined ? updates.brand_id : existing.brand_id;
    const rawModel = updates.model_id !== undefined ? updates.model_id : existing.model_id;

    const cleanCategory = nextLevelType === 'category' ? rawCategory : null;
    const cleanBrand = nextLevelType === 'brand' ? rawBrand : null;
    const cleanModel = nextLevelType === 'model' ? rawModel : null;

    if (nextLevelType === 'category' && !cleanCategory) {
      throw new Error('VALIDATION_ERROR: Category ID is required for Category-level policies.');
    }
    if (nextLevelType === 'brand' && !cleanBrand) {
      throw new Error('VALIDATION_ERROR: Brand ID is required for Brand-level policies.');
    }
    if (nextLevelType === 'model' && !cleanModel) {
      throw new Error('VALIDATION_ERROR: Model ID is required for Model-level policies.');
    }

    // Conflict Check if resulting policy is active
    if (nextIsActive) {
      let conflictQuery = getClient()
        .from('warranty_policies')
        .select('id, duration_years, is_active')
        .eq('level_type', nextLevelType)
        .eq('is_active', true)
        .neq('id', id);

      if (cleanCategory) conflictQuery = conflictQuery.eq('category_id', cleanCategory);
      if (cleanBrand) conflictQuery = conflictQuery.eq('brand_id', cleanBrand);
      if (cleanModel) conflictQuery = conflictQuery.eq('model_id', cleanModel);

      const { data: conflictingPolicies, error: conflictErr } = await conflictQuery;
      if (conflictErr) throw conflictErr;

      if (conflictingPolicies && conflictingPolicies.length > 0) {
        throw new Error(`DUPLICATE_ACTIVE_POLICY: Another active policy already exists for this ${nextLevelType} scope. Only one active policy per scope is permitted.`);
      }
    }

    const updatePayload = {
      level_type: nextLevelType,
      category_id: cleanCategory,
      brand_id: cleanBrand,
      model_id: cleanModel,
      duration_years: nextDuration,
      is_active: nextIsActive
    };

    const { data, error } = await getClient()
      .from('warranty_policies')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        categories (id, name_ar, name_en),
        brands (id, name_ar, name_en),
        models (
          id,
          name_ar,
          name_en,
          brands (id, name_ar, name_en)
        )
      `);

    if (error) {
      throw new Error(`DATABASE_UPDATE_ERROR: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(
        'RLS_UPDATE_BLOCKED: Warranty policy update affected 0 rows in PostgreSQL. Please execute PHASE_09_FINAL_ATOMIC_CUSTOMER_MIGRATION.sql in Supabase SQL Editor to grant UPDATE permission on public.warranty_policies.'
      );
    }

    return data[0];
  },

  async delete(id: string): Promise<void> {
    const { error } = await getClient()
      .from('warranty_policies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Synchronous strict hierarchy resolution against a loaded list of policies from PostgreSQL:
   * 1. Active Model Override Policy
   * 2. Active Brand Override Policy
   * 3. Active Category Default Policy
   * 4. Reject explicitly (NO 10-year or silent fallback)
   */
  resolvePolicyFromList(
    policies: WarrantyPolicyRecord[],
    params: {
      modelId?: string | null;
      brandId?: string | null;
      categoryId?: string | null;
    }
  ): {
    durationYears: number;
    resolvedLevel: PolicyLevelType;
    policy: WarrantyPolicyRecord;
  } {
    const activePolicies = (policies || []).filter(p => p.is_active);

    if (params.modelId) {
      const modelPolicy = activePolicies.find(
        p => p.level_type === 'model' && p.model_id === params.modelId
      );
      if (modelPolicy) {
        return {
          durationYears: modelPolicy.duration_years,
          resolvedLevel: 'model',
          policy: modelPolicy
        };
      }
    }

    if (params.brandId) {
      const brandPolicy = activePolicies.find(
        p => p.level_type === 'brand' && p.brand_id === params.brandId
      );
      if (brandPolicy) {
        return {
          durationYears: brandPolicy.duration_years,
          resolvedLevel: 'brand',
          policy: brandPolicy
        };
      }
    }

    if (params.categoryId) {
      const catPolicy = activePolicies.find(
        p => p.level_type === 'category' && p.category_id === params.categoryId
      );
      if (catPolicy) {
        return {
          durationYears: catPolicy.duration_years,
          resolvedLevel: 'category',
          policy: catPolicy
        };
      }
    }

    throw new Error(
      `WARRANTY_POLICY_NOT_FOUND: No active warranty policy found for Model: ${params.modelId || 'N/A'}, Brand: ${params.brandId || 'N/A'}, Category: ${params.categoryId || 'N/A'}. A valid policy must be configured in PostgreSQL.`
    );
  },

  /**
   * Authoritative Policy Resolution directly against PostgreSQL:
   * 1. Check Model Override Policy
   * 2. If none exists, check Brand Override Policy
   * 3. If none exists, check Category Default Policy
   * 4. If none exists, REJECT (NO hardcoded or silent fallback)
   */
  async resolvePolicy(params: {
    modelId?: string | null;
    brandId?: string | null;
    categoryId?: string | null;
  }): Promise<{
    durationYears: number;
    resolvedLevel: PolicyLevelType;
    policy: WarrantyPolicyRecord;
  }> {
    const client = getClient();

    // 1. Check Model Policy
    if (params.modelId) {
      const { data: modelPolicy, error: mErr } = await client
        .from('warranty_policies')
        .select(`*, models(name_ar, name_en), brands(name_ar, name_en), categories(name_ar, name_en)`)
        .eq('level_type', 'model')
        .eq('model_id', params.modelId)
        .eq('is_active', true)
        .maybeSingle();

      if (mErr) throw mErr;
      if (modelPolicy) {
        return {
          durationYears: modelPolicy.duration_years,
          resolvedLevel: 'model',
          policy: modelPolicy
        };
      }
    }

    // 2. Check Brand Policy
    if (params.brandId) {
      const { data: brandPolicy, error: bErr } = await client
        .from('warranty_policies')
        .select(`*, models(name_ar, name_en), brands(name_ar, name_en), categories(name_ar, name_en)`)
        .eq('level_type', 'brand')
        .eq('brand_id', params.brandId)
        .eq('is_active', true)
        .maybeSingle();

      if (bErr) throw bErr;
      if (brandPolicy) {
        return {
          durationYears: brandPolicy.duration_years,
          resolvedLevel: 'brand',
          policy: brandPolicy
        };
      }
    }

    // 3. Check Category Policy
    if (params.categoryId) {
      const { data: catPolicy, error: cErr } = await client
        .from('warranty_policies')
        .select(`*, models(name_ar, name_en), brands(name_ar, name_en), categories(name_ar, name_en)`)
        .eq('level_type', 'category')
        .eq('category_id', params.categoryId)
        .eq('is_active', true)
        .maybeSingle();

      if (cErr) throw cErr;
      if (catPolicy) {
        return {
          durationYears: catPolicy.duration_years,
          resolvedLevel: 'category',
          policy: catPolicy
        };
      }
    }

    // 4. No policy found in hierarchy -> Reject explicitly
    throw new Error(`WARRANTY_POLICY_NOT_FOUND: No active warranty policy found for Model: ${params.modelId || 'N/A'}, Brand: ${params.brandId || 'N/A'}, Category: ${params.categoryId || 'N/A'}. A policy must be created before activating warranty.`);
  },

  // Backward compatibility helpers
  async upsert(policy: { target_type?: string; target_id?: string; duration_years: number; level_type?: string; category_id?: string; brand_id?: string; model_id?: string }) {
    const level = (policy.level_type || policy.target_type || 'category') as PolicyLevelType;
    return this.create({
      level_type: level,
      category_id: policy.category_id || (level === 'category' ? policy.target_id : null),
      brand_id: policy.brand_id || (level === 'brand' ? policy.target_id : null),
      model_id: policy.model_id || (level === 'model' ? policy.target_id : null),
      duration_years: policy.duration_years,
      is_active: true
    });
  },

  async updateDuration(id: string, durationYears: number) {
    return this.update(id, { duration_years: durationYears });
  }
};
