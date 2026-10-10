/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import { 
  Globe, 
  User, 
  ChevronDown, 
  Clock, 
  ShieldCheck,
  Building,
  Menu,
  Factory,
  Database,
  Hash,
  Printer,
  Sliders,
  Users,
  FileText,
  RefreshCw,
  FileBarChart2,
  Settings,
  Sun,
  Moon,
  Search,
  LogOut
} from 'lucide-react';

import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import { useAuth } from './context/AuthContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import DatabaseNotDeployedScreen from './components/DatabaseNotDeployedScreen.tsx';
import DatabaseStatusView from './components/DatabaseStatusView.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Language, translations } from './utils/translations.ts';
import { 
  Brand, 
  ProductModel, 
  ProductionOrder, 
  ProductionBatch, 
  Serial, 
  WarrantyPolicy, 
  ServiceCase, 
  ReplacementCase, 
  AuditLog,
  Customer
} from './utils/store.ts';

// Import Real APIs
import { brandsApi } from './api/brandsApi.ts';
import { categoriesApi } from './api/categoriesApi.ts';
import { modelsApi } from './api/modelsApi.ts';
import { productionOrdersApi } from './api/productionOrdersApi.ts';
import { batchesApi } from './api/batchesApi.ts';
import { serialNumbersApi } from './api/serialNumbersApi.ts';
import { warrantyPoliciesApi } from './api/warrantyPoliciesApi.ts';
import { customersApi } from './api/customersApi.ts';
import { serviceCasesApi } from './api/serviceCasesApi.ts';
import { replacementsApi } from './api/replacementsApi.ts';
import { auditLogsApi } from './api/auditLogsApi.ts';
import { productSizesApi } from './api/productSizesApi.ts';
import { productTypesApi } from './api/productTypesApi.ts';
import { labelTemplatesApi } from './api/labelTemplatesApi.ts';

// Import Modular Views & Modals
import Sidebar from './components/Sidebar.tsx';
import DashboardView from './components/DashboardView.tsx';
import ProductionView from './components/ProductionView.tsx';
import PrintView from './components/PrintView.tsx';
import WarrantyView from './components/WarrantyView.tsx';
import CustomerServiceView from './components/CustomerServiceView.tsx';
import ReplacementsView from './components/ReplacementsView.tsx';
import ReportsView from './components/ReportsView.tsx';
import AdminView from './components/AdminView.tsx';
import MasterDataView from './components/MasterDataView.tsx';
import SerializationView from './components/SerializationView.tsx';
import PublicPortalView from './components/PublicPortalView.tsx';
import GlobalSearchModal from './components/GlobalSearchModal.tsx';
import LabelDesignerView from './components/LabelDesignerView.tsx';
import ManufacturingEngineeringView from './components/ManufacturingEngineeringView.tsx';
import ProductionWizardView from './components/ProductionWizardView.tsx';

