/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  UserCheck, 
  History,
  Activity,
  ArrowLeftRight
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  Serial, 
  ServiceCase, 
  ReplacementCase 
} from '../utils/store.ts';

interface ReplacementsViewProps {
  replacements: ReplacementCase[];
  cases: ServiceCase[];
  serials: Serial[];
  brands: Brand[];
  models: ProductModel[];
  lang: Language;
  onAddReplacement: (replacement: Omit<ReplacementCase, 'id' | 'createdAt'>) => void;
  onUpdateReplacementStatus: (id: string, status: ReplacementCase['status'], newSerialId?: string) => void;
  onLogAudit: (action: string, details: string) => void;
}

export default function ReplacementsView({
  replacements,
  cases,
  serials,
  brands,
  models,
  lang,
  onAddReplacement,
  onUpdateReplacementStatus,
  onLogAudit
}: ReplacementsViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'requests';

  // Request form state
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);

  // Filter service cases that are of type 'replacement' or have 'replacement' in notes
  const replacementCasesEligible = cases.filter(
    c => c.type === 'replacement' && 
         !replacements.some(r => r.caseId === c.id)
  );

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;

    const linkedCase = cases.find(c => c.id === selectedCaseId);
    if (!linkedCase) return;

    onAddReplacement({
      caseId: selectedCaseId,
      originalSerialId: linkedCase.serialId,
      status: 'requested',
      reason
    });

    setReason('');
    setSelectedCaseId('');
    setShowRequestForm(false);
    onLogAudit('Replacement Requested', `تم تقديم طلب استبدال للمنتج التالف ذو الرقم التسلسلي ${linkedCase.serialId}`);
  };

  // Helper to check if a serial warranty is valid
  const checkWarrantyValidity = (serialId: string): { active: boolean; valid: boolean; reason: string } => {
    const serial = serials.find(s => s.id === serialId);
    if (!serial) return { active: false, valid: false, reason: 'الرقم التسلسلي غير موجود في النظام' };
    if (!serial.warrantyActive) return { active: false, valid: false, reason: 'الضمان غير مفعل لهذا المنتج' };

    const end = serial.warrantyEnd ? new Date(serial.warrantyEnd) : null;
    const now = new Date();

    if (end && now > end) {
      return { active: true, valid: false, reason: `فترة الضمان انتهت بتاريخ ${serial.warrantyEnd}` };
    }

    return { active: true, valid: true, reason: `ساري حتى ${serial.warrantyEnd}` };
  };

  const handleApproveReplacement = (repId: string, originalSerialId: string) => {
    // Generates a new serial that acts as the replaced serial
    const originalSerial = serials.find(s => s.id === originalSerialId);
    if (!originalSerial) return;

    // Issue a brand new replacement serial
    const year = new Date().getFullYear();
    const randDigits = Math.floor(10000000 + Math.random() * 90000000); // 8 digits
    const replacementSerialId = `SLP-${year}-${randDigits}`;

    onUpdateReplacementStatus(repId, 'approved', replacementSerialId);
    onLogAudit('Replacement Approved', `تمت الموافقة على طلب الاستبدال ${repId}. تم توليد رقم بديل معتمد جديد: ${replacementSerialId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-emerald-600" />
            {t.replacements}
          </h2>
          <p className="text-xs text-slate-500 mt-1">تنظيم ومراجعة تعويضات العملاء وإصدار مراتب بديلة مع الحفاظ على التتبع الزمني الكامل</p>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: 'requests', label: lang === 'ar' ? 'الطلبات' : 'Requests', icon: FileText },
            { id: 'tracking', label: lang === 'ar' ? 'التتبع' : 'Tracking', icon: Activity },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/replacement/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
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

      {/* Replacement authorization instructions / rules summary (Visible on requests) */}
      {currentSubTab === 'requests' && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>{t.replacement_rules} (ضوابط الموثوقية والأمان المالي)</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {lang === 'ar' 
              ? 'بموجب الدستور الفني لـ Sleepee، يحق للمستهلك الاستبدال الفوري في حالة وجود عيب مصنعي جسيم (هبوط يزيد عن ٢ سم، كسر في السوست المانعة للحركة). تحتفظ المنصة بالرقم التسلسلي والتاريخ الكامل للمنتج المسترجع وتصدر كود تسلسلي معتمد بديل يربطه بالملف التعريفي الأصلي للعميل لضمان الشفافية وموثوقية السجلات.'
              : 'In accordance with Sleepee’s quality standards, full replacement is authorized only under active warranty coverage. The platform retains the entire historical trace of the damaged mattress, issues a new certified replacement serial, and links both logs in the system trace.'}
          </p>
        </div>
      )}

      {/* Button to open Request Form (Visible on requests) */}
      {currentSubTab === 'requests' && (
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800">سجل طلبات التعويض والاستبدال المعتمدة</h3>
          <button
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>{t.request_replacement}</span>
          </button>
        </div>
      )}

      {/* Dynamic Request creation form (Visible on requests) */}
      {currentSubTab === 'requests' && showRequestForm && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-5 rounded-2xl shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-150 pb-2">
            تسجيل تذكرة استبدال تالف جديدة
          </h4>
          {/* ... form content ... */}
          {replacementCasesEligible.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              {lang === 'ar' ? 'لا توجد تذاكر شكاوى نشطة مؤهلة للتعويض حالياً. يرجى فتح تذكرة دعم صنف "استبدال" أولاً.' : 'No replacement-type CS tickets available for filing.'}
            </div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 font-semibold">تذكرة خدمة العملاء المرتبطة *</label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    required
                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs"
                  >
                    <option value="">-- اختر تذكرة تالف مؤهلة --</option>
                    {replacementCasesEligible.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.id} - العميل: {c.customerName} (الرقم التسلسلي: {c.serialId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 font-semibold">{t.reason_label} *</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs"
                    placeholder="هبوط جانبي كبير يزيد عن ٣ سم عيب تصنيع بالسوست..."
                  />
                </div>
              </div>

              {/* Real-time warranty checks based on selected case */}
              {selectedCaseId && (() => {
                const c = cases.find(cs => cs.id === selectedCaseId);
                if (!c) return null;
                const check = checkWarrantyValidity(c.serialId);
                return (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    check.valid ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    {check.valid ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                    <div>
                      <span className="font-bold">فحص الضمان التلقائي: </span>
                      <span>{check.reason}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowRequestForm(false)} className="px-3.5 py-1.5 bg-slate-200 rounded hover:bg-slate-300">
                  {t.cancel}
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  {t.submit_replacement}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Replacements grid (Visible on both but maybe filtered in tracking) */}
      <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
        {replacements.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            {lang === 'ar' ? 'لا توجد طلبات استبدال معالجة حالياً.' : 'No replacement cases filed currently.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-600 text-right min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] text-slate-500 font-bold">
                  <th className="p-3">رقم الطلب</th>
                  <th className="p-3">رقم التذكرة</th>
                  <th className="p-3">{t.original_serial}</th>
                  <th className="p-3">{t.new_serial}</th>
                  <th className="p-3">{lang === 'ar' ? 'سبب التالف' : 'Fault description'}</th>
                  <th className="p-3">{t.status}</th>
                  <th className="p-3 text-center w-64">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {replacements.map((rep) => {
                  const check = checkWarrantyValidity(rep.originalSerialId);
                  
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/30">
                      <td className="p-3 font-mono font-bold text-slate-800">{rep.id}</td>
                      <td className="p-3 font-mono text-slate-500">{rep.caseId}</td>
                      <td className="p-3 font-mono font-bold text-red-600 select-all">{rep.originalSerialId}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700 select-all">
                        {rep.newSerialId || (
                          <span className="text-slate-400 font-normal italic">{lang === 'ar' ? 'لم يصدر بعد' : 'Not Issued'}</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={rep.reason}>
                        {rep.reason}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rep.status === 'completed' || rep.status === 'issued' ? 'bg-emerald-50 text-emerald-600' :
                          rep.status === 'denied' ? 'bg-red-50 text-red-600' :
                          rep.status === 'approved' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {t[rep.status as keyof typeof t] || rep.status}
                        </span>
                      </td>
                      <td className="p-3 flex justify-center items-center gap-1.5">
                        {/* Audit Verification badge inside the table */}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mr-1 ${
                          check.valid ? 'bg-emerald-50/50 text-emerald-700 border border-emerald-200' : 'bg-red-50/50 text-red-700 border border-red-200'
                        }`}>
                          {check.valid ? (lang === 'ar' ? 'ضمان سارٍ' : 'Valid') : (lang === 'ar' ? 'منتهي/مفقود' : 'Invalid')}
                        </span>

                        {/* Actions mapping */}
                        {rep.status === 'requested' && (
                          <>
                            <button
                              onClick={() => handleApproveReplacement(rep.id, rep.originalSerialId)}
                              className="px-2.5 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium flex items-center gap-1 shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'اعتماد وصرف بديل' : 'Authorize & Issue'}</span>
                            </button>
                            <button
                              onClick={() => onUpdateReplacementStatus(rep.id, 'denied')}
                              className="px-2.5 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium"
                            >
                              {lang === 'ar' ? 'رفض' : 'Deny'}
                            </button>
                          </>
                        )}

                        {rep.status === 'approved' && (
                          <button
                            onClick={() => onUpdateReplacementStatus(rep.id, 'issued')}
                            className="px-2.5 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                          >
                            {lang === 'ar' ? 'صرف المستند' : 'Mark Issued'}
                          </button>
                        )}

                        {rep.status === 'issued' && (
                          <button
                            onClick={() => onUpdateReplacementStatus(rep.id, 'completed')}
                            className="px-2.5 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium"
                          >
                            {lang === 'ar' ? 'تأكيد الاستلام' : 'Mark Received'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
