/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  AlertCircle,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  FileBadge,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Clock,
  History,
  Eye,
  Sliders,
  X,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import {
  Brand,
  Category,
  ProductModel,
  ProductionBatch,
  ProductionOrder,
  Serial
} from '../utils/store.ts';
import {
  warrantyPoliciesApi,
  WarrantyPolicyRecord,
  PolicyLevelType,
  VALID_WARRANTY_DURATIONS
} from '../api/warrantyPoliciesApi.ts';
import {
  warrantyActivationsApi,
  WarrantyActivationRecord,
  WarrantyHistoryRecord,
  calculateWarrantyEndDate
} from '../api/warrantyActivationsApi.ts';
import { customersApi } from '../api/customersApi.ts';
import { serialNumbersApi } from '../api/serialNumbersApi.ts';
import { auditLogsApi } from '../api/auditLogsApi.ts';

interface WarrantyViewProps {
  serials: Serial[];
  brands: Brand[];
  models: ProductModel[];
  categories?: Category[];
  batches?: ProductionBatch[];
  orders?: ProductionOrder[];
  policies?: any[];
  lang: Language;
  currentRole?: string;
  onLogAudit: (action: string, details: string) => void;
}

const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الغربية', 'الدقهلية', 'المنوفية',
  'الشرقية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس',
  'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
  'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'
];

