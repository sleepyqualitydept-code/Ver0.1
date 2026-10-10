/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileBarChart2, 
  Download, 
  Filter, 
  Layers, 
  Activity, 
  CheckCircle2, 
  PhoneCall, 
  TrendingUp,
  Sliders,
  RefreshCw,
  Printer,
  ShieldCheck
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  Serial, 
  ServiceCase, 
  ProductionOrder 
} from '../utils/store.ts';

interface ReportsViewProps {
  orders: ProductionOrder[];
  serials: Serial[];
  cases: ServiceCase[];
  brands: Brand[];
  models: ProductModel[];
  lang: Language;
}

export default function ReportsView({
  orders,
  serials,
  cases,
  brands,
  models,
  lang
}: ReportsViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'production';

  // Filters state
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Filtered lists
  const filteredOrders = orders.filter(o => {
    const matchBrand = selectedBrandFilter === 'all' || o.brandId === selectedBrandFilter;
    const matchCat = selectedCategoryFilter === 'all' || o.category === selectedCategoryFilter;
    return matchBrand && matchCat;
  });

  const filteredSerials = serials.filter(s => {
    const matchBrand = selectedBrandFilter === 'all' || s.brandId === selectedBrandFilter;
    const matchCat = selectedCategoryFilter === 'all' || s.category === selectedCategoryFilter;
    return matchBrand && matchCat;
  });

  // Export helper (generates actual downloadable CSV)
  const triggerCSVDownload = (dataType: 'production' | 'warranty' | 'cs') => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (dataType === 'production') {
      filename = `sleepee-production-orders-${new Date().getFullYear()}.csv`;
      headers = ['Order ID', 'Type', 'Category', 'Brand', 'Model', 'Size', 'Qty', 'Status', 'Date'];
      rows = orders.map(o => [
        o.id,
        o.type,
        o.category,
        brands.find(b => b.id === o.brandId)?.nameEn || o.brandId,
        models.find(m => m.id === o.modelId)?.name || o.modelId,
        o.size,
        o.quantity.toString(),
        o.status,
        new Date(o.createdAt).toLocaleDateString()
      ]);
    } else if (dataType === 'warranty') {
      filename = `sleepee-warranty-registry-${new Date().getFullYear()}.csv`;
      headers = ['Serial ID', 'Category', 'Brand', 'Model', 'Size', 'Status', 'Active', 'Duration (Years)', 'Start', 'End', 'Customer Name', 'Phone', 'Governorate'];
      rows = serials.map(s => [
        s.id,
        s.category,
        brands.find(b => b.id === s.brandId)?.nameEn || s.brandId,
        models.find(m => m.id === s.modelId)?.name || s.modelId,
        s.size,
        s.status,
        s.warrantyActive ? 'YES' : 'NO',
        s.warrantyDurationYears?.toString() || '-',
        s.warrantyStart || '-',
        s.warrantyEnd || '-',
        s.customerName || '-',
        s.customerPhone || '-',
        s.customerGovernorate || '-'
      ]);
    } else {
      filename = `sleepee-support-cases-${new Date().getFullYear()}.csv`;
      headers = ['Case ID', 'Serial ID', 'Type', 'Status', 'Assignee', 'Customer Name', 'Phone', 'Date'];
      rows = cases.map(c => [
        c.id,
        c.serialId,
        c.type,
        c.status,
        c.assignee,
        c.customerName,
        c.customerPhone,
        new Date(c.createdAt).toLocaleDateString()
      ]);
    }

    // Process raw CSV rows with BOM for proper Excel Arabic rendering
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Aggregation of orders by Brand
  const brandVolumes = brands.map(b => {
    const qty = orders.filter(o => o.brandId === b.id).reduce((sum, o) => sum + o.quantity, 0);
    return { name: lang === 'ar' ? b.nameAr : b.nameEn, qty };
  });

  const maxVolume = Math.max(...brandVolumes.map(bv => bv.qty), 1);

  // Aggregation of complaints reasons
  const complaintReasons = [
    { labelAr: 'هبوط بالمرتبة', labelEn: 'Sinking', count: cases.filter(c => c.notes.includes('هبوط')).length },
    { labelAr: 'كسر السوست', labelEn: 'Broken Spring', count: cases.filter(c => c.notes.includes('سوست') || c.notes.includes('كسر')).length },
    { labelAr: 'تلف القماش الخارجي', labelEn: 'Fabric wear', count: cases.filter(c => c.notes.includes('قماش') || c.notes.includes('تلف')).length },
    { labelAr: 'أخرى واستفسار', labelEn: 'Other / Inquiries', count: cases.filter(c => c.type === 'inquiry' || c.type === 'other').length },
  ];

  const maxReason = Math.max(...complaintReasons.map(r => r.count), 1);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-emerald-600" />
            {t.reports}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.reporting_engine}</p>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
          {[
            { id: 'production', label: lang === 'ar' ? 'الإنتاج' : 'Production', icon: Layers },
            { id: 'warranty', label: lang === 'ar' ? 'الضمان' : 'Warranty', icon: ShieldCheck },
            { id: 'service', label: lang === 'ar' ? 'الخدمة' : 'Service', icon: PhoneCall },
            { id: 'replacement', label: lang === 'ar' ? 'الاستبدال' : 'Replacement', icon: RefreshCw },
            { id: 'printing', label: lang === 'ar' ? 'الطباعة' : 'Printing', icon: Printer },
            { id: 'management', label: lang === 'ar' ? 'الإدارة' : 'Management', icon: TrendingUp },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/reports/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentSubTab === st.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <st.icon className="w-3.5 h-3.5" />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Toolbar (Visible on all analytical sub-tabs) */}
      {currentSubTab !== 'printing' && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>{t.filter_by}:</span>
          </div>

          {/* Brand selection */}
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-slate-400">{t.brand_label}:</label>
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="bg-white border border-slate-200/80 rounded-lg p-1.5 text-slate-700 outline-none"
            >
              <option value="all">{lang === 'ar' ? 'جميع العلامات' : 'All Brands'}</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{lang === 'ar' ? b.nameAr : b.nameEn}</option>
              ))}
            </select>
          </div>

          {/* Category selection */}
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-slate-400">{t.category}:</label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-white border border-slate-200/80 rounded-lg p-1.5 text-slate-700 outline-none"
            >
              <option value="all">{lang === 'ar' ? 'جميع الفئات' : 'All Categories'}</option>
              <option value="Mattresses">{lang === 'ar' ? 'مراتب' : 'Mattresses'}</option>
              <option value="Pillows">{lang === 'ar' ? 'مخدات' : 'Pillows'}</option>
              <option value="Cushions">{lang === 'ar' ? 'خداديات' : 'Cushions'}</option>
              <option value="Protective Covers">{lang === 'ar' ? 'أغطية واقية' : 'Protective Covers'}</option>
              <option value="Accessories">{lang === 'ar' ? 'إكسسوارات' : 'Accessories'}</option>
              <option value="Beds">{lang === 'ar' ? 'أسرة' : 'Beds'}</option>
            </select>
          </div>
        </div>
      )}

      {/* Analytical Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graph 1: Production Run Volumes by Brand */}
        {(currentSubTab === 'production' || currentSubTab === 'management') && (
          <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              {t.chart_production_volume}
            </h3>
            <div className="space-y-3 pt-2">
              {brandVolumes.map((bv, idx) => {
                const percentage = Math.round((bv.qty / maxVolume) * 100);
                return (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-700">{bv.name}</span>
                      <span className="font-mono text-slate-500">{bv.qty} {lang === 'ar' ? 'قطعة' : 'pcs'}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Graph 2: Complaints & CS Quality Triggers */}
        {(currentSubTab === 'service' || currentSubTab === 'management') && (
          <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              {t.chart_complaint_reasons}
            </h3>
            <div className="space-y-3 pt-2">
              {complaintReasons.map((cr, idx) => {
                const percentage = Math.round((cr.count / maxReason) * 100);
                return (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-700">{lang === 'ar' ? cr.labelAr : cr.labelEn}</span>
                      <span className="font-mono text-slate-500">{cr.count} {lang === 'ar' ? 'شكوى' : 'cases'}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Export Desk Panel (Visible on all but management/printing) */}
      {(currentSubTab === 'production' || currentSubTab === 'warranty' || currentSubTab === 'service' || currentSubTab === 'replacement') && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
           {/* ... export desk remains ... */}
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <Download className="w-4.5 h-4.5 text-emerald-600" />
          <span>منصة تصدير وسجلات الماستر الكلية (فورية وملفات CSV معتمدة)</span>
        </h3>

        <p className="text-xs text-slate-500">
          يمكنك ترحيل وتصدير البيانات الحية المشفرة للنظام إلى ملفات إكسل كاملة للتكامل مع الإدارة المالية أو محاسبة الموزعين المعتمدين:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Download Box 1 */}
          <div className="border border-slate-150 p-4 rounded-xl space-y-3 bg-white/50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>سجل أوامر الإنتاج</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">تصدير جميع أوامر التخطيط والتشغيل المسجلة (draft, completed, cancelled)</p>
            </div>
            <button
              onClick={() => triggerCSVDownload('production')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل ملف CSV</span>
            </button>
          </div>

          {/* Download Box 2 */}
          <div className="border border-slate-150 p-4 rounded-xl space-y-3 bg-white/50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>قاعدة بيانات الضمانات</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">تصدير جميع الكود المسلسلة للضمان والمفعلة لبيانات المستهلكين والمحافظات</p>
            </div>
            <button
              onClick={() => triggerCSVDownload('warranty')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل ملف CSV</span>
            </button>
          </div>

          {/* Download Box 3 */}
          <div className="border border-slate-150 p-4 rounded-xl space-y-3 bg-white/50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-emerald-600" />
                <span>سجل تذاكر الصيانة والشكاوى</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">تصدير تذاكر خدمة العملاء 360 درجة، أسباب التالف والموظفين المسؤولين للفحص</p>
            </div>
            <button
              onClick={() => triggerCSVDownload('cs')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل ملف CSV</span>
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
