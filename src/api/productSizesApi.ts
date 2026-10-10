/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const productSizesApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('mattress_sizes')
      .select('id, width_cm, length_cm, is_active')
      .eq('is_active', true)
      .order('width_cm');
    if (error) throw error;
    return (data || []).map((s: any) => ({
      ...s,
      size_value: `${s.width_cm}×${s.length_cm}`
    }));
  }
};
