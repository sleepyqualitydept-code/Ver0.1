/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const serialNumbersApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('serial_numbers')
      .select(`
        *,
        production_batches (
          id,
          batch_number,
          status,
          production_orders (
            id,
            order_number,
            status
          )
        ),
        models (
          id,
          name_ar,
          name_en,
          brands (id, name_ar, name_en)
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await getClient()
      .from('serial_numbers')
      .select(`
        *,
        production_batches (
          id,
          batch_number,
          status,
          created_at,
          production_orders (
            id,
            order_number,
            status,
            created_at
          )
        ),
        models (
          id,
          name_ar,
          name_en,
          brands (id, name_ar, name_en),
          categories (id, name_ar, name_en)
        ),
        serial_history (
          id,
          event_type,
          event_date,
          notes,
          created_by
        )
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async search(filters: {
    query?: string;
    batchId?: string;
    modelId?: string;
    status?: string;
  }) {
    let q = getClient()
      .from('serial_numbers')
      .select(`
        *,
        production_batches (
          id,
          batch_number,
          status,
          production_orders (
            id,
            order_number,
            status
          )
        ),
        models (
          id,
          name_ar,
          name_en,
          brands (id, name_ar, name_en)
        )
      `);

    if (filters.status && filters.status !== 'all') {
      q = q.eq('status', filters.status);
    }
    if (filters.batchId && filters.batchId !== 'all') {
      q = q.eq('batch_id', filters.batchId);
    }
    if (filters.modelId && filters.modelId !== 'all') {
      q = q.eq('model_id', filters.modelId);
    }

    if (filters.query && filters.query.trim()) {
      const trimmed = filters.query.trim();
      const orConditions: string[] = [`serial_number.ilike.%${trimmed}%`];

      // Match batch numbers
      const { data: matchedBatches } = await getClient()
        .from('production_batches')
        .select('id')
        .ilike('batch_number', `%${trimmed}%`);
      const matchedBatchIds = (matchedBatches || []).map((b: any) => b.id);

      // Match order numbers -> batch ids
      const { data: matchedOrders } = await getClient()
        .from('production_orders')
        .select('id')
        .ilike('order_number', `%${trimmed}%`);
      if (matchedOrders && matchedOrders.length > 0) {
        const orderIds = matchedOrders.map((o: any) => o.id);
        const { data: batchesFromOrders } = await getClient()
          .from('production_batches')
          .select('id')
          .in('production_order_id', orderIds);
        if (batchesFromOrders) {
          matchedBatchIds.push(...batchesFromOrders.map((b: any) => b.id));
        }
      }

      // Match model names
      const { data: matchedModels } = await getClient()
        .from('models')
        .select('id')
        .or(`name_ar.ilike.%${trimmed}%,name_en.ilike.%${trimmed}%`);
      const matchedModelIds = (matchedModels || []).map((m: any) => m.id);

      const uniqueBatchIds = Array.from(new Set(matchedBatchIds));
      if (uniqueBatchIds.length > 0) {
        orConditions.push(`batch_id.in.(${uniqueBatchIds.join(',')})`);
      }
      if (matchedModelIds.length > 0) {
        orConditions.push(`model_id.in.(${Array.from(new Set(matchedModelIds)).join(',')})`);
      }

      q = q.or(orConditions.join(','));
    }

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async generate(batchId: string) {
    const cleanBatchId = (batchId && batchId.trim() !== '') ? batchId : null;

    if (!cleanBatchId) {
      throw new Error('Serialization failed: A valid production batch ID is required.');
    }

    // Load the selected Production Batch from PostgreSQL with production orders and lines
    const { data: batchData, error: batchErr } = await getClient()
      .from('production_batches')
      .select(`
        id,
        status,
        batch_number,
        production_order_id,
        production_orders (
          id,
          order_number,
          status,
          production_order_lines (
            id,
            model_id,
            quantity
          )
        )
      `)
      .eq('id', cleanBatchId)
      .maybeSingle();

    if (batchErr) throw batchErr;
    if (!batchData) {
      throw new Error('Serialization failed: Production batch not found in database.');
    }

    // Validate Batch status must be 'created'
    if (batchData.status !== 'created') {
      throw new Error(`BATCH_ALREADY_SERIALIZED: Production batch ${batchData.batch_number || cleanBatchId} status is '${batchData.status}'. Serialization can only be executed on batches in 'created' status.`);
    }

    const prodOrder: any = Array.isArray(batchData.production_orders)
      ? batchData.production_orders[0]
      : batchData.production_orders;

    if (!prodOrder) {
      throw new Error('Serialization failed: No linked production order found for this batch.');
    }

    // Validate Production Order status accepts both 'approved' and 'in_production'
    const validOrderStatuses = ['approved', 'in_production'];
    const isOrderValid = validOrderStatuses.includes(prodOrder.status);

    if (!isOrderValid) {
      throw new Error(`ORDER_NOT_READY_FOR_SERIALIZATION: Production Order ${prodOrder.order_number || prodOrder.id} status is '${prodOrder.status}'. Order must be approved or in_production before serializing.`);
    }

    const lines: any[] = prodOrder?.production_order_lines || [];
    if (lines.length === 0) {
      throw new Error('BATCH_MODEL_MISSING: No production order lines found for this batch.');
    }

    // Validate that every line has model_id
    const hasMissingModel = lines.some((line: any) => !line.model_id);
    if (hasMissingModel) {
      throw new Error('BATCH_MODEL_MISSING: One or more production order lines are missing model_id.');
    }

    // Calculate actualQty = SUM(production_order_lines.quantity)
    const actualQty = lines.reduce((sum: number, line: any) => sum + (Number(line.quantity) || 0), 0);
    if (actualQty <= 0) {
      throw new Error('BATCH_QUANTITY_INVALID: Production quantity must be greater than zero.');
    }

    // Resolve Model strictly from production_order_lines
    const modelIds = Array.from(new Set(lines.map((l: any) => l.model_id).filter(Boolean)));

    if (modelIds.length === 0) {
      throw new Error('BATCH_MODEL_MISSING: No model_id found on the production order lines for this batch.');
    }

    if (modelIds.length > 1) {
      throw new Error('BATCH_MODEL_AMBIGUOUS: Batch contains production order lines with multiple different models.');
    }

    // Execute authoritative generate_serials RPC with p_batch_id and p_qty
    const { data, error } = await getClient().rpc('generate_serials', {
      p_batch_id: cleanBatchId,
      p_qty: actualQty
    });

    if (error) {
      throw error;
    }

    return data || true;
  },

  async getHistory(serialId: string) {
    const { data, error } = await getClient()
      .from('serial_history')
      .select('*')
      .eq('serial_id', serialId)
      .order('event_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addHistoryEvent(serialId: string, eventType: string, notes?: string, userId?: string) {
    const { data, error } = await getClient()
      .from('serial_history')
      .insert([{
        serial_id: serialId,
        event_type: eventType,
        notes: notes || '',
        created_by: userId || null
      }])
      .select();
    if (error) throw error;
    return data?.[0];
  },

  async updateStatus(serialIds: string[], status: string) {
    const { data, error } = await getClient()
      .from('serial_numbers')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', serialIds)
      .select();
    if (error) throw error;
    return data;
  }
};
