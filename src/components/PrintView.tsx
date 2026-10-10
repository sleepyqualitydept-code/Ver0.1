/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Printer, 
  Settings, 
  Layout, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  RotateCcw,
  Sliders,
  ChevronRight,
  Eye,
  History,
  ListOrdered,
  Search,
  Pause,
  Play,
  XCircle,
  Clock,
  Download,
  Barcode,
  Check,
  Info,
  Layers,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  ProductionBatch, 
  Serial 
} from '../utils/store.ts';
import { printJobsApi, PrintJob, PrintJobStatus } from '../api/printJobsApi.ts';
import { printHistoryApi, PrintHistoryRecord } from '../api/printHistoryApi.ts';
import { labelTemplatesApi, LabelTemplate } from '../api/labelTemplatesApi.ts';
import { serialNumbersApi } from '../api/serialNumbersApi.ts';

interface PrintViewProps {
  batches: ProductionBatch[];
  serials: Serial[];
  brands: Brand[];
  models: ProductModel[];
  lang: Language;
  currentRole?: string;
  onUpdateBatchStatus: (batchId: string, status: ProductionBatch['status']) => Promise<void>;
  onUpdateSerialsStatus: (serialIds: string[], status: Serial['status']) => Promise<void>;
  onLogAudit: (action: string, details: string) => void;
}

