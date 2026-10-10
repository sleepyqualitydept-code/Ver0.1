import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const serviceAttachmentsApi = {
  async getForCase(caseId: string) {
    const { data, error } = await getClient().from('service_attachments').select('*').eq('service_case_id', caseId).order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async upload(caseId: string, file: File) {
    const client = getClient();
    const { data: authData } = await client.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) throw new Error('Authentication required.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${caseId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await client.storage.from('service').upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await client.from('service_attachments').insert([{
      service_case_id: caseId,
      file_path: path,
      uploaded_by: userId
    }]).select().single();
    if (error) {
      await client.storage.from('service').remove([path]);
      throw error;
    }
    return data;
  }
};