function AppContent() {
  const { user, session, loading: authLoading, dbHealth, signIn, signUp, signOut, checkHealth } = useAuth();
  
  // App states
  const [lang, setLang] = useState<Language>('ar');
  const [currentSubTab, setCurrentSubTab] = useState<string>('dashboard-home');
  const [fontSize, setFontSize] = useState<number>(14);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Authentication UI states
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [authRole, setAuthRole] = useState<string>('Administrator');
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');

  // Database lists (Strictly from Supabase - Zero Mock Data)
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [serials, setSerials] = useState<Serial[]>([]);
  const [policies, setPolicies] = useState<WarrantyPolicy[]>([]);
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [replacements, setReplacements] = useState<ReplacementCase[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const t = translations[lang];
  const location = useLocation();
  const navigate = useNavigate();

  // Global audit trail recorder
  const logAudit = async (action: string, details: string, recordId?: string, tableName = 'application') => {
    try {
      if (!recordId) {
        console.warn(`[AUDIT] ${action} skipped because a real record id was not supplied.`);
        return;
      }
      await auditLogsApi.recordApplicationEvent({
        tableName,
        recordId,
        actionType: action.startsWith('CREATE') ? 'INSERT' : action.startsWith('DELETE') ? 'DELETE' : 'UPDATE',
        details: { action, details }
      });
      const updatedLogs = await auditLogsApi.getAll();
      setAuditLogs(updatedLogs);
    } catch (err) {
      console.error(`[AUDIT] Failed to persist ${action} through the authoritative RPC.`, err);
    }
  };

  // Load complete relational data from Supabase
  const loadDatabaseData = async () => {
    if (!isSupabaseConfigured || !dbHealth?.hasCoreTables) return;

    const loadModule = async (name: string, apiCall: () => Promise<any>, setter: (data: any) => void) => {
      try {
        const data = await apiCall();
        if (data !== undefined && data !== null) {
          setter(data);
        }
      } catch (err) {
        console.error(`[API LOAD ERROR] Failed to load table/API: ${name}`, err);
      }
    };

    await loadModule('brands', () => brandsApi.getAll(), setBrands);
    await loadModule('categories', () => categoriesApi.getAll(), setCategories);
    await loadModule('models', () => modelsApi.getAll(), setModels);
    await loadModule('productSizes', () => productSizesApi.getAll(), (sizes) => {
      setProductSizes(sizes.map((s: any) => s.size_value));
    });
    await loadModule('productTypes', () => productTypesApi.getAll(), setProductTypes);
    await loadModule('productionOrders', () => productionOrdersApi.getAll(), (data) => setOrders(data || []));
    await loadModule('batches', () => batchesApi.getAll(), (data) => setBatches(data || []));
    await loadModule('serialNumbers', () => serialNumbersApi.getAll(), (data) => setSerials(data || []));
    await loadModule('warrantyPolicies', () => warrantyPoliciesApi.getAll(), setPolicies);
    await loadModule('customers', () => customersApi.getAll(), (data) => setCustomers(data || []));
    await loadModule('serviceCases', () => serviceCasesApi.getAll(), (data) => setCases(data || []));
    await loadModule('replacements', () => replacementsApi.getAll(), (data) => setReplacements(data || []));
    await loadModule('auditLogs', () => auditLogsApi.getAll(), (data) => setAuditLogs(data || []));
  };

  useEffect(() => {
    if (user && supabase && dbHealth?.hasCoreTables) {
      loadDatabaseData();

      const runChannel = supabase
        .channel('sleepee-realtime-room')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, () => {
          loadDatabaseData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_cases' }, () => {
          loadDatabaseData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'replacement_requests' }, () => {
          loadDatabaseData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'serial_numbers' }, () => {
          loadDatabaseData();
        })
        .subscribe();

      return () => {
        if (supabase) supabase.removeChannel(runChannel);
      };
    }
  }, [user, dbHealth]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      if (isSignUpMode) {
        await signUp(authEmail, authPassword, authName, authRole);
        setAuthSuccess('Account created successfully!');
      } else {
        await signIn(authEmail, authPassword);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handleAddOrder = async (lines: any[]) => {
    const newOrder = await productionOrdersApi.createOrder(lines, user?.id);
    const updatedOrders = await productionOrdersApi.getAll();
    setOrders(updatedOrders);
    logAudit('CREATE_ORDER', `Created Production Order ${newOrder.order_number || newOrder.id}`, newOrder.id, 'production_orders');
    return newOrder;
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: ProductionOrder['status']) => {
    const updatedOrder = await productionOrdersApi.updateStatus(orderId, newStatus, user?.id);
    const updatedOrders = await productionOrdersApi.getAll();
    setOrders(updatedOrders);
    logAudit('UPDATE_ORDER_STATUS', `Updated Order ${orderId} to ${newStatus}`, orderId, 'production_orders');
    return updatedOrder;
  };

  const handleCreateBatch = async (orderId: string) => {
    const newBatch = await batchesApi.createBatch(orderId);
    const updatedBatches = await batchesApi.getAll();
    setBatches(updatedBatches);
    logAudit('CREATE_BATCH', `Created Production Batch ${newBatch.batch_number || newBatch.id}`, newBatch.id, 'production_batches');
    return newBatch;
  };

  const handleGenerateSerials = async (batchId: string) => {
    const generatedResult = await serialNumbersApi.generate(batchId);
    const updatedSerials = await serialNumbersApi.getAll();
    const updatedBatches = await batchesApi.getAll();
    setSerials(updatedSerials);
    setBatches(updatedBatches);
    logAudit('GENERATE_SERIALS', `Generated barcodes for batch ${batchId}`, batchId, 'production_batches');
    return generatedResult;
  };

  const handleUpdateBatchStatus = async (batchId: string, status: ProductionBatch['status']) => {
    await batchesApi.updateStatus(batchId, status);
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status } : b));
    logAudit('UPDATE_BATCH_STATUS', `Updated batch ${batchId} to ${status}`, batchId, 'production_batches');
  };

  const handleUpdateSerialsStatus = async (serialIds: string[], status: Serial['status']) => {
    await serialNumbersApi.updateStatus(serialIds, status);
    setSerials(prev => prev.map(s => serialIds.includes(s.id) ? { ...s, status } : s));
    logAudit('UPDATE_SERIALS_STATUS', `Updated status of ${serialIds.length} serials to ${status}`, serialIds[0], 'serial_numbers');
  };

  const handleAddCase = async (caseData: Omit<ServiceCase, 'id' | 'createdAt' | 'timeline'>) => {
    const newCase = await serviceCasesApi.insert(caseData);
    const updatedCases = await serviceCasesApi.getAll();
    setCases(updatedCases);
    logAudit('CREATE_SERVICE_CASE', `Opened Service Ticket ${newCase.case_number || newCase.id}`, newCase.id, 'service_cases');
  };

  const handleAddTimelineNote = async (caseId: string, note: string) => {
    await serviceCasesApi.insertTimelineNote({ case_id: caseId, note });
    const updatedCases = await serviceCasesApi.getAll();
    setCases(updatedCases);
    logAudit('ADD_CASE_NOTE', `Added note to case ${caseId}`, caseId, 'service_cases');
  };

  const handleUpdateCaseStatus = async (caseId: string, status: ServiceCase['status']) => {
    await serviceCasesApi.updateStatus(caseId, status);
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status } : c));
    logAudit('UPDATE_CASE_STATUS', `Updated Case ${caseId} to ${status}`, caseId, 'service_cases');
  };

  const handleAddReplacement = async (repData: Omit<ReplacementCase, 'id' | 'createdAt'>) => {
    const newRep = await replacementsApi.insert(repData);
    setReplacements(prev => [newRep, ...prev]);
    logAudit('CREATE_REPLACEMENT', `Submitted Replacement ${newRep.id}`, newRep.id, 'replacement_requests');
  };

  const handleUpdateReplacementStatus = async (repId: string, status: ReplacementCase['status'], newSerialId?: string) => {
    await replacementsApi.updateStatus(repId, status, newSerialId);
    setReplacements(prev => prev.map(r => r.id === repId ? { ...r, status, newSerialId } : r));
    logAudit('UPDATE_REPLACEMENT_STATUS', `Updated Replacement ${repId} to ${status}`, repId, 'replacement_requests');
  };

  const handleAddBrand = async (brandData: Omit<Brand, 'id'>) => {
    const newB = await brandsApi.insert({
      id: crypto.randomUUID(),
      name_ar: brandData.nameAr || brandData.name_ar || 'علامة جديدة',
      name_en: brandData.nameEn || brandData.name_en || 'New Brand'
    });
    if (newB) setBrands(prev => [newB, ...prev]);
    if (newB?.id) logAudit('CREATE_BRAND', `Added Brand ${brandData.nameAr}`, newB.id, 'brands');
  };

  const handleAddModel = async (modelData: Omit<ProductModel, 'id'>) => {
    const modelId = crypto.randomUUID();
    const newM = await modelsApi.insert({
      id: modelId,
      brand_id: modelData.brandId || modelData.brand_id || '',
      category_id: modelData.category || modelData.category_id || '',
      name: modelData.name || modelData.name_ar || 'موديل جديد'
    });
    if (newM) setModels(prev => [newM, ...prev]);
    if (newM?.id) logAudit('CREATE_MODEL', `Added Model ${modelData.name}`, newM.id, 'models');
  };

  const handleAddPolicy = async (policyData: Omit<WarrantyPolicy, 'id'>) => {
    const newP = await warrantyPoliciesApi.upsert({
      target_type: policyData.targetType,
      target_id: policyData.targetId,
      duration_years: policyData.durationYears
    });
    const formatted: WarrantyPolicy = {
      id: newP.id,
      targetType: (newP.level_type || policyData.targetType) as any,
      targetId: newP.category_id || newP.brand_id || newP.model_id || policyData.targetId,
      durationYears: newP.duration_years,
      level_type: newP.level_type,
      category_id: newP.category_id || undefined,
      brand_id: newP.brand_id || undefined,
      model_id: newP.model_id || undefined,
      duration_years: newP.duration_years,
      is_active: newP.is_active,
      created_at: newP.created_at
    };
    setPolicies(prev => [...prev, formatted]);
    if (newP?.id) logAudit('CREATE_WARRANTY_POLICY', `Added Policy`, newP.id, 'warranty_policies');
  };

  const handleUpdatePolicy = async (id: string, durationYears: number) => {
    await warrantyPoliciesApi.updateDuration(id, durationYears);
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, durationYears, duration_years: durationYears } : p));
    logAudit('UPDATE_WARRANTY_POLICY', `Updated Policy ${id}`, id, 'warranty_policies');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-400 font-mono text-xs gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>CONNECTING TO SLEEPEE SUPABASE MASTER NODE...</span>
      </div>
    );
  }

  if (dbHealth && !dbHealth.hasCoreTables) {
    return <DatabaseNotDeployedScreen health={dbHealth} onRetry={checkHealth} />;
  }

  if (!user && window.location.pathname !== '/verify') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans dir-rtl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-emerald-600/30">
              S
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              {lang === 'ar' ? 'منصة سليبي للإنتاج والضمان 360' : 'Sleepee Platform Login'}
            </h1>
            <p className="text-xs text-slate-500">
              الشركة العربية لصناعة مراتب السوست والإسفنج ذ.م.م
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
            {isSignUpMode && (
              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-semibold">{lang === 'ar' ? 'الاسم بالكامل' : 'Full Name'} *</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
                  placeholder="محمد أحمد"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-slate-600 font-semibold">{lang === 'ar' ? 'البريد الإلكتروني الرسمي' : 'Email'} *</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono"
                placeholder="operator@sleephigh.com"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-600 font-semibold">{lang === 'ar' ? 'كلمة المرور' : 'Password'} *</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono"
                placeholder="••••••••"
              />
            </div>

            {isSignUpMode && (
              <div className="flex flex-col gap-1">
                <label className="text-slate-600 font-semibold">{t.role} *</label>
                <select
                  value={authRole}
                  onChange={(e) => setAuthRole(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Production Manager">Production Manager</option>
                  <option value="Production Operator">Production Operator</option>
                  <option value="Printing Operator">Printing Operator</option>
                  <option value="Warranty Officer">Warranty Officer</option>
                  <option value="Customer Service Agent">Customer Service Agent</option>
                  <option value="Service Manager">Service Manager</option>
                </select>
              </div>
            )}

            {authError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[11px] font-semibold border border-red-200">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-[11px] font-semibold border border-red-200">
                {authSuccess}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              {isSignUpMode ? (lang === 'ar' ? 'إنشاء حساب جديد' : 'Create Account') : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
            </button>
          </form>

          <div className="text-center space-y-2 border-t border-slate-100 pt-4">
            <button
              onClick={() => setIsSignUpMode(!isSignUpMode)}
              className="text-xs text-emerald-600 font-bold hover:underline"
            >
              {isSignUpMode ? (lang === 'ar' ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'Already have an account? Sign In') : (lang === 'ar' ? 'إنشاء حساب جديد' : 'Need an account? Sign Up')}
            </button>
            <br />
            <a
              href="/verify"
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold inline-block mt-2"
            >
              {lang === 'ar' ? 'الانتقال إلى بوابة التحقق العامة (بدون دخول)' : 'Access Public Warranty Verification Portal'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen font-sans flex flex-col transition-colors ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}
      style={{ fontSize: `${fontSize}px` }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        lang={lang}
        onNavigate={(tab) => {
          navigate(`/${tab}`);
        }}
      />

      <header className={`border-b h-16 px-6 flex items-center justify-between shrink-0 shadow-sm transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
              {lang === 'ar' ? 'منصة سليبي للإنتاج والضمان 360' : 'Sleepee Platform Workspace'}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            {lang === 'ar' ? 'الشركة العربية لصناعة مراتب السوست والإسفنج' : 'Arabian Spring & Foam Mfg.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'بحث شامل (سيريال، أمر، هاتف)...' : 'Global Search...'}</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 bg-white dark:bg-slate-900 text-[10px] font-mono border rounded text-slate-400">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {user && (
            <div className="relative group">
              <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors">
                <User className="w-4 h-4 text-emerald-600" />
                <span>{user.fullName || user.email.split('@')[0]}</span>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-md text-[10px]">
                  {user.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 text-xs hidden group-hover:block transition-all`}>
                <button
                  onClick={signOut}
                  className="w-full text-right px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 font-bold flex items-center gap-2"
                  style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame with React Router DOM Routes */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          lang={lang}
          userRole={user?.role || 'Administrator'}
        />

        <main className={`flex-1 p-6 overflow-y-auto ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              <Route path="/dashboard/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager', 'Production Operator', 'Printing Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager']}>
                  <DashboardView orders={orders} serials={serials} cases={cases} replacements={replacements} lang={lang} onNavigateTo={(t) => navigate(`/${t}`)} />
                </ProtectedRoute>
              } />

              <Route path="/master-data/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager']}>
                  <MasterDataView lang={lang} brands={brands} models={models} categories={categories} productTypes={productTypes} productSizes={productSizes} onAddBrand={handleAddBrand} onAddModel={handleAddModel} />
                </ProtectedRoute>
              } />

              <Route path="/manufacturing-engineering/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager']}>
                  <ManufacturingEngineeringView models={models} brands={brands} currentRole={user?.role || 'Administrator'} lang={lang} onLogAudit={logAudit} />
                </ProtectedRoute>
              } />

              <Route path="/production/wizard" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager', 'Production Operator']}>
                  <ProductionWizardView orders={orders} batches={batches} serials={serials} brands={brands} models={models} categories={categories} productSizes={productSizes} productTypes={productTypes} currentRole={user?.role || 'Administrator'} lang={lang} onAddOrder={handleAddOrder} onUpdateOrderStatus={handleUpdateOrderStatus} onGenerateSerials={handleGenerateSerials} onCreateBatch={handleCreateBatch} />
                </ProtectedRoute>
              } />

              <Route path="/production/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager', 'Production Operator']}>
                  <ProductionView orders={orders} batches={batches} serials={serials} brands={brands} models={models} categories={categories} currentRole={user?.role || 'Administrator'} lang={lang} productSizes={productSizes} onAddOrder={handleAddOrder} onUpdateOrderStatus={handleUpdateOrderStatus} onGenerateSerials={(id) => handleGenerateSerials(id)} onCreateBatch={handleCreateBatch} productTypes={productTypes} />
                </ProtectedRoute>
              } />

              <Route path="/serialization/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager', 'Production Operator']}>
                  <SerializationView lang={lang} batches={batches} models={models} serials={serials} onGenerateSerials={(batchId) => handleGenerateSerials(batchId)} />
                </ProtectedRoute>
              } />

              <Route path="/printing/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Printing Operator', 'Production Manager', 'Production Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager']}>
                  <PrintView batches={batches} serials={serials} brands={brands} models={models} lang={lang} currentRole={user?.role || 'Administrator'} onUpdateBatchStatus={handleUpdateBatchStatus} onUpdateSerialsStatus={handleUpdateSerialsStatus} onLogAudit={logAudit} />
                </ProtectedRoute>
              } />

              <Route path="/label-designer/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Printing Operator', 'Production Manager', 'Production Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager']}>
                  <LabelDesignerView 
                    lang={lang} 
                    categories={categories} 
                    brands={brands} 
                    models={models} 
                    serials={serials} 
                    batches={batches}
                    orders={orders}
                    policies={policies}
                    productSizes={productSizes}
                    productTypes={productTypes}
                    currentRole={user?.role || 'Administrator'} 
                    onLogAudit={logAudit} 
                  />
                </ProtectedRoute>
              } />

              <Route path="/warranty/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager', 'Production Manager', 'Production Operator', 'Printing Operator', 'Read Only User']}>
                  <WarrantyView 
                    serials={serials} 
                    brands={brands} 
                    models={models} 
                    categories={categories}
                    batches={batches}
                    orders={orders}
                    policies={policies} 
                    lang={lang} 
                    currentRole={user?.role || 'Administrator'}
                    onLogAudit={logAudit} 
                  />
                </ProtectedRoute>
              } />

              <Route path="/customer-service/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Customer Service Agent', 'Service Manager']}>
                  <CustomerServiceView serials={serials} customers={customers} cases={cases} brands={brands} models={models} orders={orders} lang={lang} currentUser={user} onAddCase={handleAddCase} onAddTimelineNote={handleAddTimelineNote} onUpdateCaseStatus={handleUpdateCaseStatus} />
                </ProtectedRoute>
              } />

              <Route path="/replacement/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Service Manager']}>
                  <ReplacementsView replacements={replacements} cases={cases} serials={serials} brands={brands} models={models} lang={lang} onAddReplacement={handleAddReplacement} onUpdateReplacementStatus={handleUpdateReplacementStatus} onLogAudit={logAudit} />
                </ProtectedRoute>
              } />

              <Route path="/reports/*" element={
                <ProtectedRoute allowedRoles={['Administrator', 'Production Manager', 'Service Manager', 'Warranty Officer']}>
                  <ReportsView orders={orders} serials={serials} cases={cases} brands={brands} models={models} lang={lang} />
                </ProtectedRoute>
              } />

              <Route path="/admin/*" element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <AdminView brands={brands} categories={categories} models={models} policies={policies} auditLogs={auditLogs} lang={lang} onAddBrand={handleAddBrand} onAddModel={handleAddModel} onAddPolicy={handleAddPolicy} onUpdatePolicy={handleUpdatePolicy} onLogAudit={logAudit} />
                </ProtectedRoute>
              } />

              <Route path="/system/database-status" element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <DatabaseStatusView lang={lang} />
                </ProtectedRoute>
              } />

              <Route path="/verify/*" element={<PublicPortalView lang={lang} />} />
            </Routes>
          </div>
        </main>
      </div>

      <footer className={`border-t py-4 text-center text-xs transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-2.5">
          <div className="flex items-center gap-2 font-bold">
            <Factory className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'الشركة العربية لصناعة مراتب السوست والإسفنج ذ.م.م' : 'Arabian Spring & Foam Mattresses Mfg. Company LTD'}</span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold">
            <button type="button" onClick={() => navigate('/warranty/policies')} className="hover:text-emerald-600 transition-colors">
              {lang === 'ar' ? 'سياسة الضمان' : 'Warranty Policy'}
            </button>
            <a href="mailto:Online@sleephigh.com" className="hover:text-emerald-600 transition-colors">Online@sleephigh.com</a>
            <a href="tel:19707" className="hover:text-emerald-600 transition-colors">19707</a>
            <a href="https://sleephigh.com/ar" target="_blank" rel="noreferrer" className="hover:text-emerald-600 transition-colors">sleephigh.com</a>
            <span className="hidden md:inline">·</span>
            <span>{lang === 'ar' ? 'المنطقة الصناعية الثانية، شارع دايوو، قطعة 145–146، مدينة 6 أكتوبر' : 'Industrial Zone 2, Daewoo Street, Plot 145–146, 6th October City'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
