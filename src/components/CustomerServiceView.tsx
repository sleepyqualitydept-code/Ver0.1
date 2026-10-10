/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  PhoneCall, 
  Search, 
  Plus, 
  Clock, 
  User, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2, 
  ChevronRight, 
  FileText,
  Bookmark,
  Users
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  Serial, 
  ServiceCase, 
  ProductionOrder,
  Customer
} from '../utils/store.ts';
import { customer360Api } from '../api/customer360Api.ts';
import { serviceAttachmentsApi } from '../api/serviceAttachmentsApi.ts';

interface CustomerServiceViewProps {
  serials: Serial[];
  customers: Customer[];
  cases: ServiceCase[];
  brands: Brand[];
  models: ProductModel[];
  orders: ProductionOrder[];
  lang: Language;
  currentUser: { id: string; email: string; fullName: string | null; role: string } | null;
  onAddCase: (newCase: Omit<ServiceCase, 'id' | 'createdAt' | 'timeline'>) => void;
  onAddTimelineNote: (caseId: string, note: string, actor: string) => void;
  onUpdateCaseStatus: (caseId: string, status: ServiceCase['status']) => void;
}

export default function CustomerServiceView({
  serials,
  customers,
  cases,
  brands,
  models,
  orders,
  lang,
  currentUser,
  onAddCase,
  onAddTimelineNote,
  onUpdateCaseStatus
}: CustomerServiceViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'customers';

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSerial, setSelectedSerial] = useState<Serial | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  
  // Case logging form
  const [showForm, setShowForm] = useState<boolean>(false);
  const [caseType, setCaseType] = useState<ServiceCase['type']>('complaint');
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [caseNotes, setCaseNotes] = useState<string>('');

  // Add timeline note
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [activeCaseIdForNote, setActiveCaseIdForNote] = useState<string>('');
  const [uploadingCaseId, setUploadingCaseId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!selectedSerial) {
      setTimelineEvents([]);
      return;
    }
    setTimelineLoading(true);
    customer360Api.getTimeline(selectedSerial.id)
      .then(events => { if (!cancelled) setTimelineEvents(events); })
      .catch(error => console.error('[CUSTOMER 360] Timeline load failed', error))
      .finally(() => { if (!cancelled) setTimelineLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSerial]);

  const handleSearch = () => {
    setHasSearched(true);
    setShowForm(false);
    
    if (!searchQuery.trim()) {
      setSelectedSerial(null);
      return;
    }

    const query = searchQuery.trim().toUpperCase();
    const customer = customers.find(c =>
      c.phone === searchQuery.trim() ||
      c.alternativePhone === searchQuery.trim() ||
      c.fullName.toUpperCase() === query
    );
    const found = serials.find(s =>
      (s.serialNumber || s.serial_number || '').toUpperCase() === query ||
      s.id.toUpperCase() === query ||
      (!!customer && s.customerPhone === customer.phone)
    );

    setSelectedSerial(found || null);
  };

  // Create a support ticket
  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSerial) return;

    const selectedCustomer = customers.find(c => c.phone === selectedSerial.customerPhone) ||
      (selectedSerial.customerName ? customers.find(c => c.fullName === selectedSerial.customerName) : undefined);
    if (!selectedCustomer || !currentUser) {
      alert(lang === 'ar' ? 'لا توجد بيانات عميل موثقة لهذا المنتج. يجب اختيار/إنشاء عميل حقيقي قبل فتح التذكرة.' : 'A verified customer and authenticated user are required before opening a service case.');
      return;
    }

    onAddCase({
      serialId: selectedSerial.id,
      customerId: selectedCustomer.id,
      type: caseType,
      status: 'open',
      assignee: currentUser.fullName || currentUser.email,
      customerName: selectedCustomer.fullName,
      customerPhone: selectedCustomer.phone,
      notes: caseNotes,
      subject: caseNotes.slice(0, 80)
    } as any);

    setCaseNotes('');
    setShowForm(false);
  };

  const handleAddNote = (caseId: string) => {
    if (!newNoteText.trim()) return;
    onAddTimelineNote(caseId, newNoteText, currentUser?.fullName || currentUser?.email || 'System');
    setNewNoteText('');
  };

  // Get all support cases associated with active serial
  const activeCases = selectedSerial ? cases.filter(c => c.serialId === selectedSerial.id) : [];

  // Customer 360 timeline is database-backed: serial history + warranty + service + replacement.
  const renderTraceTimeline = (_serial: Serial) => {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>{t.timeline_title}</span>
        </h4>

        {timelineLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">{lang === 'ar' ? 'جاري تحميل سجل الحركة من قاعدة البيانات...' : 'Loading live traceability timeline...'}</div>
        ) : timelineEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">{lang === 'ar' ? 'لا توجد أحداث مسجلة لهذا المنتج.' : 'No recorded events for this serial.'}</div>
        ) : (
          <div className="relative pr-4 border-r border-slate-200 space-y-5 mr-2">
            {timelineEvents.map((ev: any) => (
              <div key={ev.id} className="relative">
                <span className="absolute -right-6.5 top-1 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full" />
                <div className="text-xs">
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-bold text-slate-800">{ev.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{new Date(ev.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
                  </div>
                  {ev.description && <p className="text-slate-500 mt-1">{ev.description}</p>}
                  <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5 bg-slate-100 text-slate-700">{ev.badge}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-emerald-600" />
            {t.customerService}
          </h2>
          <p className="text-xs text-slate-500 mt-1">خدمة عملاء 360 درجة، تتبع الشكاوى والصيانة الميدانية والأكواد من المصنع للمستهلك</p>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: 'customers', label: lang === 'ar' ? 'سجل العملاء' : 'Customer 360', icon: Users },
            { id: 'cases', label: lang === 'ar' ? 'تذاكر الخدمة' : 'Service Cases', icon: Bookmark },
            { id: 'timeline', label: lang === 'ar' ? 'المخطط الزمني' : 'Timeline', icon: Clock },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/customer-service/${st.id}`)}
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

      {/* Global Lookup Search (Visible on customers and cases) */}
      {(currentSubTab === 'customers' || currentSubTab === 'cases') && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'ar' ? 'ابحث برقم هاتف العميل، أو الكود التسلسلي للمنتج...' : 'Search by phone number or product serial...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full bg-white border border-slate-200/80 rounded-xl py-2.5 pr-11 pl-4 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              onClick={handleSearch}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-600/15"
            >
              {t.search_btn}
            </button>
          </div>
        </div>
      )}

      {hasSearched && !selectedSerial && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm text-center py-10 text-slate-400 text-sm">
          {lang === 'ar' ? 'عفواً، لا توجد بيانات للمستهلك أو الرقم الكودي.' : 'No consumer matching criteria found.'}
        </div>
      )}

      {/* Profile & Cases details */}
      {selectedSerial && (currentSubTab === 'customers' || currentSubTab === 'cases') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Consumer 360 profile */}
          <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm lg:col-span-4 space-y-5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <User className="w-4.5 h-4.5 text-emerald-600" />
              <span>ملف تعريف المستهلك 360</span>
            </h3>
            {/* ... profile items ... */}
            <div className="space-y-3.5 text-xs">
              <div className="flex flex-col">
                <span className="text-slate-400">{t.customer_name}:</span>
                <span className="font-bold text-slate-800 text-sm">{selectedSerial.customerName || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">{t.customer_phone}:</span>
                <span className="font-mono text-slate-700">{selectedSerial.customerPhone || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">{lang === 'ar' ? 'العنوان المعتمد:' : 'Shipping Address:'}</span>
                <span className="text-slate-700">{selectedSerial.customerGovernorate} - {selectedSerial.customerCity} - {selectedSerial.customerAddress}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">{t.national_id}:</span>
                <span className="font-mono text-slate-700">{selectedSerial.customerNationalId || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">{t.invoice_no}:</span>
                <span className="font-mono text-slate-700">{selectedSerial.invoiceNo || '-'}</span>
              </div>
            </div>

            {/* Print out warranty certificate button */}
            <button
              onClick={() => window.print()}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              {lang === 'ar' ? 'طباعة شهادة الضمان المعتمدة' : 'Print Warranty Certificate'}
            </button>
          </div>

          {/* Cases board */}
          <div className="lg:col-span-8 space-y-6">
            {/* Service cases linked with serial */}
            <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Bookmark className="w-4.5 h-4.5 text-emerald-600" />
                  <span>تذاكر الدعم الفني المسجلة للمنتج</span>
                </h3>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.new_case_btn}</span>
                </button>
              </div>

              {/* Form to log support case */}
              {showForm && (
                <form onSubmit={handleCreateCase} className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3.5 text-xs text-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 font-semibold">{t.case_type}</label>
                      <select
                        value={caseType}
                        onChange={(e) => setCaseType(e.target.value as ServiceCase['type'])}
                        className="bg-white border border-slate-200 rounded p-1.5 text-xs"
                      >
                        <option value="inquiry">{t.case_type_inquiry}</option>
                        <option value="complaint">{t.case_type_complaint}</option>
                        <option value="warranty">{t.case_type_warranty}</option>
                        <option value="maintenance">{t.case_type_maintenance}</option>
                        <option value="replacement">{t.case_type_replacement}</option>
                        <option value="followup">{t.case_type_followup}</option>
                        <option value="other">{t.case_type_other}</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-500 font-semibold">{t.assignee}</label>
                      <div className="bg-slate-100 border border-slate-200 rounded p-1.5 text-xs text-slate-700">{currentUser?.fullName || currentUser?.email || "-"}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 font-semibold">{lang === 'ar' ? 'محتوى الشكوى أو طلب الفحص:' : 'Request/Complaint details:'}</label>
                    <textarea
                      rows={2}
                      required
                      value={caseNotes}
                      onChange={(e) => setCaseNotes(e.target.value)}
                      className="bg-white border border-slate-200 rounded p-1.5 text-xs resize-none"
                      placeholder="المرتبة بها انخفاض... العميل يطلب الصيانة..."
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-slate-200 rounded hover:bg-slate-300">
                      {t.cancel}
                    </button>
                    <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                      {lang === 'ar' ? 'حفظ وفتح التذكرة' : 'Save Ticket'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tickets details */}
              {activeCases.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  {lang === 'ar' ? 'لا توجد شكاوى أو تذاكر دعم مسجلة.' : 'No logged support tickets.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCases.map(cCase => (
                    <div key={cCase.id} className="border border-slate-150 rounded-xl p-4 space-y-3 bg-white">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-800 text-xs">{cCase.id}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            cCase.status === 'resolved' || cCase.status === 'closed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {t[`case_status_${cCase.status}` as keyof typeof t] || cCase.status}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400">{t.case_type}:</span>
                          <span className="font-semibold text-slate-700 mr-1">
                            {t[`case_type_${cCase.type}` as keyof typeof t] || cCase.type}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">{t.assignee}:</span>
                          <span className="font-semibold text-slate-700 mr-1">{cCase.assignee}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">{lang === 'ar' ? 'التفاصيل:' : 'Details:'}</span>
                          <span className="text-slate-700 mr-1">{cCase.notes}</span>
                        </div>
                      </div>

                      {/* Ticket custom notes timeline */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 block">سجل الإجراءات المتبعة:</span>
                        {cCase.timeline.map(tl => (
                          <div key={tl.id} className="text-[11px] border-r-2 border-slate-200 pr-2 py-0.5 mr-1 bg-slate-50/50 p-1.5 rounded">
                            <span className="font-semibold text-slate-700 block">{tl.note}</span>
                            <span className="text-[9px] text-slate-400 mt-0.5 block">{tl.actor} · {new Date(tl.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>

                      {/* Update ticket status dropdown and add comment */}
                      <div className="flex gap-2 items-center border-t border-slate-100 pt-3 flex-wrap">
                        <label className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer">
                          {uploadingCaseId === cCase.id ? 'جاري الرفع...' : 'إرفاق ملف'}
                          <input type="file" className="hidden" disabled={uploadingCaseId === cCase.id} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { setUploadingCaseId(cCase.id); await serviceAttachmentsApi.upload(cCase.id, file); alert('تم حفظ المرفق في Storage وقاعدة البيانات.'); } catch (err) { console.error('[SERVICE ATTACHMENT]', err); alert('تعذر حفظ المرفق.'); } finally { setUploadingCaseId(''); e.currentTarget.value=''; } }} />
                        </label>
                        <select
                          value={cCase.status}
                          onChange={(e) => onUpdateCaseStatus(cCase.id, e.target.value as ServiceCase['status'])}
                          className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-700 outline-none"
                        >
                          <option value="open">{t.case_status_open}</option>
                          <option value="assigned">{t.case_status_assigned}</option>
                          <option value="inprogress">{t.case_status_inprogress}</option>
                          <option value="resolved">{t.case_status_resolved}</option>
                          <option value="closed">{t.case_status_closed}</option>
                        </select>

                        {/* Add note field */}
                        <div className="flex-1 flex gap-1.5">
                          <input
                            type="text"
                            placeholder={t.add_timeline_note}
                            value={activeCaseIdForNote === cCase.id ? newNoteText : ''}
                            onChange={(e) => {
                              setActiveCaseIdForNote(cCase.id);
                              setNewNoteText(e.target.value);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote(cCase.id)}
                            className="flex-1 bg-white border border-slate-200 rounded p-1.5 text-xs outline-none focus:border-emerald-500"
                          />
                          <button
                            onClick={() => handleAddNote(cCase.id)}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded"
                          >
                            {t.save_note}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Timeline (Timeline SubTab) */}
      {currentSubTab === 'timeline' && selectedSerial && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm">
          {renderTraceTimeline(selectedSerial)}
        </div>
      )}

      {currentSubTab === 'timeline' && !selectedSerial && (
        <div className="backdrop-blur-md bg-white/70 border border-white/40 p-6 rounded-2xl shadow-sm text-center py-10 text-slate-400 text-sm">
          {lang === 'ar' ? 'برجاء البحث عن منتج لعرض مخططه الزمني.' : 'Please search for a product to view its timeline.'}
        </div>
      )}
    </div>
  );
}
