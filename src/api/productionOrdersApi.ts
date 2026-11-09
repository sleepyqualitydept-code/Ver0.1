/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

function mapProductionOrder(row: any) {
  const lines = Array.isArray(row?.production_order_lines) ? row.production_order_lines : [];
  const distinct = (key: string) => Array.from(new Set(lines.map((line: any) => line?.[key]).filter((value: any) => value !== null && value !== undefined && value !== '')));
  const brands = distinct('brand_id');
  const models = distinct('model_id');
  const categories = distinct('category_id');
  const dimensions = distinct('width_cm').length === 1 && distinct('length_cm').length === 1
    ? `${distinct('width_cm')[0]}×${distinct('length_cm')[0]}` : '';
  const totalQuantity = lines.reduce((sum: number, line: any) => sum + (Number.isFinite(Number(line?.quantity)) ? Number(line.quantity) : 0), 0);
  return {
    ...row,
    orderNumber: row?.order_number || '',
    createdAt: row?.created_at || '',
    updatedAt: row?.updated_at || '',
    quantity: totalQuantity,
    brandId: brands.length === 1 ? brands[0] : '',
    modelId: models.length === 1 ? models[0] : '',
    category: categories.length === 1 ? categories[0] : '',
    size: dimensions,
    // A multi-line order remains represented by production_order_lines; do not fabricate a type.
    type: row?.type || (lines.length === 1 && lines[0]?.project_name ? 'project' : undefined)
  };
}

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const productionOrdersApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('production_orders')
      .select(`
        *,
        production_order_lines (
          *,
          product_types (id, code, name_ar, name_en),
          categories (id, name_ar, name_en),
          brands (id, name_ar, name_en),
          models:models!production_order_lines_model_id_fkey (id, name_ar, name_en)
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProductionOrder);
  },

  async getById(id: string) {
    const { data, error } = await getClient()
      .from('production_orders')
      .select(`
        *,
        production_order_lines (
          *,
          product_types (id, code, name_ar, name_en),
          categories (id, name_ar, name_en),
          brands (id, name_ar, name_en),
          models:models!production_order_lines_model_id_fkey (id, name_ar, name_en)
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data ? mapProductionOrder(data) : null;
  },

  async createOrder(lines: any[], userId?: string) {
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('PRODUCTION_VALIDATION_ERROR: At least one production line is required.');
    lines.forEach((line, index) => {
      if (!line.product_type_id || !line.category_id || !line.brand_id || !line.model_id) throw new Error(`PRODUCTION_VALIDATION_ERROR: Line ${index + 1} is missing a required master-data reference.`);
      if (!(Number(line.width_cm) > 0) || !(Number(line.length_cm) > 0) || !(Number(line.height_cm) > 0)) throw new Error(`PRODUCTION_VALIDATION_ERROR: Line ${index + 1} requires source-confirmed width, length, and height. No dimensions are defaulted.`);
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) throw new Error(`PRODUCTION_VALIDATION_ERROR: Line ${index + 1} quantity must be a positive integer.`);
    });
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `ORD-${year}-${randomSeq}`;

    const client = getClient();
    
    // Insert order header
    const { data: orderData, error: headerErr } = await client
      .from('production_orders')
      .insert([{
        order_number: orderNumber,
        status: 'draft',
        created_by: userId || null
      }])
      .select();

    if (headerErr) throw headerErr;
    const order = orderData?.[0];
    if (!order) throw new Error('Failed to create order header.');

    // Insert order lines
    const linesToInsert = lines.map(line => ({
      production_order_id: order.id,
      product_type_id: (line.product_type_id && String(line.product_type_id).trim() !== '') ? line.product_type_id : null,
      category_id: (line.category_id && String(line.category_id).trim() !== '') ? line.category_id : null,
      brand_id: (line.brand_id && String(line.brand_id).trim() !== '') ? line.brand_id : null,
      model_id: (line.model_id && String(line.model_id).trim() !== '') ? line.model_id : null,
      mattress_size_id: (line.mattress_size_id && String(line.mattress_size_id).trim() !== '') ? line.mattress_size_id : null,
      width_cm: line.width_cm,
      length_cm: line.length_cm,
      height_cm: line.height_cm,
      quantity: line.quantity,
      project_name: line.project_name || null,
      project_customer_id: line.project_customer_id || null,
      project_reference: line.project_reference || null,
      project_specifications: line.project_specifications || null,
      notes: line.notes || ''
    }));

    const { error: linesErr } = await client
      .from('production_order_lines')
      .insert(linesToInsert);

    if (linesErr) {
      // Clean up orphaned header
      await client.from('production_orders').delete().eq('id', order.id);
      throw linesErr;
    }

    return mapProductionOrder(order);
  },

  async updateOrderLines(orderId: string, lines: any[]) {
    const client = getClient();
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('PRODUCTION_VALIDATION_ERROR: At least one production line is required.');
    lines.forEach((line, index) => {
      if (!line.product_type_id || !line.category_id || !line.brand_id || !line.model_id) throw new Error(`PRODUCTION_VALIDATION_ERROR: Line ${index + 1} is missing a required master-data reference.`);
      if (!(Number(line.width_cm) > 0) || !(Number(line.length_cm) > 0) || !(Number(line.height_cm) > 0)) throw new Error(`PRODUCTION_VALIDATION_ERROR: Line ${index + 1} requires source-confirmed width, length, and height. No dimensions are defaulted.`);
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) throw new Error(`PRODUCTION_VALIDATION_ERROR: Line ${index + 1} quantity must be a positive integer.`);
    });

    const { error } = await client.rpc('replace_production_order_lines_v1', {
      p_order_id: orderId,
      p_lines: lines.map(line => ({
        product_type_id: line.product_type_id,
        category_id: line.category_id,
        brand_id: line.brand_id,
        model_id: line.model_id,
        mattress_size_id: line.mattress_size_id || null,
        width_cm: Number(line.width_cm),
        length_cm: Number(line.length_cm),
        height_cm: Number(line.height_cm),
        quantity: Number(line.quantity),
        project_name: line.project_name || null,
        project_customer_id: line.project_customer_id || null,
        project_reference: line.project_reference || null,
        project_specifications: line.project_specifications || null,
        notes: line.notes || null
      }))
    });
    if (error) throw error;

    return true;
  },

  async updateStatus(id: string, status: string, approvedByUserId?: string) {
    const updatePayload: any = { status, updated_at: new Date().toISOString() };
    if (status === 'approved' && approvedByUserId) {
      updatePayload.approved_by = approvedByUserId;
    }

    const { data, error } = await getClient()
      .from('production_orders')
      .update(updatePayload)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data?.[0];
  }
};
