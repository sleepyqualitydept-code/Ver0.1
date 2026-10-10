import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const customer360Api = {
  async getTimeline(serialId: string) {
    const client = getClient();
    const [history, warranty, cases, replacements] = await Promise.all([
      client.from('serial_history').select('id,event_type,event_date,notes,created_by').eq('serial_id', serialId).order('event_date', { ascending: true }),
      client.from('warranty_activations').select('id,invoice_number,invoice_date,activation_date,warranty_end_date,duration_years').eq('serial_id', serialId).order('activation_date', { ascending: true }),
      client.from('service_cases').select('id,case_number,case_type,status,subject,description,created_at,updated_at').eq('serial_id', serialId).order('created_at', { ascending: true }),
      client.from('replacement_requests').select('id,request_number,status,reason,created_at,updated_at,new_serial_id').eq('serial_id', serialId).order('created_at', { ascending: true })
    ]);
    if (history.error) throw history.error;
    if (warranty.error) throw warranty.error;
    if (cases.error) throw cases.error;
    if (replacements.error) throw replacements.error;

    const events: any[] = [];
    for (const row of history.data || []) events.push({ id: `serial-${row.id}`, type: 'serial', title: row.event_type, description: row.notes || '', timestamp: row.event_date, badge: row.event_type });
    for (const row of warranty.data || []) events.push({ id: `warranty-${row.id}`, type: 'warranty', title: 'Warranty Activation', description: `Invoice ${row.invoice_number}`, timestamp: row.activation_date, badge: `Warranty ${row.duration_years || ''}y` });
    for (const row of cases.data || []) events.push({ id: `case-${row.id}`, type: 'case', title: `Service Case ${row.case_number}`, description: row.subject || row.description || '', timestamp: row.created_at, badge: row.status });
    for (const row of replacements.data || []) events.push({ id: `replacement-${row.id}`, type: 'replacement', title: `Replacement ${row.request_number}`, description: row.reason || '', timestamp: row.created_at, badge: row.status });
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
};
