/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Factory, 
  ShieldCheck, 
  PhoneCall, 
  RefreshCw, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Sliders
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { ProductionOrder, Serial, ServiceCase, ReplacementCase } from '../utils/store.ts';

interface DashboardViewProps {
  orders: ProductionOrder[];
  serials: Serial[];
  cases: ServiceCase[];
  replacements: ReplacementCase[];
  lang: Language;
  onNavigateTo: (tab: string) => void;
}

export default function DashboardView({ 
  orders, 
  serials, 
  cases, 
  replacements, 
  lang,
  onNavigateTo 
}: DashboardViewProps) {
  const t = translations[lang];

  // Calculated stats
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  const activeOrders = orders.filter(o => o.status === 'in_production' || o.status === 'approved').length;
  const totalSerials = serials.length;
  const activeWarranties = serials.filter(s => s.warrantyActive).length;
  const openCases = cases.filter(c => c.status !== 'closed' && c.status !== 'resolved').length;
  const approvedReplacements = replacements.filter(r => r.status === 'approved').length;

  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  // Recent cases for table
  const recentCases = [...cases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  // Printing status (simulated)
  const pendingPrints = serials.filter(s => s.status === 'generated').length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t.dashboard}</h2>
          <p className="text-sm text-slate-500 mt-1">{t.subTitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-mono">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Oct 5, 2026</span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Production Orders */}
        <div 
          onClick={() => onNavigateTo('production')}
          className="cursor-pointer backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-start"
        >
          <div className="space-y-2">
            <span className="text-xs text-slate-500 font-medium">{t.kpi_orders}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 font-mono">{totalOrders}</span>
              <span className="text-xs text-emerald-600 font-mono font-semibold">+{activeOrders} active</span>
            </div>
            <p className="text-[11px] text-slate-400">{t.kpi_orders_desc}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Factory className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Serials Generated */}
        <div 
          onClick={() => onNavigateTo('production')}
          className="cursor-pointer backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-start"
        >
          <div className="space-y-2">
            <span className="text-xs text-slate-500 font-medium">{t.kpi_serials}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 font-mono">{totalSerials}</span>
              {pendingPrints > 0 && (
                <span className="text-xs text-amber-600 font-mono font-semibold">{pendingPrints} printing</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">{t.kpi_serials_desc}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Printer className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Activated Warranties */}
        <div 
          onClick={() => onNavigateTo('warranty')}
          className="cursor-pointer backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-start"
        >
          <div className="space-y-2">
            <span className="text-xs text-slate-500 font-medium">{t.kpi_warranty}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 font-mono">{activeWarranties}</span>
              <span className="text-xs text-emerald-600 font-mono font-semibold">
                {totalSerials > 0 ? Math.round((activeWarranties / totalSerials) * 100) : 0}% rate
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{t.kpi_warranty_desc}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Open Customer Cases */}
        <div 
          onClick={() => onNavigateTo('cs')}
          className="cursor-pointer backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-start"
        >
          <div className="space-y-2">
            <span className="text-xs text-slate-500 font-medium">{t.kpi_cases}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 font-mono">{openCases}</span>
              <span className="text-xs text-red-500 font-mono font-semibold">{cases.filter(c => c.status === 'open').length} new</span>
            </div>
            <p className="text-[11px] text-slate-400">{t.kpi_cases_desc}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <PhoneCall className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Live Queue Monitor and Case Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Right depending on lang: Queue monitor */}
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <span>{t.printer_status}</span>
              </h3>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span>{t.printer_online}</span>
              </span>
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <Sliders className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">{lang === 'ar' ? 'طابعة باركود زيبرا ZD220' : 'Zebra ZD220 Thermal'}</h4>
                <p className="text-xs text-slate-400 mt-1">USB Connection · Standard 100x100mm label</p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>{lang === 'ar' ? 'الأكواد المجدولة بالصف:' : 'Queued Serials:'}</span>
                <span className="font-bold text-slate-800">{pendingPrints}</span>
              </div>
              <div className="flex justify-between">
                <span>{lang === 'ar' ? 'معدل التفعيل الكلي:' : 'Activation rate:'}</span>
                <span className="font-bold text-slate-800">{completionRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>{lang === 'ar' ? 'نوع التغذية:' : 'Ribbon/Media:'}</span>
                <span className="text-emerald-600 font-bold">{lang === 'ar' ? 'حراري مباشر' : 'Direct Thermal'}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => onNavigateTo('printing')}
            className="w-full py-2.5 mt-4 text-xs font-semibold text-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-xl"
          >
            {t.printStation}
          </button>
        </div>

        {/* Support Case tracker */}
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-600" />
              <span>{t.cs_dashboard}</span>
            </h3>
            <button 
              onClick={() => onNavigateTo('cs')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              <span>{lang === 'ar' ? 'عرض الكل' : 'View All'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {recentCases.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {lang === 'ar' ? 'لا توجد تذاكر دعم فني نشطة حالياً.' : 'No active support tickets found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-600 text-right">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] text-slate-400 uppercase">
                    <th className="pb-2">{t.order_id}</th>
                    <th className="pb-2">{lang === 'ar' ? 'العميل' : 'Customer'}</th>
                    <th className="pb-2">{t.case_type}</th>
                    <th className="pb-2">{t.status}</th>
                    <th className="pb-2">{lang === 'ar' ? 'التوقيت' : 'Time'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentCases.map((csCase) => (
                    <tr key={csCase.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-mono font-bold text-slate-800">{csCase.id}</td>
                      <td className="py-3">{csCase.customerName}</td>
                      <td className="py-3 text-xs">
                        {t[`case_type_${csCase.type}` as keyof typeof t] || csCase.type}
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          csCase.status === 'resolved' || csCase.status === 'closed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {t[`case_status_${csCase.status}` as keyof typeof t] || csCase.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs font-mono text-slate-400">
                        {new Date(csCase.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
