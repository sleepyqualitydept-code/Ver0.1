import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const adminApi = {
  async getUsers() {
    const { data: profiles, error: profileError } = await getClient().from('profiles').select('id,email,full_name,created_at').order('created_at', { ascending: false });
    if (profileError) throw profileError;
    const { data: roles, error: roleError } = await getClient().from('user_roles').select('user_id,role_name');
    if (roleError) throw roleError;
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role_name]));
    return (profiles || []).map((p: any) => ({ ...p, role_name: roleMap.get(p.id) || 'Unassigned' }));
  },

  async setUserRole(userId: string, roleName: string) {
    const { data, error } = await getClient().rpc('admin_set_user_role', {
      p_user_id: userId,
      p_role_name: roleName
    });
    if (error) throw error;
    return data;
  }
};
