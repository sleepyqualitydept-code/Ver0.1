/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  QrCode, 
  Barcode, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  PhoneCall, 
  Building,
  Calendar,
  FileCheck
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { publicPortalApi, PublicWarrantyResult } from '../api/publicPortalApi.ts';

interface PublicPortalViewProps {
  lang: Language;
}

export default function PublicPortalView({ lang }: PublicPortalViewProps) {
  const t = translations[lang];

  const [query, setQuery] = useState<string>('');
  const [searchedSerial, setSearchedSerial] = useState<PublicWarrantyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setHasSearched(true);
    setLoading(true);
    setError(null);
    try {
      const result = await publicPortalApi.verifyWarranty(query.trim());
      setSearchedSerial(result);
    } catch (err: any) {
      console.error('[PUBLIC VERIFY]', err);
      setSearchedSerial(null);
      setError(lang === 'ar' ? 'تعذر الوصول إلى خدمة التحقق حالياً.' : 'Verification service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Public Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            {lang === 'ar' ? 'بوابة تفعيل واستعلام الضمان الرسمية - سليبي' : 'Official Sleepee Public Warranty Verification Portal'}
          </h1>
          <p className="text-xs text-slate-300 max-w-xl mx-auto mt-2">
            {lang === 'ar' ? 'الشركة العربية لصناعة مراتب السوست والإسفنج - خدمة المستهلك المباشرة والتحقق الرقمي من أصالة المنتجات' : 'Arabian Spring & Foam Mattresses Mfg. Company LTD - Direct Consumer Warranty Verification Desk'}
          </p>
        </div>

        {/* Verification Search Bar */}
        <form onSubmit={handleVerify} className="max-w-xl mx-auto flex items-center gap-2 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20">
          <Barcode className="w-6 h-6 text-emerald-400 ml-2" />
          <input
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'أدخل الرقم التسلسلي الكودي SLP-2026-XXXXXXXX...' : 'Enter serial barcode SLP-2026-XXXXXXXX...'}
            className="w-full bg-transparent outline-none text-xs font-mono text-white placeholder-slate-400 p-2"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 whitespace-nowrap"
          >
            {t.search_btn}
          </button>
        </form>
      </div>

      {/* Verification Result Card */}
      {hasSearched && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">{lang === 'ar' ? 'جاري التحقق من قاعدة بيانات الضمان...' : 'Checking the live warranty database...'}</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-rose-600">{error}</div>
          ) : searchedSerial ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      {searchedSerial.warranty_status === 'active' ? (lang === 'ar' ? 'منتج أصلي معتمد - الضمان مفعل وساري' : 'Authentic Sleepee Product - Active Warranty') : searchedSerial.warranty_status === 'expired' ? (lang === 'ar' ? 'الضمان منتهٍ' : 'Warranty Expired') : (lang === 'ar' ? 'المنتج مسجل ولم يتم تفعيل الضمان' : 'Product registered - warranty not activated')}
                    </h3>
                    <p className="text-xs text-emerald-700 font-mono">
                      Serial: {searchedSerial.serial_number}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold font-mono">
                  LIVE DATABASE
                </span>
              </div>

              {/* Product Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{t.brand_label}</span>
                  <span className="text-xs font-bold text-slate-800">{lang === 'ar' ? searchedSerial.brand_name_ar : searchedSerial.brand_name_en}</span>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{t.model_label}</span>
                  <span className="text-xs font-bold text-slate-800">{lang === 'ar' ? searchedSerial.model_name_ar : searchedSerial.model_name_en}</span>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === 'ar' ? 'الفئة' : 'Category'}</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">{lang === 'ar' ? searchedSerial.category_name_ar : searchedSerial.category_name_en}</span>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{t.warranty_duration}</span>
                  <span className="text-xs font-bold text-emerald-700">{searchedSerial.warranty_duration_years ? `${searchedSerial.warranty_duration_years} ${lang === 'ar' ? 'سنوات ضمان' : 'Years Warranty'}` : '-'}</span>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === 'ar' ? 'تاريخ الفاتورة / بداية الضمان' : 'Invoice Date / Warranty Start'}</span>
                  <span className="text-xs font-mono font-bold text-slate-800">{searchedSerial.warranty_start || '-'}</span>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === 'ar' ? 'تاريخ انتهاء الضمان' : 'Warranty End Date'}</span>
                  <span className="text-xs font-mono font-bold text-slate-800">{searchedSerial.warranty_end || '-'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'ar' ? 'الرمز التسلسلي غير مسجل في قاعدة بيانات الضمان' : 'Serial Number Not Found'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {lang === 'ar' ? 'يرجى التأكد من كتابة الرقم التسلسلي الكودي بشكل صحيح أو التواصل مع مركز خدمة العملاء على الخط الساخن 19707' : 'Please verify the serial barcode or contact consumer hotline at 19707.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hotline Support Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PhoneCall className="w-6 h-6 text-emerald-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              {lang === 'ar' ? 'مركز اتصالات خدمة العملاء والدعم الفني المباشر' : 'Customer Service Hotline Support'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {lang === 'ar' ? 'لأي استفسارات أو شكاوى يرجى الاتصال بالخط الساخن' : 'For inquiries or complaints call hotline'}
            </p>
          </div>
        </div>
        <span className="text-lg font-black font-mono text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
          19707
        </span>
      </div>
    </div>
  );
}
