/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const productTypesApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('product_types')
      .select('*')
      .order('code');
    if (error) throw error;
    return data || [];
  }
};