export default function WarrantyView({
  brands,
  models,
  categories = [],
  lang,
  currentRole = 'Administrator',
  onLogAudit
}: WarrantyViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  // Active Sub-Tab
  const currentSubTab = location.pathname.split('/')[2] || 'dashboard';

  // Role permissions
  const isAdministrator = currentRole === 'Administrator';
  const canManagePolicies = isAdministrator || currentRole === 'Warranty Officer';
  const canActivate =
    isAdministrator ||
    currentRole === 'Warranty Officer' ||
    currentRole === 'Customer Service Agent';

  // ============================================================================
  // DATABASE STATE (PostgreSQL as Authoritative Source of Truth)
  // ============================================================================
  const [dbPolicies, setDbPolicies] = useState<WarrantyPolicyRecord[]>([]);
  const [dbActivations, setDbActivations] = useState<WarrantyActivationRecord[]>([]);
  const [dbHistory, setDbHistory] = useState<WarrantyHistoryRecord[]>([]);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Global banners
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [warningMsg, setWarningMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Dashboard Metrics (Computed via PostgreSQL queries)
  const [kpis, setKpis] = useState({
    activeWarranties: 0,
    expiredWarranties: 0,
    totalActivations: 0,
    activationsToday: 0,
    activationsThisMonth: 0,
    activePoliciesCount: 0
  });

  // Load all database data
  const loadDatabaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [policiesData, activationsData, customersData, kpiData, historyData] =
        await Promise.all([
          warrantyPoliciesApi.getAll(),
          warrantyActivationsApi.getAll(),
          customersApi.getAll().catch(() => []),
          warrantyActivationsApi.getDashboardMetrics(),
          warrantyActivationsApi.getWarrantyHistory().catch(() => [])
        ]);

      setDbPolicies(policiesData || []);
      setDbActivations(activationsData || []);
      setDbCustomers(customersData || []);
      setKpis(kpiData);
      setDbHistory(historyData || []);
    } catch (err: any) {
      console.error('[WARRANTY LOAD ERROR]', err);
      setErrorMsg(err.message || 'Failed to load warranty records from PostgreSQL.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData, location.pathname]);

  // ============================================================================
  // SCREEN 02: WARRANTY POLICIES STATE & ACTIONS
  // ============================================================================
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyLevelType, setPolicyLevelType] = useState<PolicyLevelType>('category');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [policyDurationYears, setPolicyDurationYears] = useState<number>(10);
  const [policyIsActive, setPolicyIsActive] = useState<boolean>(true);
  const [editingPolicy, setEditingPolicy] = useState<WarrantyPolicyRecord | null>(null);

  const handleOpenNewPolicyModal = () => {
    setEditingPolicy(null);
    setPolicyLevelType('category');
    setSelectedCategoryId(categories[0]?.id || '');
    setSelectedBrandId(brands[0]?.id || '');
    setSelectedModelId(models[0]?.id || '');
    setPolicyDurationYears(10);
    setPolicyIsActive(true);
    setIsPolicyModalOpen(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleOpenEditPolicyModal = (pol: WarrantyPolicyRecord) => {
    setEditingPolicy(pol);
    setPolicyLevelType(pol.level_type);
    setSelectedCategoryId(pol.category_id || categories[0]?.id || '');
    setSelectedBrandId(pol.brand_id || brands[0]?.id || '');
    setSelectedModelId(pol.model_id || models[0]?.id || '');
    setPolicyDurationYears(pol.duration_years);
    setPolicyIsActive(pol.is_active);
    setIsPolicyModalOpen(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSavePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePolicies) {
      setErrorMsg(
        lang === 'ar'
          ? 'ليس لديك صلاحية إدارة سياسات الضمان.'
          : 'Permission denied to manage warranty policies.'
      );
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (editingPolicy) {
        const updated = await warrantyPoliciesApi.update(editingPolicy.id, {
          level_type: policyLevelType,
          category_id: policyLevelType === 'category' ? selectedCategoryId : null,
          brand_id: policyLevelType === 'brand' ? selectedBrandId : null,
          model_id: policyLevelType === 'model' ? selectedModelId : null,
          duration_years: policyDurationYears,
          is_active: policyIsActive
        });
        onLogAudit(
          'POLICY_UPDATED',
          `Updated warranty policy ${updated.id} (${updated.level_type}) duration to ${updated.duration_years} years.`
        );
        setSuccessMsg(
          lang === 'ar'
            ? 'تم تحديث سياسة الضمان بنجاح في قاعدة البيانات.'
            : 'Warranty policy updated successfully in PostgreSQL.'
        );
      } else {
        const created = await warrantyPoliciesApi.create({
          level_type: policyLevelType,
          category_id: policyLevelType === 'category' ? selectedCategoryId : null,
          brand_id: policyLevelType === 'brand' ? selectedBrandId : null,
          model_id: policyLevelType === 'model' ? selectedModelId : null,
          duration_years: policyDurationYears,
          is_active: policyIsActive
        });
        onLogAudit(
          'POLICY_CREATED',
          `Created new ${policyLevelType} warranty policy (${created.duration_years} years).`
        );
        setSuccessMsg(
          lang === 'ar'
            ? 'تم حفظ سياسة الضمان الجديدة بنجاح في قاعدة البيانات.'
            : 'New warranty policy saved successfully in PostgreSQL.'
        );
      }

      setIsPolicyModalOpen(false);
      await loadDatabaseData();
    } catch (err: any) {
      console.error('[POLICY SAVE ERROR]', err);
      setErrorMsg(err.message || 'Failed to save warranty policy.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePolicyStatus = async (policy: WarrantyPolicyRecord) => {
    if (!canManagePolicies) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await warrantyPoliciesApi.update(policy.id, { is_active: !policy.is_active });
      onLogAudit(
        'POLICY_STATUS_TOGGLED',
        `Toggled policy ${policy.id} active state to ${!policy.is_active}`
      );
      setSuccessMsg(
        lang === 'ar'
          ? 'تم تحديث حالة سياسة الضمان في قاعدة البيانات.'
          : 'Policy status updated in PostgreSQL.'
      );
      await loadDatabaseData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update policy status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePolicy = async (policy: WarrantyPolicyRecord) => {
    if (!canManagePolicies) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await warrantyPoliciesApi.delete(policy.id);
      onLogAudit('POLICY_DELETED', `Deleted warranty policy ${policy.id}`);
      setSuccessMsg(
        lang === 'ar'
          ? 'تم حذف سياسة الضمان من قاعدة البيانات.'
          : 'Warranty policy deleted from PostgreSQL.'
      );
      await loadDatabaseData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete policy.');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================================
  // SCREEN 03: WARRANTY ACTIVATIONS STATE & ATOMIC SUBMISSION
  // ============================================================================
  const [activationSerialInput, setActivationSerialInput] = useState<string>('');
  const [validatedSerialRecord, setValidatedSerialRecord] = useState<any | null>(null);
  const [resolvedPolicyInfo, setResolvedPolicyInfo] = useState<{
    durationYears: number;
    resolvedLevel: string;
    policy: any;
  } | null>(null);
  const [isDuplicateActivation, setIsDuplicateActivation] = useState<boolean>(false);
  const [existingActivationRecord, setExistingActivationRecord] =
    useState<WarrantyActivationRecord | null>(null);
  const [isSerialLookupLoading, setIsSerialLookupLoading] = useState<boolean>(false);

  // Customer & Invoice Form (All required fields explicitly represented)
  const [custMode, setCustMode] = useState<'existing' | 'new'>('new');
  const [selectedExistingCustId, setSelectedExistingCustId] = useState<string>('');
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustAltPhone, setNewCustAltPhone] = useState<string>('');
  const [newCustNationalId, setNewCustNationalId] = useState<string>('');
  const [newCustGov, setNewCustGov] = useState<string>('القاهرة');
  const [newCustCity, setNewCustCity] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Successful Activation Certificate Modal
  const [completedActivation, setCompletedActivation] =
    useState<WarrantyActivationRecord | null>(null);

  // Authoritative Serial Lookup in PostgreSQL
  const handleValidateSerialForActivation = async (serialQuery?: string) => {
    const q = (serialQuery ?? activationSerialInput).trim();
    if (!q) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال الرقم التسلسلي الصحيح للتحقق.'
          : 'Please enter a valid serial number.'
      );
      return;
    }

    setIsSerialLookupLoading(true);
    setErrorMsg('');
    setWarningMsg('');
    setValidatedSerialRecord(null);
    setResolvedPolicyInfo(null);
    setIsDuplicateActivation(false);
    setExistingActivationRecord(null);

    try {
      // 1. Exact Serial Lookup in PostgreSQL (safe UUID / serial_number resolution)
      const sRecord = await warrantyActivationsApi.findSerialRecord(q);
      if (!sRecord) {
        throw new Error(
          lang === 'ar'
            ? `الرقم التسلسلي (${q}) غير مسجل في سجلات الإنتاج الرسمية.`
            : `Serial Number (${q}) was not found in production records.`
        );
      }

      if (sRecord.status === 'closed' || sRecord.status === 'replacement') {
        throw new Error(
          lang === 'ar'
            ? `الرقم التسلسلي (${sRecord.serial_number}) حالته (${sRecord.status}) وغير مؤهل لتفعيل ضمان جديد.`
            : `Serial Number (${sRecord.serial_number}) has status (${sRecord.status}) and is not eligible for activation.`
        );
      }

      setValidatedSerialRecord(sRecord);

      // 2. Check for duplicate activation in PostgreSQL
      const existing = await warrantyActivationsApi.getBySerial(sRecord.id);
      if (existing) {
        setIsDuplicateActivation(true);
        setExistingActivationRecord(existing);
        setWarningMsg(
          lang === 'ar'
            ? `تنبيه: هذا السيريال (${sRecord.serial_number}) تم تفعيل ضمانه مسبقاً برقم فاتورة: ${existing.invoice_number}. لا يُسمح بتكرار التفعيل.`
            : `Notice: Serial (${sRecord.serial_number}) is already activated under invoice: ${existing.invoice_number}. Duplicate activation is prohibited.`
        );
        return;
      }

      // 3. Resolve Policy Hierarchy strictly (Model -> Brand -> Category -> Reject)
      const modelId = sRecord.models?.id || sRecord.model_id;
      const brandId = sRecord.models?.brand_id || sRecord.models?.brands?.id;
      const categoryId = sRecord.models?.category_id || sRecord.models?.categories?.id;

      const policyRes = await warrantyPoliciesApi.resolvePolicy({
        modelId,
        brandId,
        categoryId
      });
      setResolvedPolicyInfo(policyRes);
    } catch (err: any) {
      console.error('[SERIAL LOOKUP ERROR]', err);
      setErrorMsg(err.message || 'Error validating serial number.');
    } finally {
      setIsSerialLookupLoading(false);
    }
  };

  // Submit Atomic Warranty Activation
  const handlePerformActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canActivate) {
      setErrorMsg(
        lang === 'ar'
          ? 'ليس لديك صلاحية تفعيل الضمان.'
          : 'Permission denied to activate warranty.'
      );
      return;
    }

    if (!validatedSerialRecord) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى التحقق من الرقم التسلسلي أولاً.'
          : 'Please validate the serial number first.'
      );
      return;
    }

    if (isDuplicateActivation) {
      setErrorMsg(
        lang === 'ar'
          ? 'لا يمكن تفعيل هذا السيريال لأنه مفعل بالفعل في قاعدة البيانات.'
          : 'Cannot activate: Serial is already activated.'
      );
      return;
    }

    if (!resolvedPolicyInfo) {
      setErrorMsg(
        lang === 'ar'
          ? 'لا توجد سياسة ضمان نشطة مرتبطة بهذا الموديل أو الماركة أو الفئة.'
          : 'No active warranty policy found for this product.'
      );
      return;
    }

    if (!invoiceNumber.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'رقم فاتورة المستهلك إلزامي لتفعيل الضمان.'
          : 'Consumer invoice number is strictly required.'
      );
      return;
    }

    if (!invoiceDate) {
      setErrorMsg(
        lang === 'ar'
          ? 'تاريخ فاتورة المستهلك إلزامي لحساب فترة الضمان بدقة.'
          : 'Consumer invoice date is strictly required.'
      );
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const activationPayload: any = {
        serialNumberOrId: validatedSerialRecord.id,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: invoiceDate
      };

      if (custMode === 'existing') {
        if (!selectedExistingCustId) {
          throw new Error(
            lang === 'ar'
              ? 'يرجى اختيار عميل مسجل من القائمة.'
              : 'Please select an existing customer.'
          );
        }
        activationPayload.customerId = selectedExistingCustId;
      } else {
        if (
          !newCustName.trim() ||
          !newCustPhone.trim() ||
          !newCustNationalId.trim() ||
          !newCustGov.trim() ||
          !newCustCity.trim() ||
          !newCustAddress.trim()
        ) {
          throw new Error(
            lang === 'ar'
              ? 'جميع حقول العميل الأساسية (الاسم، الهاتف، الرقم القومي، المحافظة، المدينة، العنوان) إلزامية.'
              : 'Customer full name, phone, national ID, governorate, city, and address are required.'
          );
        }
        activationPayload.newCustomer = {
          full_name: newCustName.trim(),
          phone: newCustPhone.trim(),
          alternative_phone: newCustAltPhone.trim() || undefined,
          national_id: newCustNationalId.trim(),
          governorate: newCustGov.trim(),
          city: newCustCity.trim(),
          address: newCustAddress.trim()
        };
      }

      // Execute Atomic Activation
      const result = await warrantyActivationsApi.activateWarranty(activationPayload);

      setCompletedActivation(result);
      setSuccessMsg(
        lang === 'ar'
          ? `تم تفعيل الضمان بنجاح للسيريال (${result.serial_numbers?.serial_number || validatedSerialRecord.serial_number}) لمدة ${result.duration_years} سنوات!`
          : `Warranty successfully activated for (${result.serial_numbers?.serial_number || validatedSerialRecord.serial_number}) for ${result.duration_years} Years!`
      );

      // Reset form
      setActivationSerialInput('');
      setValidatedSerialRecord(null);
      setResolvedPolicyInfo(null);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAltPhone('');
      setNewCustNationalId('');
      setNewCustCity('');
      setNewCustAddress('');
      setInvoiceNumber('');

      await loadDatabaseData();
    } catch (err: any) {
      console.error('[ACTIVATION ERROR]', err);
      setErrorMsg(err.message || 'Failed to activate warranty in PostgreSQL.');
    } finally {
      setActionLoading(false);
    }
  };

  // ============================================================================
  // SCREEN 04 & 05: SERVER-SIDE WARRANTY SEARCH & DETAILS STATE
  // ============================================================================
  const [searchFilterQuery, setSearchFilterQuery] = useState<string>('');
  const [searchFilterStatus, setSearchFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [searchFilterGov, setSearchFilterGov] = useState<string>('all');
  const [searchFilterBrand, setSearchFilterBrand] = useState<string>('all');
  const [searchFilterModel, setSearchFilterModel] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<WarrantyActivationRecord[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [selectedWarrantyDetails, setSelectedWarrantyDetails] =
    useState<WarrantyActivationRecord | null>(null);
  const [selectedSerialHistory, setSelectedSerialHistory] = useState<any[]>([]);

  const executeServerSearch = useCallback(async () => {
    setIsSearching(true);
    try {
      const results = await warrantyActivationsApi.search({
        query: searchFilterQuery,
        status: searchFilterStatus,
        governorate: searchFilterGov,
        brandId: searchFilterBrand,
        modelId: searchFilterModel
      });
      setSearchResults(results);
    } catch (err: any) {
      console.error('[WARRANTY SEARCH ERROR]', err);
      setErrorMsg(err.message || 'Failed to search warranties in PostgreSQL.');
    } finally {
      setIsSearching(false);
    }
  }, [
    searchFilterQuery,
    searchFilterStatus,
    searchFilterGov,
    searchFilterBrand,
    searchFilterModel
  ]);

  useEffect(() => {
    if (currentSubTab === 'search') {
      executeServerSearch();
    }
  }, [currentSubTab, executeServerSearch]);

  const handleOpenWarrantyDetails = async (record: WarrantyActivationRecord) => {
    setSelectedWarrantyDetails(record);
    try {
      const history = await serialNumbersApi.getHistory(record.serial_id);
      setSelectedSerialHistory(history || []);
    } catch (err) {
      console.error('[LOAD SERIAL HISTORY ERROR]', err);
      setSelectedSerialHistory([]);
    }
  };

  // ============================================================================
  // SCREEN 06: WARRANTY VERIFICATION TOOL STATE
  // ============================================================================
  const [verifyInput, setVerifyInput] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const handlePerformVerification = async (serialQueryOverride?: string) => {
    const q = (serialQueryOverride ?? verifyInput).trim();
    if (!q) return;

    setIsVerifying(true);
    setVerifyResult(null);
    setErrorMsg('');

    try {
      const res = await warrantyActivationsApi.verifyWarranty(q);
      setVerifyResult(res);
      
      if (res.isActivated && res.activation?.id) {
        await auditLogsApi.recordWarrantyEvent({
          activationId: res.activation.id,
          eventType: 'verified',
          notes: `تم التحقق من الضمان للسيريال ${q}`
        });
      }
    } catch (err: any) {
      console.error('[VERIFICATION ERROR]', err);
      setErrorMsg(err.message || 'Error executing verification check.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Sub-tabs configuration
  const subTabs = [
    {
      id: 'dashboard',
      label: lang === 'ar' ? 'لوحة المؤشرات (Dashboard)' : 'Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'policies',
      label: lang === 'ar' ? 'سياسات الضمان (Policies)' : 'Policies',
      icon: Sliders
    },
    {
      id: 'activations',
      label: lang === 'ar' ? 'تفعيل الضمان (Activation)' : 'Activation',
      icon: Plus
    },
    {
      id: 'search',
      label: lang === 'ar' ? 'بحث وتتبع (Search)' : 'Search & Trace',
      icon: Search
    },
    {
      id: 'verify',
      label: lang === 'ar' ? 'فحص الضمان (Verification)' : 'Verification',
      icon: ShieldCheck
    },
    {
      id: 'history',
      label: lang === 'ar' ? 'سجل الأحداث (History)' : 'History Log',
      icon: History
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>{t.warrantyCenter}</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 rounded-full font-bold">
                Phase 09
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'ar'
                ? 'إدارة سياسات الضمان الهرمية، تفعيل الضمانات بالسيريال، الفحص وتتبع الفواتير'
                : 'Hierarchical Warranty Policy Management, Serialized Activation & Traceability Engine'}
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-stretch sm:self-auto justify-start overflow-x-auto">
          {subTabs.map(st => (
            <button
              key={st.id}
              onClick={() => navigate(`/warranty/${st.id}`)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentSubTab === st.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <st.icon className="w-3.5 h-3.5" />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Global Status Banner Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {warningMsg && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{warningMsg}</span>
          </div>
          <button onClick={() => setWarningMsg('')} className="text-amber-600 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 01: WARRANTY DASHBOARD VIEW */}
      {/* ==================================================================== */}
      {currentSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'الضمانات السارية' : 'Active Warranties'}
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {kpis.activeWarranties}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'سارية ولم تنتهِ' : 'Active status'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'الضمانات المنتهية' : 'Expired'}
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {kpis.expiredWarranties}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'تجاوزت تاريخ الانتهاء' : 'Past end date'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'إجمالي التفعيلات' : 'Total Activations'}
                </span>
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-800 dark:text-white font-mono">
                {kpis.totalActivations}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'المسجلة في PostgreSQL' : 'Database total'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'تفعيلات اليوم' : 'Today'}
                </span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {kpis.activationsToday}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'تفعيلات تاريخ اليوم' : 'Activated today'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'تفعيلات الشهر' : 'This Month'}
                </span>
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                {kpis.activationsThisMonth}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'خلال الشهر الجاري' : 'Current month'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'السياسات النشطة' : 'Active Policies'}
                </span>
                <Sliders className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {kpis.activePoliciesCount}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'هيكل سياسات معتمد' : 'Configured policies'}
              </div>
            </div>
          </div>

          {/* Quick Actions & Policy Hierarchy Guide */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>
                    {lang === 'ar' ? 'أحدث تفعيلات الضمان المعتمدة' : 'Recent Warranty Activations'}
                  </span>
                </h3>
                <button
                  onClick={() => navigate('/warranty/search')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <span>{lang === 'ar' ? 'عرض الكل' : 'View All'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'جاري تحميل السجلات من قاعدة البيانات...'
                    : 'Loading activations from PostgreSQL...'}
                </div>
              ) : dbActivations.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400">
                    {lang === 'ar'
                      ? 'لا توجد ضمانات مفعلة حالياً في قاعدة البيانات.'
                      : 'No activations recorded yet.'}
                  </p>
                  {canActivate && (
                    <button
                      onClick={() => navigate('/warranty/activations')}
                      className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                    >
                      {lang === 'ar' ? 'تفعيل أول ضمان' : 'Activate First Warranty'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">{lang === 'ar' ? 'الرقم التسلسلي' : 'Serial Number'}</th>
                        <th className="p-3">{lang === 'ar' ? 'العميل' : 'Customer'}</th>
                        <th className="p-3">{lang === 'ar' ? 'الموديل / الماركة' : 'Product / Brand'}</th>
                        <th className="p-3">{lang === 'ar' ? 'تاريخ البداية' : 'Start Date'}</th>
                        <th className="p-3">{lang === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</th>
                        <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                        <th className="p-3 text-center">{lang === 'ar' ? 'معاينة' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dbActivations.slice(0, 5).map(act => (
                        <tr
                          key={act.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {act.serial_numbers?.serial_number || 'Not Available'}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {act.customers?.full_name || 'Not Available'}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {act.serial_numbers?.models?.name_ar ||
                              act.serial_numbers?.models?.name_en ||
                              'Not Available'}
                          </td>
                          <td className="p-3 font-mono text-slate-500">{act.warranty_start_date}</td>
                          <td className="p-3 font-mono text-slate-500">{act.warranty_end_date}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                act.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {act.status === 'active'
                                ? lang === 'ar'
                                  ? 'سارٍ'
                                  : 'ACTIVE'
                                : lang === 'ar'
                                  ? 'منتهٍ'
                                  : 'EXPIRED'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleOpenWarrantyDetails(act)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Policy Hierarchy Info Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>{lang === 'ar' ? 'هيكل حل سياسات الضمان' : 'Policy Hierarchy Engine'}</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                  <span className="font-extrabold text-indigo-900 dark:text-indigo-200 block">
                    1. Model Override (الأولوية القصوى)
                  </span>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    إذا كان الموديل المحدد له سياسة خاصة، يتم تطبيقها أولاً وتلغي سياسات الماركة والفئة.
                  </p>
                </div>

                <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <span className="font-extrabold text-blue-900 dark:text-blue-200 block">
                    2. Brand Override (الماركة)
                  </span>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    إذا لم يوجد تخصيص للموديل، تُطبق سياسة الماركة وتلغي السياسة الافتراضية للفئة.
                  </p>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-extrabold text-slate-900 dark:text-slate-200 block">
                    3. Category Default (الفئة)
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    السياسة العامة للفئة (مثل: المراتب). في حال غياب السياسات يُرفض التفعيل ولا يتم استخدام قيم عشوائية.
                  </p>
                </div>
              </div>

              {canManagePolicies && (
                <button
                  onClick={handleOpenNewPolicyModal}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إضافة سياسة ضمان جديدة' : 'Add Warranty Policy'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 02: WARRANTY POLICIES VIEW */}
      {/* ==================================================================== */}
      {currentSubTab === 'policies' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>
                  {lang === 'ar'
                    ? 'سجل سياسات الضمان المعتمد (PostgreSQL Policies)'
                    : 'Warranty Policies Registry'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar'
                  ? 'إدارة مدد الضمان (من ١ إلى ١٥ سنة) حسب الفئة، الماركة، أو الموديل'
                  : 'Configure strict duration range (1-15 Years) per Category, Brand, or Model override'}
              </p>
            </div>

            {canManagePolicies && (
              <button
                onClick={handleOpenNewPolicyModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-indigo-600/10"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إنشاء سياسة ضمان جديدة' : 'New Policy'}</span>
              </button>
            )}
          </div>

          {/* Policies Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {loading ? (
              <div className="text-center py-10 text-xs text-slate-400">
                {lang === 'ar'
                  ? 'جاري تحميل السياسات من قاعدة البيانات...'
                  : 'Loading policies...'}
              </div>
            ) : dbPolicies.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Sliders className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'لا توجد سياسات ضمان معرفة في قاعدة البيانات.'
                    : 'No warranty policies found in PostgreSQL.'}
                </p>
                {canManagePolicies && (
                  <button
                    onClick={handleOpenNewPolicyModal}
                    className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold"
                  >
                    {lang === 'ar' ? 'إنشاء أول سياسة ضمان' : 'Create First Policy'}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">{lang === 'ar' ? 'مستوى السياسة' : 'Level Type'}</th>
                      <th className="p-3">{lang === 'ar' ? 'نطاق التطبيق (الهدف)' : 'Target Scope'}</th>
                      <th className="p-3">{lang === 'ar' ? 'مدة الضمان المعتمدة' : 'Duration'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="p-3">{lang === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</th>
                      {canManagePolicies && (
                        <th className="p-3 text-center">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dbPolicies.map(pol => (
                      <tr
                        key={pol.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                              pol.level_type === 'model'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300'
                                : pol.level_type === 'brand'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {pol.level_type === 'model'
                              ? lang === 'ar'
                                ? 'موديل (Model Override)'
                                : 'Model Override'
                              : pol.level_type === 'brand'
                                ? lang === 'ar'
                                  ? 'ماركة (Brand Override)'
                                  : 'Brand Override'
                                : lang === 'ar'
                                  ? 'فئة (Category Default)'
                                  : 'Category Default'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {pol.level_type === 'model'
                            ? pol.models?.name_ar || pol.models?.name_en || pol.model_id || 'Not Available'
                            : pol.level_type === 'brand'
                              ? pol.brands?.name_ar || pol.brands?.name_en || pol.brand_id || 'Not Available'
                              : pol.categories?.name_ar ||
                                pol.categories?.name_en ||
                                pol.category_id ||
                                'Not Available'}
                        </td>
                        <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {pol.duration_years} {lang === 'ar' ? 'سنوات' : 'Years'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pol.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {pol.is_active
                              ? lang === 'ar'
                                ? 'نشطة'
                                : 'Active'
                              : lang === 'ar'
                                ? 'معطلة'
                                : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">
                          {new Date(pol.created_at).toLocaleDateString()}
                        </td>
                        {canManagePolicies && (
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleOpenEditPolicyModal(pol)}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded text-[10px] font-bold"
                              >
                                {lang === 'ar' ? 'تعديل السياسة' : 'Edit Policy'}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleTogglePolicyStatus(pol)}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                  pol.is_active
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {pol.is_active
                                  ? lang === 'ar'
                                    ? 'تعطيل'
                                    : 'Deactivate'
                                  : lang === 'ar'
                                    ? 'تفعيل'
                                    : 'Activate'}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleDeletePolicy(pol)}
                                className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded"
                                title={lang === 'ar' ? 'حذف السياسة' : 'Delete Policy'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 03: WARRANTY ACTIVATIONS VIEW */}
      {/* ==================================================================== */}
      {currentSubTab === 'activations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Step 1: Serial Lookup & Traceability Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Search className="w-5 h-5 text-indigo-600" />
                <span>
                  {lang === 'ar' ? 'الخطوة ١: التحقق من الرقم التسلسلي' : 'Step 1: Serial Validation'}
                </span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'ar'
                      ? 'الرقم التسلسلي المطبوع على الملصق (SLP-YYYY-XXXXXXXX) *'
                      : 'Printed Serial Number *'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="SLP-2026-XXXXXXXX"
                      value={activationSerialInput}
                      onChange={e => setActivationSerialInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleValidateSerialForActivation()}
                      className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono uppercase"
                    />
                    <button
                      type="button"
                      disabled={isSerialLookupLoading || !activationSerialInput.trim()}
                      onClick={() => handleValidateSerialForActivation()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      {isSerialLookupLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>{lang === 'ar' ? 'تحقق' : 'Validate'}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Resolved Traceability Badge */}
              {validatedSerialRecord && (
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800 pb-2">
                    <span className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        {isDuplicateActivation
                          ? lang === 'ar'
                            ? 'السيريال مفعل مسبقاً'
                            : 'Already Activated'
                          : lang === 'ar'
                            ? 'السيريال موثق وجاهز للتفعيل'
                            : 'Serial Verified Valid'}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {validatedSerialRecord.serial_number}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{lang === 'ar' ? 'الفئة:' : 'Category:'}</span>
                      <span className="font-bold">
                        {validatedSerialRecord.models?.categories?.name_ar ||
                          validatedSerialRecord.models?.categories?.name_en ||
                          'Not Available'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {lang === 'ar' ? 'العلامة التجارية:' : 'Brand:'}
                      </span>
                      <span className="font-bold">
                        {validatedSerialRecord.models?.brands?.name_ar ||
                          validatedSerialRecord.models?.brands?.name_en ||
                          'Not Available'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{lang === 'ar' ? 'الموديل:' : 'Model:'}</span>
                      <span className="font-bold">
                        {validatedSerialRecord.models?.name_ar ||
                          validatedSerialRecord.models?.name_en ||
                          'Not Available'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{lang === 'ar' ? 'دفعة التشغيل:' : 'Batch:'}</span>
                      <span className="font-mono">
                        {validatedSerialRecord.production_batches?.batch_number || 'Not Available'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {lang === 'ar' ? 'أمر الإنتاج:' : 'Production Order:'}
                      </span>
                      <span className="font-mono">
                        {validatedSerialRecord.production_batches?.production_orders?.order_number ||
                          'Not Available'}
                      </span>
                    </div>
                  </div>

                  {resolvedPolicyInfo && (
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'ar' ? 'سياسة الضمان المطبقة:' : 'Resolved Policy:'}
                        </span>
                        <span className="font-bold text-indigo-600 uppercase text-[11px]">
                          {resolvedPolicyInfo.resolvedLevel} Policy
                        </span>
                      </div>
                      <span className="font-mono font-black text-emerald-600 text-sm">
                        {resolvedPolicyInfo.durationYears} {lang === 'ar' ? 'سنوات' : 'Years'}
                      </span>
                    </div>
                  )}

                  {existingActivationRecord && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                      <div className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                        {lang === 'ar'
                          ? `مفعل للعميل: ${existingActivationRecord.customers?.full_name || 'Not Available'}`
                          : `Activated for: ${existingActivationRecord.customers?.full_name || 'Not Available'}`}
                      </div>
                      <div className="text-[10px] font-mono text-amber-700">
                        {lang === 'ar'
                          ? `فاتورة: ${existingActivationRecord.invoice_number} | ينتهي في: ${existingActivationRecord.warranty_end_date}`
                          : `Invoice: ${existingActivationRecord.invoice_number} | Ends: ${existingActivationRecord.warranty_end_date}`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Consumer Invoice & Customer Information */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handlePerformActivationSubmit}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <FileBadge className="w-5 h-5 text-emerald-600" />
                <span>
                  {lang === 'ar'
                    ? 'الخطوة ٢: بيانات فاتورة المستهلك والعميل'
                    : 'Step 2: Consumer Invoice & Customer'}
                </span>
              </h3>

              {/* Invoice Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {lang === 'ar' ? 'بيانات فاتورة المستهلك النهائية' : 'Consumer Invoice Information'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === 'ar' ? 'رقم فاتورة المستهلك *' : 'Consumer Invoice Number *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="INV-2026-XXXXX"
                      value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === 'ar'
                        ? 'تاريخ شراء المستهلك (بداية الضمان) *'
                        : 'Consumer Purchase Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={invoiceDate}
                      onChange={e => setInvoiceDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Calculated End Date Preview */}
                {invoiceDate && resolvedPolicyInfo && (
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-500 block">
                        {lang === 'ar' ? 'تاريخ بداية الضمان:' : 'Warranty Start:'}
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {invoiceDate}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-slate-500 block">
                        {lang === 'ar' ? 'تاريخ نهاية الضمان المحسوب:' : 'Calculated End Date:'}
                      </span>
                      <span className="font-mono font-black text-emerald-600 text-sm">
                        {calculateWarrantyEndDate(invoiceDate, resolvedPolicyInfo.durationYears)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Information */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {lang === 'ar' ? 'بيانات العميل المستفيد' : 'Beneficiary Customer Information'}
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustMode('new')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        custMode === 'new'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      {lang === 'ar' ? 'عميل جديد' : 'New Customer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustMode('existing')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        custMode === 'existing'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      {lang === 'ar' ? 'عميل مسجل' : 'Existing'}
                    </button>
                  </div>
                </div>

                {custMode === 'existing' ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === 'ar'
                        ? 'اختر العميل من قاعدة البيانات *'
                        : 'Select Registered Customer *'}
                    </label>
                    <select
                      required
                      value={selectedExistingCustId}
                      onChange={e => setSelectedExistingCustId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    >
                      <option value="">
                        {lang === 'ar' ? 'اختر عميل...' : 'Select Customer...'}
                      </option>
                      {dbCustomers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} — {c.phone} ({c.governorate} - {c.city})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          {lang === 'ar' ? 'اسم العميل بالكامل *' : 'Full Name *'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={lang === 'ar' ? 'الاسم الثلاثي للعميل' : 'Customer Full Name'}
                          value={newCustName}
                          onChange={e => setNewCustName(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          {lang === 'ar' ? 'رقم الهاتف المحمول الأساسي *' : 'Mobile Phone *'}
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="010XXXXXXXX"
                          value={newCustPhone}
                          onChange={e => setNewCustPhone(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          {lang === 'ar' ? 'رقم هاتف بديل (اختياري)' : 'Alternative Phone (Optional)'}
                        </label>
                        <input
                          type="tel"
                          placeholder="011XXXXXXXX"
                          value={newCustAltPhone}
                          onChange={e => setNewCustAltPhone(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          {lang === 'ar' ? 'الرقم القومي (١٤ رقم) *' : 'National ID (14 digits) *'}
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={14}
                          placeholder="29012345678901"
                          value={newCustNationalId}
                          onChange={e => setNewCustNationalId(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          {lang === 'ar' ? 'المحافظة *' : 'Governorate *'}
                        </label>
                        <select
                          required
                          value={newCustGov}
                          onChange={e => setNewCustGov(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                        >
                          {EGYPT_GOVERNORATES.map(g => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          {lang === 'ar' ? 'المدينة / المنطقة *' : 'City / District *'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={lang === 'ar' ? 'مثال: مدينة نصر / المهندسين' : 'City / Area'}
                          value={newCustCity}
                          onChange={e => setNewCustCity(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        {lang === 'ar' ? 'العنوان التفصيلي بالتحديد *' : 'Detailed Address *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          lang === 'ar' ? 'الشارع، رقم العقار، الدور، الشقة' : 'Detailed street address'
                        }
                        value={newCustAddress}
                        onChange={e => setNewCustAddress(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    !validatedSerialRecord ||
                    !resolvedPolicyInfo ||
                    isDuplicateActivation ||
                    actionLoading ||
                    !canActivate
                  }
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/15 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>
                        {lang === 'ar'
                          ? 'جاري التفعيل وحفظ السجلات...'
                          : 'Activating in PostgreSQL...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {lang === 'ar'
                          ? 'تفعيل الضمان الرسمي الآن'
                          : 'Execute Warranty Activation'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 04: WARRANTY SEARCH & TRACKING VIEW (SERVER-SIDE POSTGRESQL) */}
      {/* ==================================================================== */}
      {currentSubTab === 'search' && (
        <div className="space-y-4">
          {/* Multi-Criteria Server-Side Search Filter Box */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    lang === 'ar'
                      ? 'بحث بالسيريال، اسم العميل، الهاتف، الرقم القومي، الفاتورة...'
                      : 'Search by Serial, Customer, Phone, National ID, Invoice...'
                  }
                  value={searchFilterQuery}
                  onChange={e => setSearchFilterQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && executeServerSearch()}
                  className="w-full py-2 pr-9 pl-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <select
                  value={searchFilterStatus}
                  onChange={e => setSearchFilterStatus(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  <option value="all">
                    {lang === 'ar' ? 'جميع الحالات (سارٍ ومنتهٍ)' : 'All Statuses'}
                  </option>
                  <option value="active">
                    {lang === 'ar' ? 'سارٍ فقط (Active Only)' : 'Active Only'}
                  </option>
                  <option value="expired">
                    {lang === 'ar' ? 'منتهٍ فقط (Expired Only)' : 'Expired Only'}
                  </option>
                </select>
              </div>

              <div>
                <select
                  value={searchFilterGov}
                  onChange={e => setSearchFilterGov(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option value="all">
                    {lang === 'ar' ? 'جميع المحافظات' : 'All Governorates'}
                  </option>
                  {EGYPT_GOVERNORATES.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={searchFilterBrand}
                  onChange={e => {
                    setSearchFilterBrand(e.target.value);
                    setSearchFilterModel('all');
                  }}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option value="all">
                    {lang === 'ar' ? 'جميع العلامات التجارية' : 'All Brands'}
                  </option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.nameAr || b.name_ar} ({b.nameEn || b.name_en})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {lang === 'ar'
                  ? `نتائج البحث في قاعدة البيانات (${searchResults.length} ضمان مسجل)`
                  : `PostgreSQL Search Results (${searchResults.length} Warranties)`}
              </h3>
              <button
                type="button"
                onClick={() => executeServerSearch()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'تحديث البحث' : 'Refresh'}</span>
              </button>
            </div>

            {isSearching || loading ? (
              <div className="text-center py-10 text-xs text-slate-400">
                {lang === 'ar'
                  ? 'جاري الاستعلام من قاعدة بيانات PostgreSQL...'
                  : 'Querying PostgreSQL database...'}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                {lang === 'ar'
                  ? 'لا توجد ضمانات مطابقة لمعايير البحث الحالية.'
                  : 'No warranties match current criteria.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">{lang === 'ar' ? 'الرقم التسلسلي' : 'Serial Number'}</th>
                      <th className="p-3">{lang === 'ar' ? 'العميل' : 'Customer'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الموديل / الماركة' : 'Model / Brand'}</th>
                      <th className="p-3">{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice No'}</th>
                      <th className="p-3">{lang === 'ar' ? 'تاريخ الشراء' : 'Purchase Date'}</th>
                      <th className="p-3">{lang === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</th>
                      <th className="p-3">{lang === 'ar' ? 'المدة' : 'Duration'}</th>
                      <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="p-3 text-center">{lang === 'ar' ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {searchResults.map(act => (
                      <tr
                        key={act.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {act.serial_numbers?.serial_number || 'Not Available'}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {act.customers?.full_name || 'Not Available'}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {act.customers?.phone || 'Not Available'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {act.serial_numbers?.models?.name_ar ||
                            act.serial_numbers?.models?.name_en ||
                            'Not Available'}
                        </td>
                        <td className="p-3 font-mono text-slate-500">{act.invoice_number}</td>
                        <td className="p-3 font-mono text-slate-500">{act.warranty_start_date}</td>
                        <td className="p-3 font-mono text-slate-500">{act.warranty_end_date}</td>
                        <td className="p-3 font-mono font-bold text-indigo-600">
                          {act.duration_years} {lang === 'ar' ? 'سنوات' : 'Yrs'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              act.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {act.status === 'active'
                              ? lang === 'ar'
                                ? `سارٍ (${act.days_remaining} يوم)`
                                : `ACTIVE (${act.days_remaining}d)`
                              : lang === 'ar'
                                ? 'منتهٍ'
                                : 'EXPIRED'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleOpenWarrantyDetails(act)}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg font-bold text-[10px] inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'التفاصيل' : 'Details'}</span>
                          </button>
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

      {/* ==================================================================== */}
      {/* SCREEN 05: WARRANTY VERIFICATION VIEW */}
      {/* ==================================================================== */}
      {currentSubTab === 'verify' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>
                {lang === 'ar'
                  ? 'فحص وصلاحية شهادة الضمان بالسيريال'
                  : 'Warranty Validity Verification'}
              </span>
            </h3>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {lang === 'ar'
                  ? 'أدخل الرقم التسلسلي المطبوع على الملصق (SLP-YYYY-XXXXXXXX)'
                  : 'Enter Serial Number / QR Code'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SLP-2026-XXXXXXXX"
                  value={verifyInput}
                  onChange={e => setVerifyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePerformVerification()}
                  className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono uppercase"
                />
                <button
                  type="button"
                  disabled={isVerifying || !verifyInput.trim()}
                  onClick={() => handlePerformVerification()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {isVerifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{lang === 'ar' ? 'فحص الضمان' : 'Verify'}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Verification Result Card */}
            {verifyResult && (
              <div
                className={`p-6 rounded-2xl border-2 space-y-4 mt-4 transition-all ${
                  verifyResult.status === 'ACTIVE'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100'
                    : verifyResult.status === 'EXPIRED'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100'
                      : verifyResult.status === 'NOT_ACTIVATED'
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-100'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-3 border-current/20">
                  <div className="flex items-center gap-2">
                    {verifyResult.status === 'ACTIVE' && (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    )}
                    {verifyResult.status === 'EXPIRED' && (
                      <AlertCircle className="w-6 h-6 text-rose-600" />
                    )}
                    {verifyResult.status === 'NOT_ACTIVATED' && (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    )}
                    {verifyResult.status === 'NOT_FOUND' && (
                      <X className="w-6 h-6 text-slate-500" />
                    )}

                    <div>
                      <h4 className="font-extrabold text-sm">
                        {verifyResult.status === 'ACTIVE'
                          ? lang === 'ar'
                            ? 'ضمان رسمي سارٍ ومعتمد'
                            : 'OFFICIAL WARRANTY ACTIVE'
                          : verifyResult.status === 'EXPIRED'
                            ? lang === 'ar'
                              ? 'الضمان منتهي الصلاحية'
                              : 'WARRANTY EXPIRED'
                            : verifyResult.status === 'NOT_ACTIVATED'
                              ? lang === 'ar'
                                ? 'منتج أصلي مسجل - لم يُفعل الضمان بعد'
                                : 'ORIGINAL PRODUCT - NOT ACTIVATED'
                              : lang === 'ar'
                                ? 'رقم تسلسلي غير مسجل'
                                : 'SERIAL NOT FOUND'}
                      </h4>
                      <p className="text-[11px] opacity-80">{verifyResult.message}</p>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-bold uppercase px-3 py-1 bg-white/80 dark:bg-slate-900/80 rounded-full border border-current/20">
                    {verifyResult.status}
                  </span>
                </div>

                {/* Product Traceability Details for Found Serials (ACTIVE, EXPIRED, or NOT_ACTIVATED) */}
                {verifyResult.serial && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2">
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'الرقم التسلسلي:' : 'Serial Number:'}
                      </span>
                      <span className="font-mono font-bold">
                        {verifyResult.serial.serial_number}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'الفئة:' : 'Category:'}
                      </span>
                      <span className="font-bold">
                        {verifyResult.serial.models?.categories?.name_ar ||
                          verifyResult.serial.models?.categories?.name_en ||
                          'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'العلامة التجارية:' : 'Brand:'}
                      </span>
                      <span className="font-bold">
                        {verifyResult.serial.models?.brands?.name_ar ||
                          verifyResult.serial.models?.brands?.name_en ||
                          'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'الموديل:' : 'Model:'}
                      </span>
                      <span className="font-bold">
                        {verifyResult.serial.models?.name_ar ||
                          verifyResult.serial.models?.name_en ||
                          'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'دفعة التشغيل:' : 'Batch:'}
                      </span>
                      <span className="font-mono font-bold">
                        {verifyResult.serial.production_batches?.batch_number || 'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'سياسة الضمان المقررة:' : 'Applicable Policy:'}
                      </span>
                      <span className="font-mono font-bold">
                        {verifyResult.applicablePolicy
                          ? `${verifyResult.applicablePolicy.durationYears} ${lang === 'ar' ? 'سنوات' : 'Years'} (${verifyResult.applicablePolicy.resolvedLevel})`
                          : 'Not Available'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Activation Details if Activated */}
                {verifyResult.activation && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-current/20">
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'العميل المستفيد:' : 'Customer:'}
                      </span>
                      <span className="font-bold">
                        {verifyResult.activation.customers?.full_name || 'Not Available'}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice Number:'}
                      </span>
                      <span className="font-mono font-bold">
                        {verifyResult.activation.invoice_number}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'تاريخ الشراء:' : 'Purchase Date:'}
                      </span>
                      <span className="font-mono font-bold">
                        {verifyResult.activation.warranty_start_date}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">
                        {lang === 'ar' ? 'تاريخ انتهاء الضمان:' : 'Expiration Date:'}
                      </span>
                      <span className="font-mono font-black text-sm">
                        {verifyResult.activation.warranty_end_date}
                      </span>
                    </div>
                  </div>
                )}

                {/* Direct Action to Activate if NOT_ACTIVATED */}
                {verifyResult.status === 'NOT_ACTIVATED' && verifyResult.serial && canActivate && (
                  <div className="pt-3 border-t border-amber-500/30 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const code = verifyResult.serial.serial_number;
                        setActivationSerialInput(code);
                        navigate('/warranty/activations');
                        handleValidateSerialForActivation(code);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {lang === 'ar'
                          ? 'الانتقال لتفعيل الضمان لهذا السيريال الآن'
                          : 'Activate Warranty for this Serial Now'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCREEN 06: WARRANTY HISTORY VIEW (FROM SERIAL_HISTORY & ACTIVATIONS) */}
      {/* ==================================================================== */}
      {currentSubTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <span>
                {lang === 'ar'
                  ? 'سجل أحداث وتدقيق الضمان (PostgreSQL Serial History)'
                  : 'Warranty Event History'}
              </span>
            </h3>
            <span className="text-xs text-slate-400">
              {lang === 'ar'
                ? 'تتبع كامل غير قابل للحذف لجميع تفعيلات الضمان في serial_history'
                : 'Permanent audit log of activations in serial_history'}
            </span>
          </div>

          <div className="space-y-3">
            {dbHistory.length === 0 && dbActivations.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                {lang === 'ar'
                  ? 'لا توجد أحداث ضمان مسجلة حالياً.'
                  : 'No warranty events recorded.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(dbHistory.length > 0
                  ? dbHistory
                  : dbActivations.map(act => ({
                      id: act.id,
                      serial_id: act.serial_id,
                      event_type: 'activated',
                      event_date: act.activation_date,
                      notes: `تم تفعيل الضمان للعميل ${act.customers?.full_name || 'Not Available'} برقم فاتورة: ${act.invoice_number}`,
                      serial_numbers: act.serial_numbers,
                      profiles: act.profiles,
                      activation: act
                    }))
                ).map(item => (
                  <div key={item.id} className="py-3 flex items-start justify-between text-xs">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.serial_numbers?.serial_number || 'Not Available'}
                          </span>
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">
                            {item.event_type}
                          </span>
                          {item.activation && (
                            <span className="font-mono text-[10px] text-slate-500">
                              {item.activation.invoice_number} ({item.activation.duration_years} Yrs)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {item.notes || 'Warranty activation recorded'}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.event_date).toLocaleString()}
                          {item.profiles?.full_name ? ` — By: ${item.profiles.full_name}` : ''}
                        </span>
                      </div>
                    </div>

                    {item.activation && (
                      <button
                        onClick={() => handleOpenWarrantyDetails(item.activation!)}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-[10px] font-bold"
                      >
                        {lang === 'ar' ? 'معاينة' : 'Inspect'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE / EDIT WARRANTY POLICY */}
      {/* ==================================================================== */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>
                  {editingPolicy
                    ? lang === 'ar'
                      ? 'تعديل سياسة الضمان'
                      : 'Edit Warranty Policy'
                    : lang === 'ar'
                      ? 'إنشاء سياسة ضمان جديدة'
                      : 'Create Warranty Policy'}
                </span>
              </h3>
              <button
                onClick={() => setIsPolicyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePolicySubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar' ? 'مستوى تطبيق السياسة الهرمية *' : 'Policy Level Type *'}
                </label>
                <select
                  value={policyLevelType}
                  onChange={e => setPolicyLevelType(e.target.value as PolicyLevelType)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  <option value="category">
                    {lang === 'ar' ? 'الفئة الافتراضية (Category Default)' : 'Category Default'}
                  </option>
                  <option value="brand">
                    {lang === 'ar' ? 'تخصيص الماركة (Brand Override)' : 'Brand Override'}
                  </option>
                  <option value="model">
                    {lang === 'ar' ? 'تخصيص الموديل (Model Override)' : 'Model Override'}
                  </option>
                </select>
              </div>

              {/* Target Selector based on level_type */}
              {policyLevelType === 'category' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'ar' ? 'اختر الفئة *' : 'Select Target Category *'}
                  </label>
                  <select
                    required
                    value={selectedCategoryId}
                    onChange={e => setSelectedCategoryId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr || c.name_ar} ({c.nameEn || c.name_en})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {policyLevelType === 'brand' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'ar' ? 'اختر العلامة التجارية *' : 'Select Target Brand *'}
                  </label>
                  <select
                    required
                    value={selectedBrandId}
                    onChange={e => setSelectedBrandId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr || b.name_ar} ({b.nameEn || b.name_en})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {policyLevelType === 'model' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {lang === 'ar' ? 'اختر الموديل المحدد *' : 'Select Target Model *'}
                  </label>
                  <select
                    required
                    value={selectedModelId}
                    onChange={e => setSelectedModelId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name_ar || m.name_en || (m as any).nameAr || 'Not Available'} (
                        {m.name_en || m.name_ar || 'Not Available'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Supported Duration Selector [1..15 Years] */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {lang === 'ar'
                    ? 'مدة الضمان بالسنوات (من ١ إلى ١٥ سنة معتمدة) *'
                    : 'Warranty Duration (1 to 15 Years) *'}
                </label>
                <select
                  required
                  value={policyDurationYears}
                  onChange={e => setPolicyDurationYears(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                >
                  {VALID_WARRANTY_DURATIONS.map(yrs => (
                    <option key={yrs} value={yrs}>
                      {yrs}{' '}
                      {lang === 'ar'
                        ? yrs === 1
                          ? 'سنة واحدة'
                          : yrs === 2
                            ? 'سنتان'
                            : yrs <= 10
                              ? `${yrs} سنوات`
                              : `${yrs} سنة`
                        : `${yrs} Years`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'ar' ? 'حالة تفعيل السياسة:' : 'Policy Active Status:'}
                </span>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={policyIsActive}
                    onChange={e => setPolicyIsActive(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>
                    {policyIsActive
                      ? lang === 'ar'
                        ? 'نشطة (Active)'
                        : 'Active'
                      : lang === 'ar'
                        ? 'معطلة (Inactive)'
                        : 'Inactive'}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15"
                >
                  {actionLoading
                    ? lang === 'ar'
                      ? 'جاري الحفظ...'
                      : 'Saving...'
                    : lang === 'ar'
                      ? 'حفظ السياسة'
                      : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: OFFICIAL ACTIVATED WARRANTY CERTIFICATE */}
      {/* ==================================================================== */}
      {completedActivation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border-2 border-emerald-500 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {lang === 'ar'
                      ? 'شهادة تفعيل الضمان الرسمية المعتمدة'
                      : 'Official Activated Warranty Certificate'}
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-mono">
                    {completedActivation.serial_numbers?.serial_number}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCompletedActivation(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-emerald-50/50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'العميل المستفيد:' : 'Customer:'}
                </span>
                <strong className="text-slate-800 dark:text-white">
                  {completedActivation.customers?.full_name || 'Not Available'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'رقم الهاتف:' : 'Phone:'}
                </span>
                <strong className="font-mono">
                  {completedActivation.customers?.phone || 'Not Available'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'الموديل / الماركة:' : 'Model / Brand:'}
                </span>
                <strong>
                  {completedActivation.serial_numbers?.models?.name_ar ||
                    completedActivation.serial_numbers?.models?.name_en ||
                    'Not Available'}{' '}
                  (
                  {completedActivation.serial_numbers?.models?.brands?.name_ar ||
                    completedActivation.serial_numbers?.models?.brands?.name_en ||
                    'Not Available'}
                  )
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice Number:'}
                </span>
                <strong className="font-mono">{completedActivation.invoice_number}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'تاريخ الشراء (البداية):' : 'Start Date:'}
                </span>
                <strong className="font-mono">{completedActivation.warranty_start_date}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">
                  {lang === 'ar' ? 'تاريخ انتهاء الضمان:' : 'End Date:'}
                </span>
                <strong className="font-mono text-emerald-600">
                  {completedActivation.warranty_end_date} ({completedActivation.duration_years}{' '}
                  {lang === 'ar' ? 'سنوات' : 'Years'})
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCompletedActivation(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                {lang === 'ar' ? 'تم' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: WARRANTY DETAILS & FULL TRACEABILITY INSPECTOR */}
      {/* ==================================================================== */}
      {selectedWarrantyDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  {lang === 'ar'
                    ? 'تفاصيل شهادة الضمان والتتبع الكامل'
                    : 'Warranty Certificate & Traceability Tree'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWarrantyDetails(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Traceability Flow Indicator */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-mono overflow-x-auto">
              <span className="text-indigo-600 font-bold">
                {selectedWarrantyDetails.serial_numbers?.serial_number || 'Not Available'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-600">
                {selectedWarrantyDetails.serial_numbers?.production_batches?.batch_number ||
                  'Not Available'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-600">
                {selectedWarrantyDetails.serial_numbers?.production_batches?.production_orders
                  ?.order_number || 'Not Available'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-emerald-600 font-bold">
                {selectedWarrantyDetails.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Customer Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-white border-b pb-1">
                  {lang === 'ar' ? 'بيانات العميل المستفيد' : 'Customer Details'}
                </h4>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="text-slate-400">{lang === 'ar' ? 'الاسم:' : 'Name:'}</span>{' '}
                    <strong className="text-slate-800 dark:text-white">
                      {selectedWarrantyDetails.customers?.full_name || 'Not Available'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">{lang === 'ar' ? 'الهاتف:' : 'Phone:'}</span>{' '}
                    {selectedWarrantyDetails.customers?.phone || 'Not Available'}
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'الرقم القومي:' : 'National ID:'}
                    </span>{' '}
                    <span className="font-mono">
                      {selectedWarrantyDetails.customers?.national_id || 'Not Available'}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'المحافظة / المدينة:' : 'Location:'}
                    </span>{' '}
                    {selectedWarrantyDetails.customers?.governorate || 'Not Available'} —{' '}
                    {selectedWarrantyDetails.customers?.city || 'Not Available'}
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'العنوان:' : 'Address:'}
                    </span>{' '}
                    {selectedWarrantyDetails.customers?.address || 'Not Available'}
                  </p>
                </div>
              </div>

              {/* Product & Invoice Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-white border-b pb-1">
                  {lang === 'ar' ? 'بيانات المنتج والفاتورة' : 'Product & Invoice'}
                </h4>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="text-slate-400">{lang === 'ar' ? 'الموديل:' : 'Model:'}</span>{' '}
                    {selectedWarrantyDetails.serial_numbers?.models?.name_ar ||
                      selectedWarrantyDetails.serial_numbers?.models?.name_en ||
                      'Not Available'}
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'العلامة التجارية:' : 'Brand:'}
                    </span>{' '}
                    {selectedWarrantyDetails.serial_numbers?.models?.brands?.name_ar ||
                      selectedWarrantyDetails.serial_numbers?.models?.brands?.name_en ||
                      'Not Available'}
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice No:'}
                    </span>{' '}
                    <strong className="font-mono">{selectedWarrantyDetails.invoice_number}</strong>
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'تاريخ الشراء:' : 'Purchase Date:'}
                    </span>{' '}
                    {selectedWarrantyDetails.warranty_start_date}
                  </p>
                  <p>
                    <span className="text-slate-400">
                      {lang === 'ar' ? 'تاريخ الانتهاء:' : 'End Date:'}
                    </span>{' '}
                    <strong className="font-mono text-emerald-600">
                      {selectedWarrantyDetails.warranty_end_date} (
                      {selectedWarrantyDetails.duration_years}{' '}
                      {lang === 'ar' ? 'سنوات' : 'Years'})
                    </strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Event History Timeline */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                <span>
                  {lang === 'ar'
                    ? 'سجل الأحداث لهذا السيريال (Audit Timeline)'
                    : 'Serial Audit Timeline'}
                </span>
              </h4>

              {selectedSerialHistory.length === 0 ? (
                <p className="text-slate-400 text-xs py-2">
                  {lang === 'ar'
                    ? 'تم تسجيل التفعيل بنجاح.'
                    : 'Activation recorded successfully.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedSerialHistory.map((h, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-[11px] flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold uppercase text-indigo-600">{h.event_type}</span>
                        <p className="text-slate-500">{h.notes || 'No description'}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(h.event_date).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedWarrantyDetails(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
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
