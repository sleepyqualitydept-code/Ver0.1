/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Database,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  ShieldAlert
} from 'lucide-react';
import { DatabaseHealthStatus } from '../services/databaseHealthCheck.ts';

interface DatabaseNotDeployedScreenProps {
  health: DatabaseHealthStatus;
  onRetry: () => void;
}

const CORE_TABLES = [
  { key: 'hasUserRoles', name: 'user_roles' },
  { key: 'hasProfiles', name: 'profiles' },
  { key: 'hasProducts', name: 'products' },
  { key: 'hasProductionOrders', name: 'production_orders' },
  { key: 'hasSerialNumbers', name: 'serial_numbers' },
  { key: 'hasWarrantyActivations', name: 'warranty_activations' }
] as const;

export default function DatabaseNotDeployedScreen({ health, onRetry }: DatabaseNotDeployedScreenProps) {
  const [copied, setCopied] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleCopySafeInstructions = async () => {
    const instructions = [
      `Sleepee core-table check for Supabase project: ${health.projectRef}`,
      `Verified core table checks: ${health.tableCount}/6`,
      `Result: ${health.errorMessage || 'Core table checks passed; this is not a full schema certification.'}`,
      'Do not execute historical schema.sql, supabase-schema.sql, or any migration automatically.',
      'First inspect the target project, compare the proposed schema/migrations, prepare a verifiable backup, and obtain explicit approval.'
    ].join('\n');

    try {
      await navigator.clipboard.writeText(instructions);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleRunValidator = async () => {
    setValidating(true);
    try {
      await onRetry();
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans" dir="rtl">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl max-w-3xl w-full p-8 space-y-6">
        <div className="flex items-start gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">تعذّر التحقق من الجداول الأساسية — CORE DATABASE CHECK</h1>
            <p className="text-sm text-amber-100/90 mt-2">
              لا يمكن إكمال الدخول إلى مساحة التشغيل قبل نجاح فحوص الجداول الأساسية. هذا الفحص محدود بستة جداول ولا يثبت اكتمال المخطط بالكامل.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 block text-[10px]">SUPABASE PROJECT URL</span>
            <span className="text-emerald-400 break-all block">{health.projectUrl || 'غير مضبوط'}</span>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 block text-[10px]">PROJECT REFERENCE ID</span>
            <span className="text-indigo-400 font-bold block">{health.projectRef}</span>
          </div>
        </div>

        <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              حالة فحوص الجداول الأساسية
            </h2>
            <span className="px-2.5 py-1 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg text-[10px] font-bold whitespace-nowrap">
              {health.tableCount}/6 تم التحقق
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {CORE_TABLES.map((table) => {
              const verified = health[table.key];
              return (
                <div key={table.key} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <code className="text-slate-200">{table.name}</code>
                  <span className={`flex items-center gap-1 ${verified ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {verified ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {verified ? 'تم التحقق' : 'غير متحقق'}
                  </span>
                </div>
              );
            })}
          </div>
          {health.errorMessage && (
            <p className="text-xs text-amber-200 leading-6">{health.errorMessage}</p>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 space-y-2">
          <h2 className="font-bold text-red-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            إيقاف آمن — لا تشغّل ملفات SQL تلقائيًا
          </h2>
          <p className="text-xs leading-6 text-red-100/90">
            لا تنفّذ ملفات schema التاريخية أو أي migration لمجرد ظهور هذه الشاشة. يجب أولًا فحص مشروع Supabase المستهدف، ومراجعة خطة تأسيس المخطط أو الترحيل، والتحقق من النسخة الاحتياطية، ثم اعتماد التنفيذ صراحةً.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            onClick={handleRunValidator}
            disabled={validating}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${validating ? 'animate-spin' : ''}`} />
            <span>إعادة فحص الجداول</span>
          </button>

          <button
            onClick={handleCopySafeInstructions}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم النسخ' : 'نسخ ملاحظة المراجعة الآمنة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