export default function PrintView({
  batches,
  serials,
  brands,
  models,
  lang,
  currentRole = 'Administrator',
  onUpdateBatchStatus,
  onUpdateSerialsStatus,
  onLogAudit
}: PrintViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'jobs';

  // Role permissions evaluation
  const isOperatorOrAdmin = ['Administrator', 'Printing Operator'].includes(currentRole);
  const isProductionManager = ['Administrator', 'Printing Operator', 'Production Manager'].includes(currentRole);
  const isReadOnly = ['Warranty Officer', 'Customer Service Agent', 'Service Manager', 'Read Only User'].includes(currentRole);

  // Database-backed states
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [printHistory, setPrintHistory] = useState<PrintHistoryRecord[]>([]);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Global Toast / Banner message state
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [warningMsg, setWarningMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modal / Selection states
  const [isNewJobOpen, setIsNewJobOpen] = useState<boolean>(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState<PrintJob | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedSizeFormat, setSelectedSizeFormat] = useState<'100x50' | '100x100'>('100x100');
  const [copies, setCopies] = useState<number>(1);

  // History & Reprint Search filter states
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [reprintSearchQuery, setReprintSearchQuery] = useState<string>('');
  const [reprintSerialId, setReprintSerialId] = useState<string>('');
  const [reprintReason, setReprintReason] = useState<string>('');
  const [selectedReprintSerial, setSelectedReprintSerial] = useState<any | null>(null);

  // Sub-tabs list
  const subTabs = [
    { id: 'jobs', label: lang === 'ar' ? 'أوامر الطباعة (Print Jobs)' : 'Print Jobs' },
    { id: 'queue', label: lang === 'ar' ? 'صف الانتظار (Print Queue)' : 'Print Queue' },
    { id: 'history', label: lang === 'ar' ? 'سجل الطباعة (Print History)' : 'Print History' },
    { id: 'reprint', label: lang === 'ar' ? 'مركز إعادة الطباعة (Reprint)' : 'Reprint Center' },
    { id: 'status', label: lang === 'ar' ? 'حالة الطابعة (Printer Status)' : 'Printer Status' }
  ];

  // Load database data on mount and location change
  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, historyData, tmplData] = await Promise.all([
        printJobsApi.getAll().catch(() => []),
        printHistoryApi.getAll().catch(() => []),
        labelTemplatesApi.getAll().catch(() => [])
      ]);
      setPrintJobs(jobsData);
      setPrintHistory(historyData);
      setTemplates(tmplData);
    } catch (err) {
      console.error('[PRINT VIEW DATA LOAD ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [location.pathname]);

  // Eligible serialized/printed batches for new job creation
  const eligibleBatches = batches.filter(b => b.status === 'serialized' || b.status === 'printed');
  const selectedBatchObj = batches.find(b => b.id === selectedBatchId);
  const selectedBatchOrder = Array.isArray((selectedBatchObj as any)?.production_orders)
    ? (selectedBatchObj as any)?.production_orders[0]
    : (selectedBatchObj as any)?.production_orders;

  // Filter queue jobs from PostgreSQL (pending, processing, paused, failed)
  const queueJobs = printJobs.filter(j => ['pending', 'processing', 'paused', 'failed'].includes(j.status));

  // Handle Create New Print Job (Status = PENDING, NO AUTOMATIC PRINTING)
  const handleCreatePrintJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProductionManager) {
      setErrorMsg(lang === 'ar' ? 'ليس لديك صلاحية إنشاء أمر طباعة' : 'Permission denied to create print job.');
      return;
    }
    if (!selectedBatchId) {
      setErrorMsg(lang === 'ar' ? 'يرجى اختيار دفعة إنتاج مجهزة للطباعة' : 'Please select an eligible production batch.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);

    try {
      // Create Print Job in PostgreSQL in PENDING status
      const newJob = await printJobsApi.createJob({
        batchId: selectedBatchId,
        templateId: selectedTemplateId || undefined,
        printerName: 'Zebra ZD220 Direct Thermal',
        copies
      });

      onLogAudit('PRINT_REQUESTED', `Created Print Job ${newJob.job_number} for batch ${selectedBatchObj?.batch_number || selectedBatchId} (Status: PENDING)`);

      setSuccessMsg(lang === 'ar' 
        ? `تم إنشاء أمر الطباعة بنجاح برقم (${newJob.job_number}) وإدراجه في صف الانتظار بحالة [معلق - PENDING]!` 
        : `Print job (${newJob.job_number}) created and queued in [PENDING] status!`
      );

      setIsNewJobOpen(false);
      setSelectedBatchId('');
      setSelectedTemplateId('');
      await loadData();
    } catch (err: any) {
      console.error('[CREATE PRINT JOB ERROR]', err);
      setErrorMsg(err.message || (lang === 'ar' ? 'حدث خطأ أثناء إنشاء أمر الطباعة' : 'Failed to create print job.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Explicit "Start Print" Action
  const handleStartPrint = async (jobId: string) => {
    if (!isOperatorOrAdmin) {
      setErrorMsg(lang === 'ar' ? 'ليس لديك صلاحية بدء عملية الطباعة' : 'Permission denied to start print.');
      return;
    }

    setErrorMsg('');
    setWarningMsg('');
    setSuccessMsg('');
    setActionLoading(true);

    try {
      const job = printJobs.find(j => j.id === jobId);
      if (!job) throw new Error('Job not found.');

      // Execute Real Hardware Print (probes printer connectivity before execution)
      const result = await printJobsApi.executePrint(jobId);

      if (result.isOffline) {
        // This release candidate refuses simulated success. Missing SDK/renderer is not described as a real printer-offline test.
        onLogAudit('PRINT_BLOCKED_NOT_VERIFIED', `Print job ${job.job_number} was not executed: ${result.error || 'hardware integration not verified'}`);
        setErrorMsg(lang === 'ar'
          ? `لم يتم تنفيذ الطباعة ولم تتغير حالة الأمر: ${result.error || 'تكامل الطابعة غير متحقق'}`
          : `Printing was not executed and the job state was not changed: ${result.error || 'Printer integration not verified'}`
        );
      } else if (!result.success) {
        // Actual failure during PROCESSING state:
        onLogAudit('PRINT_FAILED', `Failed printing job ${job.job_number}: ${result.error}`);
        setErrorMsg(lang === 'ar'
          ? `فشلت عملية الطباعة أثناء التنفيذ: ${result.error}`
          : `Print execution failed during processing: ${result.error}`
        );
      } else {
        // Successful print execution:
        if (job.batch_id) {
          await onUpdateBatchStatus(job.batch_id, 'printed');
        }
        onLogAudit('PRINT_COMPLETED', `Completed print job ${job.job_number} (${result.printedCount} labels printed)`);
        setSuccessMsg(lang === 'ar'
          ? `اكتملت عملية الطباعة بنجاح! تم إصدار ${result.printedCount} ملصق حراري عبر Zebra ZD220.`
          : `Print execution completed! ${result.printedCount} labels printed on Zebra ZD220.`
        );
      }

      await loadData();
    } catch (err: any) {
      console.error('[START PRINT ERROR]', err);
      setErrorMsg(err.message || (lang === 'ar' ? 'فشلت محاولة بدء الطباعة' : 'Failed to start print.'));
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Pause Job
  const handlePauseJob = async (jobId: string) => {
    try {
      await printJobsApi.pauseJob(jobId);
      onLogAudit('PRINT_PAUSED', `Paused print job ${jobId}`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to pause job.');
    }
  };

  // Handle Resume Job
  const handleResumeJob = async (jobId: string) => {
    try {
      await printJobsApi.resumeJob(jobId);
      onLogAudit('PRINT_RESUMED', `Resumed print job ${jobId}`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resume job.');
    }
  };

  // Handle Cancel Job
  const handleCancelJob = async (jobId: string) => {
    try {
      await printJobsApi.cancelJob(jobId);
      onLogAudit('PRINT_CANCELLED', `Cancelled print job ${jobId}`);
      setSuccessMsg(lang === 'ar' ? 'تم إلغاء أمر الطباعة بنجاح.' : 'Print job cancelled.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel job.');
    }
  };

  // Handle Controlled Single Serial Reprint Execution
  const handleReprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProductionManager) {
      setErrorMsg(lang === 'ar' ? 'ليس لديك صلاحية إجراء إعادة الطباعة' : 'Permission denied to execute reprint.');
      return;
    }
    if (!reprintSerialId) {
      setErrorMsg(lang === 'ar' ? 'يرجى اختيار رمز تسلسلي معتمد للطباعة' : 'Please select a serial number.');
      return;
    }
    if (!reprintReason.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى كتابة سبب إعادة الطباعة لإدراجها في سجل التتبع' : 'Please provide a mandatory reason for reprinting.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);

    try {
      const record = await printHistoryApi.reprintSerial({
        serialId: reprintSerialId,
        reason: reprintReason.trim()
      });

      onLogAudit('REPRINT_EXECUTED', `Reprinted serial ${selectedReprintSerial?.serial_number || reprintSerialId}. Reason: ${reprintReason}`);

      setSuccessMsg(lang === 'ar'
        ? `تم إنشاء وتنفيذ إعادة طباعة الملصق التسلسلي (${selectedReprintSerial?.serial_number || reprintSerialId}) بنجاح عبر Zebra ZD220!`
        : `Successfully recorded reprint for serial label (${selectedReprintSerial?.serial_number || reprintSerialId})!`
      );

      setReprintSerialId('');
      setReprintReason('');
      setSelectedReprintSerial(null);
      await loadData();
    } catch (err: any) {
      console.error('[REPRINT ERROR]', err);
      setErrorMsg(err.message || (lang === 'ar' ? 'فشلت عملية إعادة الطباعة' : 'Reprint failed.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Load reprint serial details when selected
  useEffect(() => {
    if (!reprintSerialId) {
      setSelectedReprintSerial(null);
      return;
    }
    let active = true;
    serialNumbersApi.getById(reprintSerialId)
      .then(data => {
        if (active) setSelectedReprintSerial(data);
      })
      .catch(console.error);
    return () => { active = false; };
  }, [reprintSerialId]);

  // Export History CSV
  const handleExportHistoryCSV = () => {
    if (printHistory.length === 0) return;
    const csvRows = [
      ['Print Job ID', 'Serial Number', 'Batch Number', 'Printer Name', 'Printed At'].join(','),
      ...printHistory.map(h => [
        `"${h.print_job_id}"`,
        `"${h.serial_numbers?.serial_number || h.serial_id}"`,
        `"${h.serial_numbers?.production_batches?.batch_number || 'N/A'}"`,
        `"${h.print_jobs?.printer_name || 'Zebra ZD220'}"`,
        `"${new Date(h.printed_at).toLocaleString()}"`
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sleepee_Print_History_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              {t.mod_printing}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'ar' ? 'إدارة طباعة ملصقات الباركود والحراري المعتمد (Zebra ZD220)' : 'Zebra ZD220 Thermal Label Printing & Queue Management Center'}
            </p>
          </div>
        </div>

        {/* SubTab Links */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-stretch sm:self-auto justify-center overflow-x-auto">
          {subTabs.map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/printing/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
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
      {warningMsg && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{warningMsg}</span>
          </div>
          <button onClick={() => setWarningMsg('')} className="text-amber-600 hover:text-amber-900 dark:text-amber-400">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-900">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SubTab 1: Print Jobs Management */}
      {currentSubTab === 'jobs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'سجل أوامر الطباعة المعتمد (Database Print Jobs)' : 'Print Jobs Catalog'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' ? 'إدارة أوامر طباعة الدفعات في قاعدة البيانات مع تتبع الحالات (Pending → Processing → Printed / Failed)' : 'Manage persistent print jobs in PostgreSQL with state lifecycle tracking'}
              </p>
            </div>

            {isProductionManager && (
              <button
                onClick={() => {
                  setIsNewJobOpen(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إنشاء أمر طباعة جديد' : 'New Print Job'}</span>
              </button>
            )}
          </div>

          {/* Jobs Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {lang === 'ar' ? 'جاري تحميل أوامر الطباعة من قاعدة البيانات...' : 'Loading print jobs from PostgreSQL...'}
              </div>
            ) : printJobs.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Printer className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'لا توجد أوامر طباعة مسجلة حالياً في قاعدة البيانات' : 'No print jobs found in database.'}
                </p>
                {isProductionManager && (
                  <button
                    onClick={() => setIsNewJobOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100"
                  >
                    {lang === 'ar' ? 'إنشاء أول أمر طباعة' : 'Create First Print Job'}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">{lang === 'ar' ? 'رقم أمر الطباعة' : 'Job Number'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الدفعة' : 'Batch'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الطابعة' : 'Printer'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الكمية' : 'Labels'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="p-3">{lang === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</th>
                      <th className="p-3 text-center">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {printJobs.map(job => (
                      <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {job.job_number}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {job.production_batches?.batch_number || job.batch_id?.slice(0, 8) || 'N/A'}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                          {job.printer_name}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {job.total_labels} {lang === 'ar' ? 'ملصق' : 'labels'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            job.status === 'printed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            job.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                            job.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            job.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            job.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                            'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 text-center space-x-1.5 space-x-reverse">
                          <button
                            onClick={() => setSelectedJobDetails(job)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3 text-indigo-600" />
                            <span>{lang === 'ar' ? 'التفاصيل' : 'Details'}</span>
                          </button>

                          {(job.status === 'pending' || job.status === 'failed') && isOperatorOrAdmin && (
                            <>
                              <button
                                onClick={() => handleStartPrint(job.id)}
                                disabled={actionLoading}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                                title="Start print execution via Zebra ZD220"
                              >
                                <Play className="w-3 h-3" />
                                <span>{job.status === 'failed' ? (lang === 'ar' ? 'إعادة المحاولة' : 'Retry Print') : (lang === 'ar' ? 'بدء الطباعة' : 'Start Print')}</span>
                              </button>
                              <button
                                onClick={() => handleCancelJob(job.id)}
                                disabled={actionLoading}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                              </button>
                            </>
                          )}

                          {job.status === 'processing' && isOperatorOrAdmin && (
                            <button
                              onClick={() => handlePauseJob(job.id)}
                              disabled={actionLoading}
                              className="px-2 py-1 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Pause className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
                            </button>
                          )}

                          {job.status === 'paused' && isOperatorOrAdmin && (
                            <button
                              onClick={() => handleResumeJob(job.id)}
                              disabled={actionLoading}
                              className="px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'استئناف' : 'Resume'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SubTab 2: Print Queue */}
      {currentSubTab === 'queue' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'صف انتظار أوامر الطباعة المعتمد (Print Queue)' : 'Active Database Print Queue'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' ? 'الأوامر المجدولة بحالة (Pending / Processing / Paused) المسجلة في PostgreSQL' : 'Database-backed queued jobs waiting for physical Zebra dispatch'}
              </p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full font-mono text-xs font-bold border border-indigo-200/50">
              Queue Count: {queueJobs.length} Jobs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">{lang === 'ar' ? 'رقم الأمر' : 'Job Number'}</th>
                  <th className="p-3">{lang === 'ar' ? 'الدفعة' : 'Batch'}</th>
                  <th className="p-3">{lang === 'ar' ? 'الكمية' : 'Quantity'}</th>
                  <th className="p-3">{lang === 'ar' ? 'الطابعة' : 'Printer'}</th>
                  <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="p-3">{lang === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</th>
                  <th className="p-3 text-center">{lang === 'ar' ? 'إجراء التنفيذ' : 'Queue Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {queueJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      {lang === 'ar' ? 'لا توجد أوامر طباعة معلقة حالياً في صف الانتظار' : 'No pending print jobs in queue.'}
                    </td>
                  </tr>
                ) : (
                  queueJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {job.job_number}
                      </td>
                      <td className="p-3 font-mono text-slate-800 dark:text-slate-200 font-bold">
                        {job.production_batches?.batch_number || job.batch_id?.slice(0, 8) || 'N/A'}
                      </td>
                      <td className="p-3 font-mono text-emerald-600 font-bold">
                        {job.total_labels} {lang === 'ar' ? 'ملصق' : 'pcs'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{job.printer_name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>{lang === 'ar' ? 'الاتصال: غير متصلة (Offline)' : 'Connection: Offline'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          job.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                          job.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          job.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400 text-[10px]">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-center space-x-1.5 space-x-reverse">
                        {(job.status === 'pending' || job.status === 'failed') && isOperatorOrAdmin && (
                          <>
                            <button
                              onClick={() => handleStartPrint(job.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                            >
                              <Play className="w-3 h-3" />
                              <span>{job.status === 'failed' ? (lang === 'ar' ? 'إعادة المحاولة' : 'Retry Print') : (lang === 'ar' ? 'بدء الطباعة' : 'Start Print')}</span>
                            </button>
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              disabled={actionLoading}
                              className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold transition-colors"
                            >
                              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                          </>
                        )}

                        {job.status === 'processing' && isOperatorOrAdmin && (
                          <button
                            onClick={() => handlePauseJob(job.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <Pause className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
                          </button>
                        )}

                        {job.status === 'paused' && isOperatorOrAdmin && (
                          <button
                            onClick={() => handleResumeJob(job.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'استئناف' : 'Resume'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 3: Print History */}
      {currentSubTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'سجل الطباعة المعتمد الدائم (Print History)' : 'Permanent Print Execution History'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' ? 'سجل تاريخي دائم يستخرج مباشرة من جدول print_history دون أي حذف أو استبدال' : 'Permanent immutable log fetched directly from PostgreSQL print_history'}
              </p>
            </div>

            <button
              onClick={handleExportHistoryCSV}
              disabled={printHistory.length === 0}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>
          </div>

          {/* Filter / Search Bar */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'تصفية السجل برقم السيريال، الدفعة، أمر الإنتاج، أو رقم أمر الطباعة...' : 'Search history by serial number, batch, order, or job number...'}
              className="w-full bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 focus:outline-none font-mono"
            />
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">{lang === 'ar' ? 'رمز السيريال' : 'Serial Number'}</th>
                  <th className="p-3">{lang === 'ar' ? 'الدفعة' : 'Batch'}</th>
                  <th className="p-3">{lang === 'ar' ? 'الموديل' : 'Model'}</th>
                  <th className="p-3">{lang === 'ar' ? 'أمر الطباعة' : 'Print Job'}</th>
                  <th className="p-3">{lang === 'ar' ? 'توقيت الطباعة' : 'Printed At'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {printHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      {lang === 'ar' ? 'لم يتم تسجيل أي عمليات طباعة في السجل حتى الآن' : 'No print execution history recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  printHistory
                    .filter(h => {
                      if (!historySearchQuery.trim()) return true;
                      const q = historySearchQuery.toLowerCase();
                      const serial = h.serial_numbers?.serial_number?.toLowerCase() || '';
                      const batch = h.serial_numbers?.production_batches?.batch_number?.toLowerCase() || '';
                      const jobId = h.print_job_id?.toLowerCase() || '';
                      return serial.includes(q) || batch.includes(q) || jobId.includes(q);
                    })
                    .map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {h.serial_numbers?.serial_number || h.serial_id}
                        </td>
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                          {h.serial_numbers?.production_batches?.batch_number || 'N/A'}
                        </td>
                        <td className="p-3 text-slate-800 dark:text-slate-200 font-medium">
                          {h.serial_numbers?.models?.name_ar || h.serial_numbers?.models?.name_en || 'N/A'}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {h.print_job_id?.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">
                          {new Date(h.printed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 4: Reprint Center */}
      {currentSubTab === 'reprint' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>{lang === 'ar' ? 'إعادة طباعة ملصق موجه (Reprint)' : 'Controlled Single Label Reprint'}</span>
            </h3>

            <form onSubmit={handleReprintSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'اختر رمز السيريال المستهدف *' : 'Target Serial Number *'}
                </label>
                <select
                  required
                  value={reprintSerialId}
                  onChange={(e) => {
                    setReprintSerialId(e.target.value);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono"
                >
                  <option value="">{lang === 'ar' ? 'اختر سيريال لإعادة الطباعة...' : 'Select Serial...'}</option>
                  {serials.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.serialNumber || (s as any).serial_number} [{s.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'سبب إعادة الطباعة المعتمد (إجباري للتتبع) *' : 'Mandatory Reprint Reason *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: تلف ملصق الباركود أثناء التغليف أو خطأ في تغذية الشريط...' : 'e.g., Label damaged on assembly line or ribbon smudge...'}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={!reprintSerialId || !reprintReason.trim() || actionLoading || !isProductionManager}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-600/10"
              >
                {actionLoading ? (
                  <span>{lang === 'ar' ? 'جاري التنفيذ...' : 'Processing Reprint...'}</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تنفيذ إعادة الطباعة عبر Zebra' : 'Execute Reprint via Zebra'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Selected Serial Label Preview */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Barcode className="w-4 h-4 text-indigo-600" />
              <span>{lang === 'ar' ? 'معاينة بيانات ملصق الباركود المعتمد قبل إعادة الطباعة' : 'Thermal Label Verification Preview'}</span>
            </h3>

            {selectedReprintSerial ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 max-w-sm mx-auto space-y-4 text-center">
                <div className="border-b pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'الشركة العربية لصناعة المراتب' : 'Arabian Spring & Foam Mattresses'}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Sleepee Quality Guaranteed</p>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedReprintSerial.models?.name_ar || selectedReprintSerial.models?.name_en || 'Standard Product Model'}
                  </p>
                  <p className="font-mono text-indigo-600 font-black text-sm">
                    {selectedReprintSerial.serial_number || selectedReprintSerial.serialNumber}
                  </p>
                  <p className="font-mono text-slate-500 text-[11px]">
                    Batch: {selectedReprintSerial.production_batches?.batch_number || 'N/A'}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2">
                  <div className="w-32 h-10 bg-slate-800 dark:bg-slate-200 rounded flex items-center justify-center text-[10px] font-mono text-white dark:text-slate-900 tracking-widest font-black">
                    |||| || ||||| |||
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Standard Code128 Format</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                {lang === 'ar' ? 'اختر سيريال لمعاينة تفاصيل ملصق الباركود المعتمد' : 'Select a serial number to preview thermal barcode label data.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SubTab 5: Printer Status */}
      {currentSubTab === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'حالة طابعة زيبرا (Zebra ZD220)' : 'Zebra ZD220 Integration Status'}</span>
              </h3>
              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full border border-amber-200/50 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{lang === 'ar' ? 'غير متصلة / في انتظار البوابة' : 'Not Connected / Gateway Offline'}</span>
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'الموديل المعتمد:' : 'Printer Model:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">Zebra ZD220 Direct Thermal</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'الدقة:' : 'Print Resolution:'}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">203 DPI (8 dots/mm)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'مقاسات الملصقات المعتمدة:' : 'Supported Label Sizes:'}</span>
                <span className="font-mono font-bold text-indigo-600">100×50 mm / 100×100 mm</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'أوامر الطباعة في صف الانتظار:' : 'Spooler Queue Length:'}</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">{queueJobs.length} {lang === 'ar' ? 'أمر' : 'jobs'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">{lang === 'ar' ? 'إجمالي السجلات المطبوعة:' : 'Total History Printed:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{printHistory.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Info className="w-5 h-5 text-indigo-600" />
              <span>{lang === 'ar' ? 'إرشادات التكامل الفني مع الطابعة' : 'Zebra Hardware Integration Notice'}</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{lang === 'ar' ? 'يتم التحقق الحقيقي من اتصال طابعة Zebra ZD220 عبر منفذ USB/الشبكة ولا يتم إيهام المستخدم بنجاح الطباعة دون اتصال فيزيائي.' : 'Physical Zebra ZD220 connectivity is strictly verified. No simulated or fake success states are emitted without confirmed printer integration.'}</span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{lang === 'ar' ? 'إنشاء أمر الطباعة يضعه بحالة [معلق - PENDING] في صف الانتظار، ويتطلب نقر (بدء الطباعة) صراحة لبدء المعالجة.' : 'Creating a Print Job queues it in [PENDING] status and requires explicit user action to start printing.'}</span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{lang === 'ar' ? 'تتحول حالة السيريالات والدفعة إلى (PRINTED) فقط عند التأكيد الحقيقي لاكتمال الطباعة.' : 'Batch and serial lifecycle states advance to PRINTED strictly upon confirmed execution.'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Print Job */}
      {isNewJobOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>{lang === 'ar' ? 'إنشاء أمر طباعة جديد للدفعة' : 'Create New Print Job'}</span>
              </h3>
              <button onClick={() => setIsNewJobOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePrintJobSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'اختر دفعة الإنتاج المجهزة للطباعة *' : 'Select Target Serialized Batch *'}
                </label>
                <select
                  required
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono"
                >
                  <option value="">{eligibleBatches.length === 0 ? (lang === 'ar' ? 'لا يوجد دفعات مجهزة للطباعة' : 'No batches ready') : (lang === 'ar' ? 'اختر دفعة...' : 'Select Batch...')}</option>
                  {eligibleBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number || b.batchNumber || b.id.slice(0,8)} [{b.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              {selectedBatchObj && (
                <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'أمر الإنتاج:' : 'Order:'}</span>
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">
                      {selectedBatchOrder?.order_number || 'Direct'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'فئة المنتج المعتمدة:' : 'Category:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedBatchOrder?.production_order_lines?.[0]?.categories?.name_ar 
                        || selectedBatchOrder?.production_order_lines?.[0]?.categories?.name_en 
                        || selectedBatchOrder?.production_order_lines?.[0]?.models?.categories?.name_ar
                        || selectedBatchOrder?.production_order_lines?.[0]?.models?.categories?.name_en
                        || (lang === 'ar' ? 'مراتب وسوست' : 'Mattresses')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'عدد الأكواد التسلسلية:' : 'Available Serials:'}</span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                      {serials.filter(s => (s as any).batch_id === selectedBatchId || s.batchId === selectedBatchId).length} {lang === 'ar' ? 'سيريال' : 'pcs'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'ar' ? 'طابعة الباركود *' : 'Target Printer *'}
                  </label>
                  <select
                    disabled
                    value="Zebra ZD220 Direct Thermal"
                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <option value="Zebra ZD220 Direct Thermal">Zebra ZD220 Direct Thermal</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'ar' ? 'عدد النسخ لكل سيريال *' : 'Copies per Serial *'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewJobOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!selectedBatchId || actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <span>{lang === 'ar' ? 'جاري الإنشاء...' : 'Queuing Job...'}</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'إنشاء أمر الطباعة (إدراج بالانتظار)' : 'Create & Queue Print Job'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Job Details Inspection */}
      {selectedJobDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>{selectedJobDetails.job_number}</span>
              </h3>
              <button onClick={() => setSelectedJobDetails(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'حالة الأمر:' : 'Job Status:'}</span>
                <span className={`font-mono font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                  selectedJobDetails.status === 'printed' ? 'bg-emerald-50 text-emerald-700' :
                  selectedJobDetails.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                  selectedJobDetails.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                  'bg-indigo-50 text-indigo-700'
                }`}>
                  {selectedJobDetails.status}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'الدفعة المرتبطة:' : 'Target Batch:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedJobDetails.production_batches?.batch_number || selectedJobDetails.batch_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'الطابعة:' : 'Printer:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedJobDetails.printer_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'إجمالي الملصقات:' : 'Total Labels:'}</span>
                <span className="font-mono font-bold text-indigo-600">{selectedJobDetails.total_labels}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{lang === 'ar' ? 'الملصقات المطبوعة:' : 'Printed Labels:'}</span>
                <span className="font-mono font-bold text-emerald-600">{selectedJobDetails.printed_labels}</span>
              </div>
              {selectedJobDetails.error_message && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-bold">
                  {selectedJobDetails.error_message}
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">{lang === 'ar' ? 'تاريخ الإنشاء:' : 'Created Date:'}</span>
                <span className="font-mono text-slate-400">{new Date(selectedJobDetails.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                onClick={() => setSelectedJobDetails(null)}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
