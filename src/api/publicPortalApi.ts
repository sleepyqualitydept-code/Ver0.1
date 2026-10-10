import { supabase } from '../lib/supabase.ts';

export interface PublicWarrantyResult {
  serial_number: string;
  brand_name_ar: string;
  brand_name_en: string;
  model_name_ar: string;
  model_name_en: string;
  category_name_ar: string;
  category_name_en: string;
  warranty_status: 'active' | 'expired' | 'not_activated';
  warranty_duration_years: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
}

export const publicPortalApi = {
  async verifyWarranty(serialNumber: string): Promise<PublicWarrantyResult | null> {
    if (!supabase) throw new Error('Supabase client is not initialized.');
    const { data, error } = await supabase.rpc('public_verify_warranty', {
      p_serial_number: serialNumber
    });
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }
};
