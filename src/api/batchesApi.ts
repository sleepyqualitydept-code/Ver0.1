/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const batchesApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('production_batches')
      .select(`
        *,
        production_orders (
          id,
          order_number,
          status,
          created_at,
          production_order_lines (
            id,
            category_id,
            model_id,
            quantity,
            width_cm,
            length_cm,
            height_cm,
            categories (id, name_ar, name_en),
            models:models!production_order_lines_model_id_fkey (
              id,
              category_id,
              name_ar,
              name_en,
              categories (id, name_ar, name_en)
            )
          )
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await getClient()
      .from('production_batches')
      .select(`
        *,
        production_orders (
          id,
          order_number,
          status,
          created_at,
          production_order_lines (
            id,
            category_id,
            model_id,
            quantity,
            width_cm,
            length_cm,
            height_cm,
            categories (id, name_ar, name_en),
            models:models!production_order_lines_model_id_fkey (
              id,
              category_id,
              name_ar,
              name_en,
              categories (id, name_ar, name_en)
            )
          )
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createBatch(orderId: string) {
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    const batchNumber = `BAT-${year}-${randomSeq}`;

    const { data, error } = await getClient()
      .from('production_batches')
      .insert([{
        batch_number: batchNumber,
        production_order_id: (orderId && orderId.trim() !== '') ? orderId : null,
        status: 'created'
      }])
      .select();

    if (error) throw error;
    return data?.[0];
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await getClient()
      .from('production_batches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data?.[0];
  }
};
