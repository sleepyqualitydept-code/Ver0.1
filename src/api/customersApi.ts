/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const customersApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async insert(customer: any) {
    const { data, error } = await getClient()
      .from('customers')
      .insert([customer])
      .select();
    if (error) throw error;
    return data?.[0];
  }
};
