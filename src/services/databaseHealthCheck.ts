/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

/**
 * This is deliberately a CORE-TABLE readiness check, not a full schema audit.
 * It cannot prove that all views, RPC functions, RLS policies, storage buckets,
 * or Realtime publications are deployed.
 */
export interface DatabaseHealthStatus {
  isConnected: boolean;
  projectUrl: string;
  projectRef: string;
  /** Number of the six core table checks that returned successfully. */
  tableCount: number;
  hasUserRoles: boolean;
  hasProfiles: boolean;
  hasProducts: boolean;
  hasProductionOrders: boolean;
  hasSerialNumbers: boolean;
  hasWarrantyActivations: boolean;
  /** True only when all six core table checks succeed; not a full schema certificate. */
  hasCoreTables: boolean;
  errorMessage?: string;
}

const CORE_TABLES = [
  'user_roles',
  'profiles',
  'products',
  'production_orders',
  'serial_numbers',
  'warranty_activations'
] as const;

type CoreTableName = (typeof CORE_TABLES)[number];

function unavailableStatus(projectUrl: string, projectRef: string, errorMessage: string): DatabaseHealthStatus {
  return {
    isConnected: false,
    projectUrl,
    projectRef,
    tableCount: 0,
    hasUserRoles: false,
    hasProfiles: false,
    hasProducts: false,
    hasProductionOrders: false,
    hasSerialNumbers: false,
    hasWarrantyActivations: false,
    hasCoreTables: false,
    errorMessage
  };
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const matchRef = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  const projectRef = matchRef ? matchRef[1] : 'unknown-ref';

  if (!supabase) {
    return unavailableStatus(supabaseUrl, projectRef, 'Supabase client is not initialized. Check the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }

  const statusMap: Record<CoreTableName, boolean> = {
    user_roles: false,
    profiles: false,
    products: false,
    production_orders: false,
    serial_numbers: false,
    warranty_activations: false
  };

  try {
    for (const tableName of CORE_TABLES) {
      const { error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      statusMap[tableName] = !error;
      if (error) {
        // A failed query may indicate a missing table, permissions, or another schema mismatch.
        // Report only that this table could not be verified; do not infer the exact cause.
        console.warn(`[DATABASE CORE CHECK] Could not verify '${tableName}':`, error.message);
      }
    }

    const verifiedCoreTableCount = CORE_TABLES.filter((name) => statusMap[name]).length;
    const hasCoreTables = verifiedCoreTableCount === CORE_TABLES.length;
    const unavailableTables = CORE_TABLES.filter((name) => !statusMap[name]);

    return {
      isConnected: true,
      projectUrl: supabaseUrl,
      projectRef,
      tableCount: verifiedCoreTableCount,
      hasUserRoles: statusMap.user_roles,
      hasProfiles: statusMap.profiles,
      hasProducts: statusMap.products,
      hasProductionOrders: statusMap.production_orders,
      hasSerialNumbers: statusMap.serial_numbers,
      hasWarrantyActivations: statusMap.warranty_activations,
      hasCoreTables,
      errorMessage: hasCoreTables
        ? undefined
        : `Could not verify all core tables (${verifiedCoreTableCount}/${CORE_TABLES.length} checks passed): ${unavailableTables.join(', ')}`
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error while checking core tables.';
    console.error('[DATABASE CORE CHECK ERROR]:', err);
    return unavailableStatus(supabaseUrl, projectRef, message);
  }
}
