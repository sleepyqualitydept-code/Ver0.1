/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export const reportsApi = {
  async getDashboardKPIs() {
    // 1. Try SQL RPC function get_dashboard_kpis
    const { data: rpcData, error: rpcError } = await getClient().rpc('get_dashboard_kpis');
    if (!rpcError && rpcData) {
      return rpcData;
    }

    // 2. Query SQL View vw_dashboard_kpis
    const { data: viewData, error: viewError } = await getClient()
      .from('vw_dashboard_kpis')
      .select('*')
      .maybeSingle();

    if (!viewError && viewData) {
      return viewData;
    }

    return null;
  },

  async getProductionStats() {
    return this.getDashboardKPIs();
  }
};
