/**
 * Supabase-first Replacement Management API.
 * Display numbers and database UUIDs are mapped separately; writes use RPC only.
 */
import { supabase } from '../lib/supabase.ts';
import type { ReplacementCase } from '../utils/store.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

type ReplacementDbRow = {
  id: string;
  request_number: string;
  service_case_id: string;
  status: ReplacementCase['status'];
  reason: string;
  serial_id: string;
  new_serial_id: string | null;
  created_at: string;
  updated_at?: string;
  customer_id?: string;
  service_cases?: { id: string; case_number: string } | null;
  original_serial?: { id: string; serial_number: string } | null;
  replacement_serial?: { id: string; serial_number: string } | null;
};

function mapReplacement(row: ReplacementDbRow): ReplacementCase {
  return {
    ...row,
    id: row.id,
    serviceCaseId: row.service_case_id,
    caseId: row.service_cases?.case_number || '—',
    caseNumber: row.service_cases?.case_number || undefined,
    originalSerialId: row.serial_id,
    originalSerialNumber: row.original_serial?.serial_number || undefined,
    newSerialId: row.new_serial_id || undefined,
    newSerialNumber: row.replacement_serial?.serial_number || undefined,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at
  };
}

export const replacementsApi = {
  async getAll(): Promise<ReplacementCase[]> {
    const { data, error } = await getClient()
      .from('replacement_requests')
      .select(`
        *,
        service_cases:service_cases!replacement_requests_service_case_id_fkey(id, case_number),
        original_serial:serial_numbers!replacement_requests_serial_id_fkey(id, serial_number),
        replacement_serial:serial_numbers!replacement_requests_new_serial_id_fkey(id, serial_number)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as ReplacementDbRow[]).map(mapReplacement);
  },

  async insert(replacement: Partial<ReplacementCase> & { serviceCaseId?: string; reason: string }): Promise<ReplacementCase> {
    const serviceCaseId = replacement.serviceCaseId;
    const reason = replacement.reason?.trim();
    if (!serviceCaseId) throw new Error('A linked customer-service case is required.');
    if (!reason) throw new Error('A replacement reason is required.');

    // The RPC derives customer and original serial from the linked service case.
    // The browser cannot supply an unrelated customer/serial pair or invent an ID.
    const { data, error } = await getClient().rpc('create_replacement_request_for_case_v1', {
      p_service_case_id: serviceCaseId,
      p_reason: reason
    });
    if (error) throw error;

    const rows = await this.getAll();
    const created = rows.find((row) => row.id === data);
    if (!created) throw new Error('Replacement request was created but could not be reloaded.');
    return created;
  },

  async updateStatus(id: string, status: ReplacementCase['status'], newSerialId?: string): Promise<ReplacementCase> {
    if (!id) throw new Error('A replacement request ID is required.');

    if (status === 'approved') {
      if (!newSerialId) throw new Error('Select an existing serial record for the replacement.');
      const { error } = await getClient().rpc('approve_replacement_v2', {
        p_request_id: id,
        p_new_serial_id: newSerialId
      });
      if (error) throw error;
    } else if (status === 'under_review' || status === 'issued' || status === 'completed') {
      const { error } = await getClient().rpc('update_replacement_status_v2', {
        p_request_id: id,
        p_status: status
      });
      if (error) throw error;
    } else {
      throw new Error(`Unsupported client status transition: ${status}`);
    }

    const rows = await this.getAll();
    const updated = rows.find((row) => row.id === id);
    if (!updated) throw new Error('Replacement request was updated but could not be reloaded.');
    return updated;
  }
};
