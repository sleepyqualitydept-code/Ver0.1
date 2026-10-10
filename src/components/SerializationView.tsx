/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Hash, 
  Search, 
  Plus, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  History,
  Barcode,
  Layers,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { Serial, ProductionBatch, ProductModel } from '../utils/store.ts';
import { serialNumbersApi } from '../api/serialNumbersApi.ts';

interface SerializationViewProps {
  lang: Language;
  batches: ProductionBatch[];
  models: ProductModel[];
  serials: Serial[];
  onGenerateSerials: (batchId: string) => Promise<void>;
}

export default function SerializationView({
  lang,
  batches,
  models,
  serials,
  onGenerateSerials
}: SerializationViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'generate';

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSerialId, setSelectedSerialId] = useState<string>('');
  const [serialDetails, setSerialDetails] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const subTabs = [
    { id: 'generate', label: lang === 'ar' ? 'توليد الأكواد (Generate)' : 'Generate Serials' },
    { id: 'lifecycle', label: lang === 'ar' ? 'دورة الحياة والتتبع (Lifecycle)' : 'Lifecycle Tracker' },
    { id: 'search', label: lang === 'ar' ? 'البحث والتتبع (Search)' : 'Serial Search' }
  ];

  // Eligible batches for select dropdown
  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const selectedOrder = Array.isArray((selectedBatch as any)?.production_orders)
    ? (selectedBatch as any)?.production_orders[0]
    : (selectedBatch as any)?.production_orders;
  const orderLines: any[] = selectedOrder?.production_order_lines || [];
  
  // Resolve actual quantity from order lines or batch
  const actualBatchQty = orderLines.length > 0 
    ? orderLines.reduce((sum: number, l: any) => sum + (Number(l.quantity) || 0), 0)
    : ((selectedBatch as any)?.quantity || 0);

  // Resolve model name from lines or master catalog
  const resolvedLineModelId = orderLines[0]?.model_id;
  const resolvedModel = models.find(m => m.id === resolvedLineModelId) || orderLines[0]?.models;
  const resolvedModelName = resolvedModel ? (resolvedModel.name_ar || resolvedModel.name_en || resolvedModel.name) : (lang === 'ar' ? 'غير محدد في أمر الإنتاج' : 'Unspecified');

  const isAlreadySerialized = selectedBatch?.status === 'serialized' || selectedBatch?.status === 'printed' || selectedBatch?.status === 'completed';

  // Load detailed serial record when selected
  useEffect(() => {
    if (!selectedSerialId) return;
    let active = true;
    setLoadingHistory(true);
    serialNumbersApi.getById(selectedSerialId)
      .then(data => {
        if (active) {
          setSerialDetails(data);
          setLoadingHistory(false);
        }
      })
      .catch(err => {
        console.error('Error loading serial details:', err);
        if (active) setLoadingHistory(false);
      });
    return () => { active = false; };
  }, [selectedSerialId]);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setErrorMsg(lang === 'ar' ? 'يرجى اختيار دفعة إنتاج متوافقة' : 'Please select a valid production batch');
      return;
    }
    if (isAlreadySerialized) {
      setErrorMsg(lang === 'ar' ? 'تم توليد السيريالات لهذه الدفعة سابقاً' : 'This batch is already serialized');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      await onGenerateSerials(selectedBatchId);
      setSuccessMsg(lang === 'ar' 
        ? `تم توليد أرقام السيريال بنجاح للدفعة (${selectedBatch?.batch_number || selectedBatchId})`
        : `Successfully generated serial numbers for batch (${selectedBatch?.batch_number || selectedBatchId})`
      );
      setSelectedBatchId('');
    } catch (err: any) {
      console.error('[SERIALIZATION ERROR]', err);
      let msg = err.message || '';
      if (msg.includes('ORDER_NOT_READY_FOR_SERIALIZATION')) {
        msg = lang === 'ar'
          ? 'أمر الإنتاج المرتبط بهذه الدفعة غير جاهز للتوليد. يجب أن تكون حالة الأمر معتمد أو قيد الإنتاج.'
          : 'The linked production order is not ready for serialization. Order status must be approved or in_production.';
      }
      setErrorMsg(msg || (lang === 'ar' ? 'حدث خطأ أثناء تنفيذ أمر التوليد' : 'Error generating serial numbers'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [searchResults, setSearchResults] = useState<any[]>(serials);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Sync searchResults when serials prop updates and search is empty
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(serials);
    }
  }, [serials]);

  // Server-side PostgreSQL search query
  useEffect(() => {
    let active = true;
    if (!searchQuery.trim()) {
      setSearchResults(serials);
      return;
    }

    setIsSearching(true);
    serialNumbersApi.search({ query: searchQuery })
      .then(results => {
        if (active) {
          setSearchResults(results);
          setIsSearching(false);
        }
      })
      .catch(err => {
        console.error('[SERVER SEARCH ERROR]', err);
        if (active) setIsSearching(false);
      });

    return () => { active = false; };
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              {t.mod_serialization}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'ar' ? 'محرك التتبع والتوليد الموحد للأرقام التسلسلية (SLP-YYYY-XXXXXXXX)' : 'Global Traceability & Unique Serialization Engine'}
            </p>
          </div>
        </div>

        {/* SubTab Links */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-stretch sm:self-auto justify-center">
          {subTabs.map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/serialization/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentSubTab === st.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Status Banner Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SubTab 1: Generate Serials */}
      {currentSubTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{lang === 'ar' ? 'توليد السيريالات للدفعة' : 'Generate Batch Serials'}</span>
            </h3>

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'دفعة الإنتاج المستهدفة *' : 'Target Production Batch *'}
                </label>
                <select
                  required
                  disabled={batches.length === 0 || isSubmitting}
                  value={selectedBatchId}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono disabled:opacity-50 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{batches.length === 0 ? (lang === 'ar' ? 'لا يوجد دفعات إنتاج' : 'No batches available') : (lang === 'ar' ? 'اختر دفعة الإنتاج...' : 'Select Batch...')}</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number || b.batchNumber || b.id.slice(0, 8)} [{b.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Batch Production Attributes when selected */}
              {selectedBatch && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">{lang === 'ar' ? 'أمر الإنتاج المرتبط:' : 'Linked Order:'}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedOrder?.order_number || (lang === 'ar' ? 'مباشر' : 'Direct')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">{lang === 'ar' ? 'الموديل المعتمد:' : 'Verified Model:'}</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                      {resolvedModelName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span className="text-slate-500 font-semibold">{lang === 'ar' ? 'الكمية المعتمدة للإنتاج:' : 'Actual Production Qty:'}</span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                      {actualBatchQty} {lang === 'ar' ? 'قطعة' : 'pcs'}
                    </span>
                  </div>

                  {isAlreadySerialized && (
                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 rounded-lg text-[11px] font-bold text-center border border-purple-200 dark:border-purple-800">
                      {lang === 'ar' ? '⚠️ تم توليد السيريالات لهذه الدفعة سابقاً' : '⚠️ Batch is already serialized'}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedBatchId || isAlreadySerialized || isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10"
              >
                {isSubmitting ? (
                  <span>{lang === 'ar' ? 'جاري التوليد الاعتمادي...' : 'Generating...'}</span>
                ) : (
                  <>
                    <Hash className="w-4 h-4" />
                    <span>{lang === 'ar' ? `توليد السيريالات عبر RPC` : `Generate Serials via RPC`}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* System Serialized Catalog */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Barcode className="w-4 h-4 text-indigo-600" />
                <span>{lang === 'ar' ? 'قائمة الأكواد التسلسلية المسجلة بالكامل' : 'System Serialized Records'}</span>
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                Total: {serials.length}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0">
                  <tr>
                    <th className="p-3">{t.serial_number}</th>
                    <th className="p-3">{lang === 'ar' ? 'الدفعة' : 'Batch'}</th>
                    <th className="p-3">{t.status}</th>
                    <th className="p-3">{lang === 'ar' ? 'تاريخ التوليد' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {serials.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-400">
                        {lang === 'ar' ? 'لم يتم توليد أي أرقام تسلسلية حتى الآن' : 'No serial numbers generated yet.'}
                      </td>
                    </tr>
                  ) : (
                    serials.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {s.serialNumber || s.serial_number || s.id}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                          {(s as any).production_batches?.batch_number || s.batchId || s.batch_id}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[10px] font-extrabold uppercase">
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">
                          {s.createdAt?.slice(0, 10) || s.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Lifecycle Tracker & Inspection */}
      {currentSubTab === 'lifecycle' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'تتبع دورة حياة السيريال والسجل التاريخي' : 'Serial Lifecycle & Traceability Tracker'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' ? 'سجل الأحداث الاعتمادي المستخرج من جدول serial_history' : 'Authoritative events fetched directly from serial_history'}
              </p>
            </div>

            {/* Select Serial Dropdown for Lifecycle Inspection */}
            <div className="w-full md:w-80">
              <select
                value={selectedSerialId}
                onChange={(e) => setSelectedSerialId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="">{lang === 'ar' ? 'اختر سيريال لمعاينة التتبع...' : 'Select Serial to Inspect...'}</option>
                {serials.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.serialNumber || s.serial_number} [{s.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lifecycle State Machine Workflow Steps Diagram */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {lang === 'ar' ? 'مراحل دورة الحياة الفنية المعتمدة (Lifecycle State Machine):' : 'Official Lifecycle State Machine:'}
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {[
                { label: 'Generated', active: serialDetails?.status === 'generated' || !serialDetails },
                { label: 'Printed', active: serialDetails?.status === 'printed' },
                { label: 'Sold', active: serialDetails?.status === 'sold' },
                { label: 'Activated', active: serialDetails?.status === 'activated' },
                { label: 'Service', active: serialDetails?.status === 'service' },
                { label: 'Replacement', active: serialDetails?.status === 'replacement' },
                { label: 'Closed', active: serialDetails?.status === 'closed' }
              ].map((st, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors ${
                    st.active 
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/20' 
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="block text-[9px] font-mono opacity-80 mb-0.5">Step 0{idx+1}</span>
                  <span>{st.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Serial Details & History Table */}
          {selectedSerialId && (
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6 space-y-6">
              {loadingHistory ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {lang === 'ar' ? 'جاري تحميل السجل التاريخي...' : 'Loading history events...'}
                </div>
              ) : serialDetails ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Serial Details Attributes */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 text-xs">
                    <h4 className="font-extrabold text-slate-800 dark:text-white border-b pb-2 flex items-center justify-between">
                      <span>{lang === 'ar' ? 'بيانات الرمز التسلسلي' : 'Serial Record'}</span>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-mono rounded font-bold uppercase text-[10px]">
                        {serialDetails.status}
                      </span>
                    </h4>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{lang === 'ar' ? 'رقم السيريال:' : 'Serial Number:'}</span>
                        <span className="font-mono font-black text-indigo-600">{serialDetails.serial_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{lang === 'ar' ? 'الدفعة:' : 'Batch:'}</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {serialDetails.production_batches?.batch_number || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{lang === 'ar' ? 'أمر الإنتاج:' : 'Order:'}</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {serialDetails.production_batches?.production_orders?.order_number || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{lang === 'ar' ? 'الموديل:' : 'Model:'}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {serialDetails.models?.name_ar || serialDetails.models?.name_en || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{lang === 'ar' ? 'تاريخ التوليد:' : 'Production Date:'}</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">
                          {serialDetails.production_date || serialDetails.created_at?.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Real History Events List */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>{lang === 'ar' ? 'الأحداث المسجلة في serial_history:' : 'Logged History Events:'}</span>
                    </h4>

                    {(!serialDetails.serial_history || serialDetails.serial_history.length === 0) ? (
                      <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-slate-400 text-xs">
                        {lang === 'ar' ? 'حدث توليد أولي مسجل تلقائياً للنظام' : 'Default initial generation event'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {serialDetails.serial_history.map((ev: any, idx: number) => (
                          <div key={ev.id || idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                  {ev.event_type || 'Generated'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {ev.notes || 'Serial record generated successfully'}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              {new Date(ev.event_date || ev.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Serial Search */}
      {currentSubTab === 'search' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث برقم الباركود SLP-2026-XXXXXXXX، الدفعة، أمر الإنتاج، أو الموديل...' : 'Search by serial number SLP-2026-XXXXXXXX, batch, order, or model...'}
              className="w-full bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">{t.serial_number}</th>
                  <th className="p-3">{lang === 'ar' ? 'الدفعة' : 'Batch'}</th>
                  <th className="p-3">{t.model_label}</th>
                  <th className="p-3">{t.status}</th>
                  <th className="p-3">{lang === 'ar' ? 'تاريخ الإنتاج' : 'Date'}</th>
                  <th className="p-3 text-center">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isSearching ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                      {lang === 'ar' ? 'جاري تنفيذ البحث في قاعدة البيانات PostgreSQL...' : 'Searching PostgreSQL database...'}
                    </td>
                  </tr>
                ) : searchResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      {lang === 'ar' ? 'لم يتم العثور على أي سيريال مطابق للبحث' : 'No serials match search query'}
                    </td>
                  </tr>
                ) : (
                  searchResults.map(s => {
                    const batchNo = (s as any).production_batches?.batch_number || s.batchId || s.batch_id || '-';
                    const modelName = (s as any).models?.name_ar || (s as any).models?.name_en || s.modelId || '-';

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {s.serialNumber || s.serial_number || s.id}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                          {batchNo}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-200 font-medium">
                          {modelName}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-extrabold uppercase">
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">
                          {s.createdAt?.slice(0, 10) || s.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => {
                              setSelectedSerialId(s.id);
                              navigate('/serialization/lifecycle');
                            }}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <span>{lang === 'ar' ? 'التتبع الكامل' : 'Trace'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
