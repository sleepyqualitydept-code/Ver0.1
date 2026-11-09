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
    return (data || []).map((row: any) => ({
      ...row,
      fullName: row.full_name,
      alternativePhone: row.alternative_phone || '',
      nationalId: row.national_id || '',
      governorate: row.governorate || '',
      city: row.city || '',
      address: row.address || ''
    }));
  },

  async insert(customer: any) {
    const { data, error } = await getClient()
      .from('customers')
      .insert([customer])
      .select();
    if (error) throw error;
    const row = data?.[0];
    return row ? { ...row, fullName: row.full_name, alternativePhone: row.alternative_phone || '', nationalId: row.national_id || '', governorate: row.governorate || '', city: row.city || '', address: row.address || '' } : null;
  }
};
