/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check for missing credentials as required by FIX 01
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl !== 'MY_VITE_SUPABASE_URL' && 
  !supabaseUrl.includes('your-supabase-project') &&
  supabaseAnonKey !== 'MY_VITE_SUPABASE_ANON_KEY' &&
  !supabaseAnonKey.includes('your-supabase-anon-key');

if (!isSupabaseConfigured) {
  console.error('CRITICAL CONFIGURATION ERROR: Supabase is unconfigured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided in the secrets panel.');
}

// Strictly do not create a client when configuration is missing (returns null)
export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : null;
