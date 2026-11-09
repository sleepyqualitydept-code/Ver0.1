/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Search, CheckCircle2, AlertCircle, FileText, History, Activity, ArrowLeftRight, ClipboardCheck } from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { Brand, ProductModel, Serial, ServiceCase, ReplacementCase } from '../utils/store.ts';
import { supabase } from '../lib/supabase.ts';

interface ReplacementsViewProps {
  replacements: ReplacementCase[];
  cases: ServiceCase[];
  serials: Serial[];
  brands: Brand[];
  models: ProductModel[];
  lang: Language;
  currentRole: string;
  onAddReplacement: (replacement: Omit<ReplacementCase, 'id' | 'createdAt'>) => Promise<void> | void;
  onUpdateReplacementStatus: (id: string, status: ReplacementCase['status'], newSerialId?: string) => Promise<void> | void;
  onLogAudit: (action: string, details: string) => void;
}

export default function ReplacementsView({ replacements, cases, serials, brands: _brands, models: _models, lang, currentRole, onAddReplacement, onUpdateReplacementStatus, onLogAudit }: ReplacementsViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();
  const currentSubTab = location.pathname.split('/')[2] || 'requests';
  const canRequestReplacement = ['Administrator', 'Customer Service User'].includes(currentRole);
  const canManageLifecycle = currentRole === 'Administrator';
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [reason, setReason] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warrantySnapshots, setWarrantySnapshots] = useState<Array<{ serial_id: string; warranty_end_date: string; duration_years: number }>>([]);
  const [warrantyLookup, setWarrantyLookup] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    const loadWarrantySnapshots = async () => {
      if (!supabase) { if (active) setWarrantyLookup('error'); return; }
      try {
        const { data, error } = await supabase.from('warranty_activations').select('serial_id, warranty_end_date, duration_years');
        if (error) throw error;
        if (active) {
          setWarrantySnapshots((data || []).map((row: any) => ({ serial_id: row.serial_id, warranty_end_date: row.warranty_end_date, duration_years: Number(row.duration_years) })));
          setWarrantyLookup('ready');
        }
      } catch (error) {
        console.warn('[REPLACEMENT WARRANTY LOOKUP] Could not verify immutable warranty snapshots.', error);
        if (active) setWarrantyLookup('error');
      }
    };
    void loadWarrantySnapshots();
    return () => { active = false; };
  }, []);

  const linkedServiceCaseIds = useMemo(() => new Set(replacements.map((r) => r.serviceCaseId).filter(Boolean)), [replacements]);
  const replacementCasesEligible = cases.filter((c) => c.type === 'replacement' && !linkedServiceCaseIds.has(c.id));

  const checkWarrantyValidity = (serialId: string): { active: boolean; valid: boolean; reason: string } => {
    if (!serials.some((serial) => serial.id === serialId)) {
      return { active: false, valid: false, reason: 'الرقم التسلسلي غير موجود في البيانات المحملة' };
    }
    if (warrantyLookup === 'loading') return { active: false, valid: false, reason: 'جارٍ التحقق من سجل الضمان الثابت…' };
    if (warrantyLookup === 'error') return { active: false, valid: false, reason: 'تعذر قراءة سجل الضمان؛ لم يتم تأكيد الأهلية' };
    const activation = warrantySnapshots.find((item) => item.serial_id === serialId);
    if (!activation) return { active: false, valid: false, reason: 'لا يوجد تفعيل ضمان مسجل لهذا الرقم التسلسلي' };
    const end = new Date(`${activation.warranty_end_date}T23:59:59`);
    if (!activation.warranty_end_date || Number.isNaN(end.getTime())) {
      return { active: true, valid: false, reason: 'سجل الضمان موجود لكن تاريخ النهاية غير صالح؛ يلزم التحقق' };
    }
    if (Date.now() > end.getTime()) return { active: true, valid: false, reason: `فترة الضمان انتهت بتاريخ ${activation.warranty_end_date}` };
    return { active: true, valid: true, reason: `ساري حتى ${activation.warranty_end_date} (${activation.duration_years} سنة في اللقطة الأصلية)` };
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!selectedCaseId) return;
    const linkedCase = cases.find((c) => c.id === selectedCaseId);
    if (!linkedCase) { setErrorMessage('تذكرة خدمة العملاء المختارة غير موجودة.'); return; }
    if (!reason.trim()) { setErrorMessage('يرجى إدخال سبب الاستبدال.'); return; }
    setFormBusy(true);
    try {
      await onAddReplacement({
        serviceCaseId: linkedCase.id,
        caseId: linkedCase.caseNumber || linkedCase.case_number || linkedCase.id,
        originalSerialId: linkedCase.serialId,
        status: 'requested',
        reason: reason.trim()
      });
      setReason('');
      setSelectedCaseId('');
      setShowRequestForm(false);
      onLogAudit('Replacement Requested', `تم تقديم طلب استبدال للتذكرة ${linkedCase.caseNumber || linkedCase.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر إنشاء طلب الاستبدال.');
    } finally {
      setFormBusy(false);
    }
  };

  const runTransition = async (rep: ReplacementCase, status: ReplacementCase['status']) => {
    setErrorMessage('');
    setBusyRequestId(rep.id);
    try {
      await onUpdateReplacementStatus(rep.id, status);
      onLogAudit('UPDATE_REPLACEMENT_STATUS', `Updated Replacement ${rep.id} to ${status}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذر تحديث حالة طلب الاستبدال.');
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2"><RefreshCw className="w-6 h-6 text-emerald-600" />{t.replacements}</h2>
          <p className="text-xs text-slate-500 mt-1">تنظيم ومراجعة طلبات الاستبدال مع حفظ الربط بين التذكرة والرقمين التسلسليين.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: 'requests', label: lang === 'ar' ? 'الطلبات' : 'Requests', icon: FileText },
            { id: 'tracking', label: lang === 'ar' ? 'التتبع' : 'Tracking', icon: Activity }
          ].map((tab) => <button key={tab.id} onClick={() => navigate(`/replacement/${tab.id}`)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${currentSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span></button>)}
        </div>
      </div>

      {currentSubTab === 'requests' && <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100"><Activity className="w-4 h-4 text-emerald-600" /><span>{t.replacement_rules}</span></h3>
        <p className="text-xs text-slate-500 leading-relaxed">{lang === 'ar' ? 'يحتفظ النظام بالرقم التسلسلي الأصلي وتاريخ الطلب ويربطه بتذكرة خدمة العملاء. لا يتم توليد رقم بديل من المتصفح؛ يجب اختيار سجل تسلسلي موجود في قاعدة البيانات عند الاعتماد.' : 'The original serial and service case are retained. Replacement approval must link an existing database serial; the browser never invents a replacement serial.'}</p>
      </div>}

      {currentSubTab === 'requests' && canRequestReplacement && <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800">سجل طلبات الاستبدال</h3>
        <button onClick={() => { setErrorMessage(''); setShowRequestForm((show) => !show); }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md"><ArrowLeftRight className="w-4 h-4" /><span>{t.request_replacement}</span></button>
      </div>}

      {errorMessage && <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">{errorMessage}</div>}

      {currentSubTab === 'requests' && canRequestReplacement && showRequestForm && <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">تسجيل طلب استبدال مرتبط بتذكرة خدمة العملاء</h4>
        {replacementCasesEligible.length === 0 ? <div className="text-center py-6 text-xs text-slate-400">{lang === 'ar' ? 'لا توجد تذاكر من نوع استبدال غير مرتبطة بطلب استبدال.' : 'No unlinked replacement-type service cases are available.'}</div> : <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1"><label className="text-slate-500 font-semibold">تذكرة خدمة العملاء *</label><select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)} required className="bg-white border border-slate-200 rounded-lg p-2 text-xs"><option value="">-- اختر تذكرة مؤهلة --</option>{replacementCasesEligible.map((c) => <option key={c.id} value={c.id}>{c.caseNumber || c.case_number || c.id} — العميل: {c.customerName} (الرقم التسلسلي: {serials.find((s) => s.id === c.serialId)?.serialNumber || serials.find((s) => s.id === c.serialId)?.serial_number || c.serialId})</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-slate-500 font-semibold">{t.reason_label} *</label><input type="text" required value={reason} onChange={(e) => setReason(e.target.value)} className="bg-white border border-slate-200 rounded-lg p-2 text-xs" placeholder="اكتب سبب العيب كما ورد من التذكرة/المعاينة" maxLength={2000} /></div>
          </div>
          {selectedCaseId && (() => { const serviceCase = cases.find((c) => c.id === selectedCaseId); if (!serviceCase) return null; const check = checkWarrantyValidity(serviceCase.serialId); return <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${check.valid ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}><span>{check.valid ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}</span><div><span className="font-bold">فحص معلومات الضمان: </span><span>{check.reason}</span><div className="mt-1 text-[10px]">هذا عرض معلوماتي؛ اعتماد الاستبدال النهائي يجب أن يخضع للصلاحيات وسياسة العمل المعتمدة.</div></div></div>; })()}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100"><button type="button" onClick={() => setShowRequestForm(false)} disabled={formBusy} className="px-3.5 py-1.5 bg-slate-200 rounded hover:bg-slate-300">{t.cancel}</button><button type="submit" disabled={formBusy} className="px-4 py-1.5 bg-emerald-600 disabled:opacity-50 text-white rounded hover:bg-emerald-700">{formBusy ? 'جارٍ الحفظ…' : t.submit_replacement}</button></div>
        </form>}
      </div>}

      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        {replacements.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">{lang === 'ar' ? 'لا توجد طلبات استبدال.' : 'No replacement requests found.'}</div> : <div className="overflow-x-auto"><table className="w-full text-sm text-slate-600 text-right min-w-[1080px]"><thead><tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] text-slate-500 font-bold"><th className="p-3">رقم الطلب</th><th className="p-3">رقم التذكرة</th><th className="p-3">{t.original_serial}</th><th className="p-3">{t.new_serial}</th><th className="p-3">{lang === 'ar' ? 'سبب الطلب' : 'Reason'}</th><th className="p-3">{t.status}</th><th className="p-3 text-center">{t.actions}</th></tr></thead><tbody className="divide-y divide-slate-100">{replacements.map((rep) => {
          const warranty = checkWarrantyValidity(rep.originalSerialId);
          return <tr key={rep.id} className="hover:bg-slate-50/30 align-top">
            <td className="p-3 font-mono font-bold text-slate-800">{rep.request_number || rep.id}</td>
            <td className="p-3 font-mono text-slate-500">{rep.caseNumber || rep.caseId || '—'}</td>
            <td className="p-3 font-mono font-bold text-red-600 select-all">{rep.originalSerialNumber || rep.originalSerialId}</td>
            <td className="p-3 font-mono font-bold text-emerald-700 select-all">{rep.newSerialNumber || (lang === 'ar' ? 'لم يخصص بعد' : 'Not assigned')}</td>
            <td className="p-3 text-slate-600 max-w-xs" title={rep.reason}>{rep.reason}</td>
            <td className="p-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rep.status === 'completed' || rep.status === 'issued' ? 'bg-emerald-50 text-emerald-700' : rep.status === 'approved' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{t[`replacement_${rep.status}` as keyof typeof t] || t[rep.status as keyof typeof t] || rep.status}</span><div className={`mt-1 text-[10px] ${warranty.valid ? 'text-emerald-700' : 'text-slate-400'}`}>{warranty.valid ? (lang === 'ar' ? 'الضمان مفعّل بحسب البيانات الحالية' : 'Warranty currently shown active') : (lang === 'ar' ? 'الضمان غير مثبت في بيانات الواجهة' : 'Warranty not confirmed in loaded data')}</div></td>
            <td className="p-3 min-w-[250px]"><div className="flex flex-col gap-2">
              {canManageLifecycle && rep.status === 'requested' && <button disabled={busyRequestId === rep.id} onClick={() => void runTransition(rep, 'under_review')} className="px-2.5 py-1.5 text-xs text-white bg-blue-600 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-1"><Search className="w-3.5 h-3.5" />{lang === 'ar' ? 'بدء المراجعة' : 'Start review'}</button>}
              {rep.status === 'under_review' && <div className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-5 text-amber-900">{lang === 'ar' ? 'الاعتماد النهائي متوقف لحماية سلامة البيانات؛ ما زال قرار نقل/استمرار الضمان وحالات السيريال عند الاستبدال يحتاج موافقة مالك النظام. لم نغيّر أي سجل تلقائيًا.' : 'Final approval is gated until the owner approves warranty-transfer and serial-status rules. No serial or warranty record is mutated automatically.'}</div>}
              {canManageLifecycle && rep.status === 'approved' && <button disabled={busyRequestId === rep.id} onClick={() => void runTransition(rep, 'issued')} className="px-2.5 py-1.5 text-xs text-white bg-blue-600 disabled:opacity-50 rounded-lg font-medium">{lang === 'ar' ? 'تسجيل صرف البديل' : 'Mark issued'}</button>}
              {canManageLifecycle && rep.status === 'issued' && <button disabled={busyRequestId === rep.id} onClick={() => void runTransition(rep, 'completed')} className="px-2.5 py-1.5 text-xs text-white bg-emerald-600 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" />{lang === 'ar' ? 'تأكيد الاستلام والإكمال' : 'Confirm receipt'}</button>}
              {['completed'].includes(rep.status) && <span className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{lang === 'ar' ? 'مكتمل' : 'Complete'}</span>}
            </div></td>
          </tr>;
        })}</tbody></table></div>}
      </div>
    </div>
  );
}
