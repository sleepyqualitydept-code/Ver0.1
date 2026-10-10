/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const modelsApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('models')
      .select('*')
      .order('name_en');
    if (error) throw error;
    return (data || []).map((m: any) => ({
      ...m,
      brandId: m.brand_id,
      category: m.category_id,
      name: m.name_ar || m.name_en || '',
      nameAr: m.name_ar || '',
      nameEn: m.name_en || ''
    }));
  },

  async insert(model: { id: string; brand_id: string; category_id: string; name: string }) {
    const { data, error } = await getClient()
      .from('models')
      .insert([{
        id: model.id,
        brand_id: model.brand_id,
        category_id: model.category_id,
        name_ar: model.name,
        name_en: model.name,
        is_active: true
      }])
      .select();
    if (error) throw error;
    const m = data?.[0];
    if (!m) return null;
    return {
      ...m,
      brandId: m.brand_id,
      category: m.category_id,
      name: m.name_ar || m.name_en || '',
      nameAr: m.name_ar || '',
      nameEn: m.name_en || ''
    };
  }
};
