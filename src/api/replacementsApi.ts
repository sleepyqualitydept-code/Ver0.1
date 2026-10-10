/**
 * Supabase-first Replacement Management API.
 * Phase 12 writes use server-side RPCs and preserve original/new serial linkage.
 */
import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const replacementsApi = {
  async getAll() {
    const { data, error } = await getClient()
      .from('replacement_requests')
      .select('*, serial_numbers(serial_number)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      caseId: r.request_number,
      originalSerialId: r.serial_numbers?.serial_number || r.serial_id,
      newSerialId: r.new_serial_id,
      createdAt: r.created_at
    }));
  },

  async insert(replacement: any) {
    const customerId = replacement.customerId || replacement.customer_id;
    const serialId = replacement.originalSerialId || replacement.serialId || replacement.serial_id;
    if (!customerId) throw new Error('Customer is required for a replacement request.');
    if (!serialId) throw new Error('Original serial is required for a replacement request.');

    const { data, error } = await getClient().rpc('create_replacement_request_v2', {
      p_customer_id: customerId,
      p_serial_id: serialId,
      p_reason: replacement.reason
    });
    if (error) throw error;

    const rows = await this.getAll();
    const inserted = rows.find((row: any) => row.id === data);
    if (!inserted) throw new Error('Replacement request was created but could not be reloaded.');
    return inserted;
  },

  async updateStatus(id: string, status: string, newSerialId?: string) {
    if (status === 'approved') {
      if (!newSerialId) throw new Error('A replacement serial is required when approving a request.');
      const { data, error } = await getClient().rpc('approve_replacement_v2', {
        p_request_id: id,
        p_new_serial_id: newSerialId
      });
      if (error) throw error;
      return data;
    }

    const { data, error } = await getClient().rpc('update_replacement_status_v2', {
      p_request_id: id,
      p_status: status
    });
    if (error) throw error;
    return data;
  }
};
