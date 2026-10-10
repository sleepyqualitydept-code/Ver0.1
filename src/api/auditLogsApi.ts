/**
 * Database-backed audit API. Phase 09 warranty events and Phase 10–18 business events
 * are written through SECURITY DEFINER RPCs; the client never inserts directly into audit_logs.
 */
import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const auditLogsApi = {
  async getAll() {
    const { data, error } = await getClient().from('audit_logs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((log: any) => ({
      ...log,
      id: log.id,
      actor: log.performed_by || 'System Database',
      action: log.action_type,
      details: log.new_data?.notes || `${log.action_type} on ${log.table_name}`,
      timestamp: log.created_at
    }));
  },

  async recordWarrantyEvent(params: { activationId: string; eventType: 'verified' | 'updated'; notes?: string; metadata?: any }): Promise<string> {
    const { data, error } = await getClient().rpc('record_warranty_event', {
      p_activation_id: params.activationId,
      p_event_type: params.eventType,
      p_notes: params.notes || null,
      p_metadata: params.metadata || {}
    });
    if (error) throw error;
    return data;
  },

  async recordApplicationEvent(params: { tableName: string; recordId: string; actionType: 'INSERT' | 'UPDATE' | 'DELETE'; details?: Record<string, unknown> | null }): Promise<string> {
    const { data, error } = await getClient().rpc('record_application_event_v2', {
      p_table_name: params.tableName,
      p_record_id: params.recordId,
      p_action_type: params.actionType,
      p_new_data: params.details || {}
    });
    if (error) throw error;
    return data;
  },

  async insert(_log: { actor: string; action: string; details: string }) {
    throw new Error('Direct audit_logs INSERT is disabled. Use recordApplicationEvent() or a domain RPC.');
  }
};
