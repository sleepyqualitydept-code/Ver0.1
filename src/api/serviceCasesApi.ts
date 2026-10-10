/**
 * Supabase-first Service Case API.
 * Phase 10–18: all writes go through SECURITY DEFINER RPCs.
 */
import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const serviceCasesApi = {
  async getAll() {
    const client = getClient();
    const [{ data: cases, error: caseError }, { data: profiles, error: profileError }, { data: customers, error: customerError }] = await Promise.all([
      client.from('service_cases').select('*, service_case_notes(*)').order('created_at', { ascending: false }),
      client.from('profiles').select('id, full_name, email'),
      client.from('customers').select('id, full_name, phone')
    ]);
    if (caseError) throw caseError;
    if (profileError) throw profileError;
    if (customerError) throw customerError;

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
    return (cases || []).map((sc: any) => {
      const assignee = sc.assigned_to ? profileMap.get(sc.assigned_to) : null;
      const customer = sc.customer_id ? customerMap.get(sc.customer_id) : null;
      const notes = (sc.service_case_notes || [])
        .map((n: any) => {
          const author = n.created_by ? profileMap.get(n.created_by) : null;
          return {
            id: n.id,
            note: n.note_text,
            actor: author?.full_name || author?.email || 'System',
            timestamp: n.created_at
          };
        })
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        ...sc,
        id: sc.id,
        caseNumber: sc.case_number,
        serialId: sc.serial_id,
        customerId: sc.customer_id,
        customerName: customer?.full_name || '',
        customerPhone: customer?.phone || '',
        type: sc.case_type,
        status: sc.status,
        assignee: assignee?.full_name || assignee?.email || '',
        assigned_to: sc.assigned_to,
        notes: sc.description || '',
        createdAt: sc.created_at,
        timeline: notes
      };
    });
  },

  async insert(serviceCase: any) {
    const client = getClient();
    if (!serviceCase.customerId) throw new Error('Customer selection is required before creating a service case.');
    if (!serviceCase.serialId) throw new Error('Serial selection is required before creating a service case.');

    const { data, error } = await client.rpc('create_service_case_v2', {
      p_customer_id: serviceCase.customerId,
      p_serial_id: serviceCase.serialId,
      p_case_type: serviceCase.type,
      p_subject: serviceCase.subject || `${serviceCase.type}`,
      p_description: serviceCase.notes
    });
    if (error) throw error;

    const id = data as string;
    const rows = await this.getAll();
    const created = rows.find((row: any) => row.id === id);
    if (!created) throw new Error('Service case was created but could not be reloaded.');
    return created;
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await getClient().rpc('update_service_case_status_v2', {
      p_case_id: id,
      p_status: status
    });
    if (error) throw error;
    return data;
  },

  async insertTimelineNote(note: { case_id: string; note: string }) {
    const { data, error } = await getClient().rpc('record_service_case_note', {
      p_case_id: note.case_id,
      p_note: note.note
    });
    if (error) throw error;
    return data;
  }
};
