/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

function mapBatch(row: any) {
  const order = Array.isArray(row?.production_orders) ? row.production_orders[0] : row?.production_orders;
  const lines = Array.isArray(order?.production_order_lines) ? order.production_order_lines : [];
  const quantity = lines.reduce((sum: number, line: any) => sum + (Number.isFinite(Number(line?.quantity)) ? Number(line.quantity) : 0), 0);
  return {
    ...row,
    batchNumber: row?.batch_number || '',
    orderId: row?.production_order_id || order?.id || '',
    quantity: quantity > 0 ? quantity : 0,
    createdAt: row?.created_at || '',
    production_orders: order || null
  };
}

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
    return (data || []).map(mapBatch);
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
    return data ? mapBatch(data) : null;
  },

  async createBatch(orderId: string) {
    if (!orderId || !orderId.trim()) {
      throw new Error('BATCH_VALIDATION_ERROR: A linked production order is required.');
    }
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    const batchNumber = `BAT-${year}-${randomSeq}`;

    const { data, error } = await getClient()
      .from('production_batches')
      .insert([{
        batch_number: batchNumber,
        production_order_id: orderId,
        status: 'created'
      }])
      .select();

    if (error) throw error;
    return data?.[0] ? mapBatch(data[0]) : null;
  },

  async updateStatus(id: string, status: string) {
    if (status === 'printed') {
      throw new Error('BATCH_PRINT_STATUS_BLOCKED: Only a validated physical printer integration may mark a batch printed.');
    }
    const { data, error } = await getClient().rpc('update_production_batch_status_v1', {
      p_batch_id: id,
      p_status: status
    });
    if (error) throw error;
    return data;
  }
};
