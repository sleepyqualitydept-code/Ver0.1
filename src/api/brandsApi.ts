/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const brandsApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('brands')
      .select('*')
      .order('id');
    if (error) throw error;
    return data;
  },

  async insert(brand: { id: string; name_ar: string; name_en: string }) {
    const { data, error } = await getClient()
      .from('brands')
      .insert([brand])
      .select();
    if (error) throw error;
    return data?.[0];
  }
};
