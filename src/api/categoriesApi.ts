/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const categoriesApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('categories')
      .select('*')
      .order('id');
    if (error) throw error;
    return data;
  }
};
