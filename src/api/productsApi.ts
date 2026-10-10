/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const productsApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async insert(product: any) {
    const { data, error } = await getClient()
      .from('products')
      .insert([product])
      .select();
    if (error) throw error;
    return data?.[0];
  }
};
