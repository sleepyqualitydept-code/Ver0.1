/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { checkDatabaseHealth, DatabaseHealthStatus } from '../services/databaseHealthCheck.ts';
import { Language } from '../utils/translations.ts';

interface DatabaseStatusViewProps {
  lang: Language;
}

const CORE_TABLES = [
  { key: 'hasUserRoles', name: 'user_roles' },
  { key: 'hasProfiles', name: 'profiles' },
  { key: 'hasModels', name: 'models' },
  { key: 'hasProductionOrders', name: 'production_orders' },
  { key: 'hasSerialNumbers', name: 'serial_numbers' },
  { key: 'hasWarrantyActivations', name: 'warranty_activations' }
] as const;

export default function DatabaseStatusView({ lang }: DatabaseStatusViewProps) {
  const [health, setHealth] = useState<DatabaseHealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const runAudit = async () => {
    setLoading(true);
    try {
      const result = await checkDatabaseHealth();
      setHealth(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runAudit();
  }, []);

  const ar = lang === 'ar';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-800">
              {ar ? 'فحص اتصال Supabase والجداول الأساسية' : 'Supabase Connectivity & Core Table Check'}
            </h2>
            <p className="text-xs text-slate-500 font-mono break-all">
              Supabase Project Ref: {health?.projectRef || (loading ? 'loading...' : 'unknown-ref')}
            </p>
          </div>
        </div>
        <button
          onClick={() => void runAudit()}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{ar ? 'إعادة الفحص' : 'Recheck'}</span>
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center text-xs text-slate-400">
          {ar ? 'جارٍ فحص الاتصال وستة جداول أساسية...' : 'Checking connectivity and six core tables...'}
        </div>
      )}

      {!loading && health && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Supabase connection</span>
                {health.isConnected ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-500" />}
              </div>
              <div className="text-lg font-black text-slate-800">{health.isConnected ? (ar ? 'متصل' : 'RESPONDED') : (ar ? 'غير متصل' : 'NOT VERIFIED')}</div>
              <p className="text-[11px] text-slate-500 break-all">{health.projectUrl || (ar ? 'لم يتم ضبط رابط المشروع' : 'Project URL is not configured')}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Core table checks</span>
                {health.hasCoreTables ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="text-2xl font-black font-mono text-slate-800">{health.tableCount} / 6</div>
              <p className="text-[11px] text-slate-500">{ar ? 'جداول أساسية تم التحقق منها فقط، وليس عدد جداول المخطط بالكامل.' : 'Only these six core tables are checked; this is not a full schema inventory.'}</p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-sm space-y-2 ${health.hasCoreTables ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-red-50 border-red-200 text-red-950'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase">{ar ? 'حالة التحقق' : 'Verification status'}</span>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-sm font-black">{health.hasCoreTables ? (ar ? 'نجح الفحص المحدود' : 'CORE CHECK PASSED') : (ar ? 'الفحص غير مكتمل' : 'CORE CHECK INCOMPLETE')}</div>
              <p className="text-[11px] leading-5">{ar ? 'هذا لا يشهد باكتمال Views أو RPC أو RLS أو Storage أو Realtime.' : 'Does not certify Views, RPC, RLS, Storage, or Realtime.'}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800">{ar ? 'تفاصيل الجداول الأساسية' : 'Core table details'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CORE_TABLES.map((table) => {
                const verified = health[table.key];
                return (
                  <div key={table.key} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <code className="text-xs text-slate-700">{table.name}</code>
                    <span className={`flex items-center gap-1 text-xs ${verified ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {verified ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {verified ? (ar ? 'تم التحقق' : 'Verified') : (ar ? 'غير متحقق' : 'Not verified')}
                    </span>
                  </div>
                );
              })}
            </div>
            {health.errorMessage && <p className="text-xs text-amber-800 leading-6">{health.errorMessage}</p>}
          </div>
        </>
      )}
    </div>
  );
}
