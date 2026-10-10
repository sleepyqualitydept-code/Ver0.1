/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Clipboard, 
  Check, 
  Play, 
  Award, 
  X, 
  AlertCircle, 
  Hash, 
  Layers,
  ChevronDown,
  ChevronUp,
  Monitor,
  Package,
  Sliders,
  Factory,
  Search,
  CheckCircle2,
  Calendar,
  XCircle,
  FileText,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { Language, translations } from '../utils/translations.ts';
import { batchesApi } from '../api/batchesApi.ts';

interface ProductionViewProps {
  orders: any[];
  batches: any[];
  serials: any[];
  brands: any[];
  models: any[];
  categories: any[];
  currentRole: string;
  lang: Language;
  productSizes: string[];
  productTypes: any[];
  onAddOrder: (lines: any[]) => Promise<void>;
  onUpdateOrderStatus: (id: string, status: any) => Promise<any>;
  onGenerateSerials: (batchId: string) => Promise<any>;
  onCreateBatch: (orderId: string) => Promise<any>;
}

interface DraftGridRow {
  typeCode: string;
  categoryId: string;
  brandId: string;
  modelId: string;
  size: string;
  quantity: number;
  notes: string;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
}

export default function ProductionView({
  orders,
  batches,
  serials,
  brands,
  models,
  categories,
  currentRole,
  lang,
  productSizes,
  productTypes,
  onAddOrder,
  onUpdateOrderStatus,
  onGenerateSerials,
  onCreateBatch
}: ProductionViewProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();

  const currentSubTab = location.pathname.split('/')[2] || 'planning';

  // Excel planning grid state
  const [gridRows, setGridRows] = useState<DraftGridRow[]>([]);
  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected Order for Details View
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // Selected Batch for Details View
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Edit Mode for Draft/Planned Orders
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingLines, setEditingLines] = useState<any[]>([]);

  // Monitoring Filters state
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBrandId, setFilterBrandId] = useState('all');
  const [filterModelId, setFilterModelId] = useState('all');
  const [filterOrderNo, setFilterOrderNo] = useState('');
  const [filterBatchNo, setFilterBatchNo] = useState('');

  // Auto-initialize standard mattress sizes and product types if empty
  // Operational choices come only from Supabase. No fallback/static master data is allowed.
  const defaultSizes = productSizes;
  const defaultTypes = productTypes;

  // Initialize first row when data is available
  useEffect(() => {
    if (gridRows.length === 0 && categories.length > 0 && brands.length > 0 && models.length > 0 && defaultTypes.length > 0 && defaultSizes.length > 0) {
      setGridRows([{ typeCode: '', categoryId: '', brandId: '', modelId: '', size: '', quantity: 0, notes: '' }]);
    }
  }, [categories, brands, models, productSizes, productTypes]);

  // Roles & Permissions check
  const isReadOnly = ['Printing Operator', 'Warranty Officer', 'Customer Service Agent', 'Service Manager', 'Read Only User'].includes(currentRole);
  const isManagerOrAdmin = ['Administrator', 'Production Manager'].includes(currentRole);
  const isOperatorOrAbove = ['Administrator', 'Production Manager', 'Production Operator'].includes(currentRole);

  const addGridRow = () => {
    if (categories.length === 0 || brands.length === 0 || models.length === 0 || defaultTypes.length === 0 || defaultSizes.length === 0) {
      setErrorMsg(lang === 'ar' ? 'لا يمكن إضافة سطر قبل تحميل البيانات الأساسية من Supabase.' : 'Load master data from Supabase before adding a planning row.');
      return;
    }
    setGridRows([...gridRows, { typeCode: '', categoryId: '', brandId: '', modelId: '', size: '', quantity: 0, notes: '' }]);
  };

  const duplicateGridRow = (index: number) => {
    const rowToDup = gridRows[index];
    setGridRows([
      ...gridRows.slice(0, index + 1),
      { ...rowToDup },
      ...gridRows.slice(index + 1)
    ]);
  };

  const removeGridRow = (index: number) => {
    if (gridRows.length > 1) {
      setGridRows(gridRows.filter((_, i) => i !== index));
    }
  };

  const updateGridRow = (index: number, field: keyof DraftGridRow, value: any) => {
    const updated = [...gridRows];
    updated[index] = { ...updated[index], [field]: value };
    
    // Do not silently select a different model when category/brand changes.
    if (field === 'brandId' || field === 'categoryId') updated[index].modelId = '';
    
    setGridRows(updated);
  };

  const handleBulkPaste = () => {
    if (!bulkText.trim()) return;
    try {
      if (!defaultTypes.length || !categories.length || !brands.length || !models.length || !defaultSizes.length) throw new Error(lang === 'ar' ? 'البيانات الأساسية غير محملة من Supabase.' : 'Supabase master data is not loaded.');
      const lines = bulkText.split('\n');
      const parsedRows: DraftGridRow[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('\t'); // tab separated
        if (parts.length < 3) continue;

        // Parse: type, category, brand, model, size, quantity, notes
        const typeStr = parts[0]?.trim();
        const catStr = parts[1]?.trim();
        const brandStr = parts[2]?.trim();
        const modelStr = parts[3]?.trim();
        const sizeStr = parts[4]?.trim() || '';
        const qtyStr = parts[5]?.trim() || '';
        const notesStr = parts[6]?.trim() || '';
        if (!typeStr || !catStr || !brandStr || !modelStr || !sizeStr || !qtyStr) throw new Error('كل سطر مستورد يجب أن يحتوي على النوع والفئة والعلامة والموديل والمقاس والكمية.');
        if (!defaultSizes.includes(sizeStr)) throw new Error(`المقاس غير موجود ضمن بيانات Supabase: ${sizeStr}`);
        const quantity = Number(qtyStr);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`الكمية غير صالحة: ${qtyStr}`);

        // Resolve every imported value against actual Supabase master data; never substitute a different record.
        const matchedType = defaultTypes.find(t => t.code?.toLowerCase() === typeStr.toLowerCase() || t.name_en?.toLowerCase() === typeStr.toLowerCase() || t.name_ar === typeStr);
        const matchedCat = categories.find(c => c.name_en?.toLowerCase() === catStr.toLowerCase() || c.name_ar === catStr);
        const matchedBrand = brands.find(b => b.name_en?.toLowerCase() === brandStr.toLowerCase() || b.name_ar === brandStr);
        const matchedModel = matchedBrand ? models.find(m => m.brand_id === matchedBrand.id && (m.name_en?.toLowerCase() === modelStr.toLowerCase() || m.name_ar === modelStr) && (!matchedCat || m.category_id === matchedCat.id)) : undefined;
        if (!matchedType || !matchedCat || !matchedBrand || !matchedModel) throw new Error(`تعذر مطابقة أحد عناصر السطر مع البيانات الأساسية في Supabase: ${line}`);

        parsedRows.push({ typeCode: matchedType.code, categoryId: matchedCat.id, brandId: matchedBrand.id, modelId: matchedModel.id, size: sizeStr, quantity, notes: notesStr });
      }

      if (parsedRows.length > 0) {
        setGridRows([...gridRows, ...parsedRows]);
        setSuccessMsg(lang === 'ar' ? `تم استيراد ${parsedRows.length} سطور بنجاح` : `Successfully imported ${parsedRows.length} rows`);
        setBulkText('');
        setShowBulkModal(false);
      } else {
        setErrorMsg(lang === 'ar' ? 'فشل تحليل البيانات المدخلة' : 'Failed to parse paste data');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error parsing bulk paste data');
    }
  };

  const submitGridPlan = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    // Validations
    for (let i = 0; i < gridRows.length; i++) {
      const row = gridRows[i];
      if (!row.typeCode || !defaultTypes.some(t => t.code === row.typeCode) || !row.categoryId || !row.brandId || !row.modelId) {
        setErrorMsg(lang === 'ar' ? `السطر ${i + 1}: الفئة، العلامة، والموديل مطلوبة` : `Row ${i + 1}: Category, Brand, and Model are required.`);
        return;
      }
      if (!defaultSizes.includes(row.size) || !/^\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*$/i.test(row.size)) {
        setErrorMsg(lang === 'ar' ? `السطر ${i + 1}: اختر مقاسًا صحيحًا من البيانات الأساسية` : `Row ${i + 1}: choose a valid size from master data.`);
        return;
      }
      if (!row.heightCm || Number(row.heightCm) <= 0 || !Number.isFinite(Number(row.heightCm))) {
        setErrorMsg(lang === 'ar' ? `السطر ${i + 1}: ارتفاع المنتج مطلوب ولا يمكن افتراضه تلقائيًا` : `Row ${i + 1}: product height is required; it will not be assumed.`);
        return;
      }
      if (!Number.isInteger(Number(row.quantity)) || row.quantity <= 0 || isNaN(row.quantity)) {
        setErrorMsg(lang === 'ar' ? `السطر ${i + 1}: الكمية يجب أن تكون أكبر من 0` : `Row ${i + 1}: Quantity must be greater than 0.`);
        return;
      }
    }

    try {
      // Map rows to Database representation
      const linesToInsert = gridRows.map(row => {
        // Parse sizes
        const sizeStr = row.size;
        const [wStr, lStr] = sizeStr.split(/×|x/);
        const width_cm = Number(wStr);
        const length_cm = Number(lStr);
        const height_cm = Number(row.heightCm);

        // Product type must match actual database master data.
        const typeId = defaultTypes.find(t => t.code === row.typeCode)?.id;

        return {
          product_type_id: typeId,
          category_id: row.categoryId,
          brand_id: row.brandId,
          model_id: row.modelId,
          width_cm,
          length_cm,
          height_cm,
          quantity: Number(row.quantity),
          notes: row.notes
        };
      });

      await onAddOrder(linesToInsert);
      setSuccessMsg(lang === 'ar' ? 'تم إنشاء أمر الإنتاج كمسودة بنجاح!' : 'Successfully created production order as a draft!');
      
      // Reset grid
      setGridRows([{ typeCode: '', categoryId: '', brandId: '', modelId: '', size: '', quantity: 0, notes: '' }]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating production order.');
    }
  };

  // State Management functions
  const handleEditOrderStart = (order: any) => {
    setEditingOrderId(order.id);
    const lines = order.production_order_lines || [];
    setEditingLines(lines.map((l: any) => ({
      id: l.id,
      product_type_id: l.product_type_id,
      category_id: l.category_id,
      brand_id: l.brand_id,
      model_id: l.model_id,
      size: `${l.width_cm}×${l.length_cm}`,
      width_cm: l.width_cm,
      length_cm: l.length_cm,
      height_cm: l.height_cm,
      quantity: l.quantity,
      notes: l.notes || ''
    })));
  };

  const handleEditRowUpdate = (index: number, field: string, value: any) => {
    const updated = [...editingLines];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'size') {
      const [wStr, lStr] = value.split(/×|x/);
      updated[index].width_cm = Number(wStr) || 0;
      updated[index].length_cm = Number(lStr) || 0;
    }
    setEditingLines(updated);
  };

  const handleEditOrderSave = async () => {
    try {
      if (editingLines.some((l: any) => !(Number(l.width_cm) > 0) || !(Number(l.length_cm) > 0) || !(Number(l.height_cm) > 0) || !Number.isInteger(Number(l.quantity)) || Number(l.quantity) <= 0)) {
        throw new Error(lang === 'ar' ? 'كل سطر يحتاج مقاسًا وارتفاعًا وكمية صحيحة من البيانات الفعلية.' : 'Each line requires valid source dimensions, height and quantity.');
      }
      const updatedLines = editingLines.map(l => ({
        product_type_id: l.product_type_id,
        category_id: l.category_id,
        brand_id: l.brand_id,
        model_id: l.model_id,
        width_cm: l.width_cm,
        length_cm: l.length_cm,
        height_cm: l.height_cm,
        quantity: Number(l.quantity),
        notes: l.notes
      }));

      // Update lines in Supabase via API directly (since it is nested inside the client)
      const { productionOrdersApi } = await import('../api/productionOrdersApi.ts');
      await productionOrdersApi.updateOrderLines(editingOrderId!, updatedLines);
      
      // Update status back or keep as draft
      setEditingOrderId(null);
      setSuccessMsg(lang === 'ar' ? 'تم حفظ تعديلات أمر الإنتاج بنجاح' : 'Production order updated successfully!');
      
      // Refresh database records
      await onUpdateOrderStatus(editingOrderId!, 'draft'); 
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating order lines.');
    }
  };

  // Convert approved order to production batch
  const handleConvertToBatch = async (orderId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await onCreateBatch(orderId);
      await onUpdateOrderStatus(orderId, 'in_production');
      setSuccessMsg(lang === 'ar' ? 'تم إنشاء دفعة الإنتاج بنجاح وتحويل حالة الأمر قيد التشغيل!' : 'Production batch created successfully! Order is now in production.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error converting order to batch.');
    }
  };

  // Filters calculation for Production Monitoring
  const filteredOrders = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterOrderNo.trim() && !o.order_number?.toLowerCase().includes(filterOrderNo.toLowerCase())) return false;
    
    // Filter lines specifications nested
    if (filterBrandId !== 'all' || filterModelId !== 'all') {
      const lines = o.production_order_lines || [];
      const matchesBrand = filterBrandId === 'all' || lines.some((l: any) => l.brand_id === filterBrandId);
      const matchesModel = filterModelId === 'all' || lines.some((l: any) => l.model_id === filterModelId);
      if (!matchesBrand || !matchesModel) return false;
    }

    if (filterStartDate) {
      const start = new Date(filterStartDate);
      const oDate = new Date(o.created_at);
      if (oDate < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      const oDate = new Date(o.created_at);
      if (oDate > end) return false;
    }

    return true;
  });

  const filteredBatches = batches.filter(b => {
    if (filterBatchNo.trim() && !b.batch_number?.toLowerCase().includes(filterBatchNo.toLowerCase())) return false;
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      if (new Date(b.created_at) < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(b.created_at) > end) return false;
    }
    return true;
  });

  // KPI calculations for Production Monitoring
  const openOrdersCount = orders.filter(o => ['draft', 'planned', 'approved'].includes(o.status)).length;
  const inProductionOrdersCount = orders.filter(o => o.status === 'in_production').length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const cancelledOrdersCount = orders.filter(o => o.status === 'cancelled').length;

  const totalBatchesCount = batches.length;
  const serializedBatchesCount = batches.filter(b => b.status === 'serialized').length;
  const printedBatchesCount = batches.filter(b => b.status === 'printed').length;
  const completedBatchesCount = batches.filter(b => b.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
            <Factory className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {lang === 'ar' ? 'مركز إدارة عمليات الإنتاج' : 'Production Center'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'ar' ? 'تخطيط، جدولة، مراجعة واعتماد أوامر الإنتاج مع إدارة الدفعات ومراقبة جودة التصنيع المباشرة' : 'Planning, state-machine scheduling, approval queues, batch tracking, and production execution control'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit self-start md:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'planning', label: lang === 'ar' ? 'لوحة التخطيط' : 'Planning Board', icon: Layers, visible: !isReadOnly },
            { id: 'orders', label: lang === 'ar' ? 'أوامر الإنتاج' : 'Production Orders', icon: Package, visible: true },
            { id: 'approvals', label: lang === 'ar' ? 'اعتمادات الأوامر' : 'Approval Center', icon: ShieldCheck, visible: isManagerOrAdmin },
            { id: 'batches', label: lang === 'ar' ? 'جدولة الدفعات' : 'Batch Control', icon: Hash, visible: true },
            { id: 'monitoring', label: lang === 'ar' ? 'المراقبة الفورية' : 'Production Monitor', icon: Monitor, visible: true }
          ].map(st => st.visible && (
            <button
              key={st.id}
              onClick={() => {
                setSelectedOrderId(null);
                setSelectedBatchId(null);
                navigate(`/production/${st.id}`);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                currentSubTab === st.id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <st.icon className="w-4 h-4 text-slate-500" />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Warning/Success Toasts */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ==================================================
          TAB 1: PLANNING BOARD
          ================================================== */}
      {currentSubTab === 'planning' && !isReadOnly && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          {(!categories.length || !brands.length || !models.length || !defaultTypes.length || !defaultSizes.length) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{lang === 'ar' ? 'لا توجد بيانات تشغيلية افتراضية. حمّل الفئات والعلامات والموديلات والمقاسات وأنواع المنتجات من Supabase قبل التخطيط.' : 'No fallback operational data is used. Load categories, brands, models, sizes and product types from Supabase before planning.'}</div>}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-emerald-600" />
                <span>{lang === 'ar' ? 'شبكة تخطيط الإنتاج الفوري (طراز إكسل المعتمد)' : 'Excel-style Smart Planning Board'}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {lang === 'ar' ? 'قم بإنشاء صفوف التخطيط، والتحقق من الماستر داتا، ثم اضغط إنشاء أمر إنتاج جديد لاعتماد مسودته' : 'Validate planning line items, resolve Master Data parameters, and compile draft production orders.'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Clipboard className="w-4 h-4" />
                <span>{lang === 'ar' ? 'استيراد بيانات تخطيط / لصق مجمع' : 'Bulk Paste'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner">
            <table className="w-full text-xs text-slate-600 text-right min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="p-3 w-36 text-right">{t.type}</th>
                  <th className="p-3 w-36 text-right">{t.category}</th>
                  <th className="p-3 w-36 text-right">{t.brand_label}</th>
                  <th className="p-3 w-48 text-right">{t.model_label}</th>
                  <th className="p-3 w-32 text-right">{t.size_label}</th>
                  <th className="p-3 w-24 text-right">{lang === 'ar' ? 'الارتفاع (سم)' : 'Height (cm)'}</th>
                  <th className="p-3 w-20 text-center">{t.quantity}</th>
                  <th className="p-3 text-right">{t.notes}</th>
                  <th className="p-3 w-24 text-center">{lang === 'ar' ? 'خيارات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {gridRows.map((row, idx) => {
                  const filteredModels = models.filter(m => m.brand_id === row.brandId && m.category_id === row.categoryId);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      {/* Product Type Selection */}
                      <td className="p-2">
                        <select
                          value={row.typeCode}
                          onChange={(e) => updateGridRow(idx, 'typeCode', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="">{lang === 'ar' ? 'اختر النوع' : 'Select type'}</option>
                          {defaultTypes.map(pt => (
                            <option key={pt.id} value={pt.code}>
                              {lang === 'ar' ? pt.name_ar : pt.name_en} ({pt.code})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Category Selection */}
                      <td className="p-2">
                        <select
                          value={row.categoryId}
                          onChange={(e) => updateGridRow(idx, 'categoryId', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="">{lang === 'ar' ? 'اختر الفئة' : 'Select category'}</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>
                              {lang === 'ar' ? c.name_ar : c.name_en}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Brand Selection */}
                      <td className="p-2">
                        <select
                          value={row.brandId}
                          onChange={(e) => updateGridRow(idx, 'brandId', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="">{lang === 'ar' ? 'اختر العلامة' : 'Select brand'}</option>
                          {brands.map(b => (
                            <option key={b.id} value={b.id}>
                              {lang === 'ar' ? b.name_ar : b.name_en}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Model Selection */}
                      <td className="p-2">
                        <select
                          value={row.modelId}
                          onChange={(e) => updateGridRow(idx, 'modelId', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-medium"
                        >
                          {filteredModels.length === 0 ? (
                            <option value="">{lang === 'ar' ? '-- لا توجد موديلات --' : '-- No Models --'}</option>
                          ) : (
                            filteredModels.map(m => (
                              <option key={m.id} value={m.id}>
                                {lang === 'ar' ? m.name_ar : m.name_en}
                              </option>
                            ))
                          )}
                        </select>
                      </td>

                      {/* Mattress Size Selection */}
                      <td className="p-2">
                        <select
                          value={row.size}
                          onChange={(e) => updateGridRow(idx, 'size', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono font-bold"
                        >
                          <option value="">{lang === 'ar' ? 'اختر المقاس' : 'Select size'}</option>
                          {defaultSizes.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Source-confirmed product height; never silently default it. */}
                      <td className="p-2">
                        <input type="number" min="1" step="0.1" required value={row.heightCm ?? ''} onChange={(e) => updateGridRow(idx, 'heightCm', e.target.value === '' ? undefined : Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono text-center text-slate-800 outline-none focus:border-emerald-500" placeholder="cm" />
                      </td>

                      {/* Quantity Input */}
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.quantity}
                          onChange={(e) => updateGridRow(idx, 'quantity', parseInt(e.target.value, 10))}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-center text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </td>

                      {/* Notes Input */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateGridRow(idx, 'notes', e.target.value)}
                          placeholder={lang === 'ar' ? 'ملاحظات تصنيع...' : 'Technical notes...'}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </td>

                      {/* Actions */}
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => duplicateGridRow(idx)}
                            title={lang === 'ar' ? 'تكرار السطر' : 'Duplicate Row'}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={gridRows.length <= 1}
                            onClick={() => removeGridRow(idx)}
                            title={lang === 'ar' ? 'حذف السطر' : 'Delete Row'}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={addGridRow}
              className="px-4 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة سطر تخطيط' : 'Add Planning Row'}</span>
            </button>

            <button
              onClick={submitGridPlan}
              className="px-6 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/15 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إنشاء أمر إنتاج (مسودة)' : 'Create Production Order'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 w-full max-w-xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-sm font-bold text-slate-800">
                {lang === 'ar' ? 'لصق مجمع لبيانات التخطيط' : 'Bulk Paste Planning Data'}
              </h4>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'الصق السطور مفصولة بـ TAB في الخلية (مثل نسخ خلايا إكسل مباشرة):' : 'Paste spreadsheet tab-delimited cells here directly (Type, Category, Brand, Model, Size, Quantity, Notes):'}
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={lang === 'ar' ? 'انسخ الصفوف من ملف تشغيل موثوق دون إضافة قيم افتراضية' : 'Paste source-confirmed rows only; no sample operational values'}
              className="w-full h-44 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-800 outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleBulkPaste}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                {lang === 'ar' ? 'استيراد الآن' : 'Parse & Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          TAB 2: PRODUCTION ORDERS LIST
          ================================================== */}
      {currentSubTab === 'orders' && !selectedOrderId && !editingOrderId && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>{lang === 'ar' ? 'سجل تتبع وتشغيل أوامر الإنتاج' : 'Active Production Orders Registry'}</span>
          </h3>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {t.no_orders}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-xs text-slate-600 text-right min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">
                    <th className="p-3 text-right">{lang === 'ar' ? 'كود الأمر' : 'Order Number'}</th>
                    <th className="p-3 text-right">{lang === 'ar' ? 'الحالة الحالية' : 'Order Status'}</th>
                    <th className="p-3 text-right">{lang === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}</th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'عدد البنود' : 'Line Items'}</th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'إجمالي الوحدات' : 'Total Qty'}</th>
                    <th className="p-3 text-center w-80">{lang === 'ar' ? 'عمليات تتبع دورة العمل' : 'Workflows & Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((ord) => {
                    const linesCount = ord.production_order_lines?.length || 0;
                    const totalQty = ord.production_order_lines?.reduce((sum: number, l: any) => sum + l.quantity, 0) || 0;
                    const isSerialized = batches.some(b => b.production_order_id === ord.id && b.status === 'serialized');
                    const hasBatch = batches.some(b => b.production_order_id === ord.id);

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedOrderId(ord.id)}
                            className="font-mono font-extrabold text-indigo-600 hover:underline text-xs block text-right"
                          >
                            {ord.order_number || ord.id.slice(0, 12).toUpperCase()}
                          </button>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                            ord.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            ord.status === 'cancelled' ? 'bg-slate-100 text-slate-400' :
                            ord.status === 'in_production' ? 'bg-blue-50 text-blue-700 animate-pulse border border-blue-100' :
                            ord.status === 'approved' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 
                            ord.status === 'planned' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {t[`status_${ord.status}` as keyof typeof t] || ord.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          {new Date(ord.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-center font-bold font-mono text-slate-700">
                          {linesCount}
                        </td>
                        <td className="p-3 text-center font-black font-mono text-emerald-800">
                          {totalQty}
                        </td>
                        <td className="p-3 flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrderId(ord.id)}
                            className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border rounded-lg"
                          >
                            {lang === 'ar' ? 'عرض التفاصيل' : 'Details'}
                          </button>

                          {/* Draft -> Planned */}
                          {ord.status === 'draft' && isOperatorOrAbove && (
                            <button
                              onClick={() => onUpdateOrderStatus(ord.id, 'planned')}
                              className="px-2.5 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 rounded-lg"
                            >
                              {lang === 'ar' ? 'تقديم للاعتماد' : 'Submit Run'}
                            </button>
                          )}

                          {/* Editable only in Draft or Planned */}
                          {(ord.status === 'draft' || ord.status === 'planned') && isOperatorOrAbove && (
                            <button
                              onClick={() => handleEditOrderStart(ord)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 border rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Approved -> Create Batch ("إنشاء دفعة إنتاج") */}
                          {ord.status === 'approved' && isOperatorOrAbove && !hasBatch && (
                            <button
                              onClick={() => handleConvertToBatch(ord.id)}
                              className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'إنشاء دفعة إنتاج' : 'Create Batch'}</span>
                            </button>
                          )}

                          {/* In Production -> Completion */}
                          {ord.status === 'in_production' && isOperatorOrAbove && isSerialized && (
                            <button
                              onClick={() => onUpdateOrderStatus(ord.id, 'completed')}
                              className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'إكمال نهائي' : 'Complete'}</span>
                            </button>
                          )}

                          {/* Cancel Order */}
                          {ord.status !== 'completed' && ord.status !== 'cancelled' && isManagerOrAdmin && (
                            <button
                              onClick={() => onUpdateOrderStatus(ord.id, 'cancelled')}
                              className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200/50 rounded-lg"
                            >
                              {lang === 'ar' ? 'إلغاء الأمر' : 'Cancel'}
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
      )}

      {/* ==================================================
          EDITING WORKFLOW (Inline Detail Editor)
          ================================================== */}
      {editingOrderId && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-bold text-slate-800">
              {lang === 'ar' ? `تعديل سياقات أمر الإنتاج: ${orders.find(o => o.id === editingOrderId)?.order_number || editingOrderId}` : `Editing Order specifications: ${editingOrderId}`}
            </h3>
            <button onClick={() => setEditingOrderId(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-xs text-slate-600 text-right min-w-[800px]">
              <thead>
                <tr className="border-b bg-slate-50 text-[10px] text-slate-500 font-bold uppercase">
                  <th className="p-3 text-right">{t.brand_label}</th>
                  <th className="p-3 text-right">{t.model_label}</th>
                  <th className="p-3 text-right">{t.size_label}</th>
                  <th className="p-3 text-center">{t.quantity}</th>
                  <th className="p-3 text-right">{t.notes}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editingLines.map((line, idx) => {
                  const filteredModels = models.filter(m => m.brand_id === line.brand_id && m.category_id === line.category_id);
                  return (
                    <tr key={idx}>
                      <td className="p-2">
                        <select
                          value={line.brand_id}
                          onChange={(e) => handleEditRowUpdate(idx, 'brand_id', e.target.value)}
                          className="bg-white border rounded-xl p-2 text-xs text-slate-800 w-full"
                        >
                          {brands.map(b => (
                            <option key={b.id} value={b.id}>{lang === 'ar' ? b.name_ar : b.name_en}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={line.model_id}
                          onChange={(e) => handleEditRowUpdate(idx, 'model_id', e.target.value)}
                          className="bg-white border rounded-xl p-2 text-xs text-slate-800 w-full"
                        >
                          {filteredModels.map(m => (
                            <option key={m.id} value={m.id}>{lang === 'ar' ? m.name_ar : m.name_en}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={line.size}
                          onChange={(e) => handleEditRowUpdate(idx, 'size', e.target.value)}
                          className="bg-white border rounded-xl p-2 text-xs text-slate-800 w-full font-mono font-bold"
                        >
                          {defaultSizes.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleEditRowUpdate(idx, 'quantity', parseInt(e.target.value, 10))}
                          className="bg-white border rounded-xl p-2 text-xs w-20 text-center font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 mx-auto block"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => handleEditRowUpdate(idx, 'notes', e.target.value)}
                          className="bg-white border rounded-xl p-2 text-xs text-slate-800 w-full"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingOrderId(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleEditOrderSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              {t.save}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
          TAB 3: APPROVAL CENTER
          ================================================== */}
      {currentSubTab === 'approvals' && isManagerOrAdmin && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>{lang === 'ar' ? 'صندوق اعتماد ومراجعة أوامر الإنتاج المعلقة' : 'Production Orders Approval Center'}</span>
          </h3>

          {orders.filter(o => o.status === 'planned').length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              {lang === 'ar' ? 'لا توجد أوامر إنتاج معلقة بانتظار الاعتماد حالياً.' : 'No production orders currently pending approvals.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-xs text-slate-600 text-right min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">
                    <th className="p-3 text-right">{lang === 'ar' ? 'كود الأمر الكودي' : 'Order Number'}</th>
                    <th className="p-3 text-right">{lang === 'ar' ? 'مقدم الطلب' : 'Submitted By'}</th>
                    <th className="p-3 text-right">{lang === 'ar' ? 'تاريخ التقديم' : 'Submitted Date'}</th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'عدد البنود' : 'Lines Count'}</th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'إجمالي الكمية' : 'Total Quantity'}</th>
                    <th className="p-3 text-center w-64">{lang === 'ar' ? 'مراجعة وقرار التشغيل' : 'Decisions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.filter(o => o.status === 'planned').map((ord) => {
                    const linesCount = ord.production_order_lines?.length || 0;
                    const totalQty = ord.production_order_lines?.reduce((sum: number, l: any) => sum + l.quantity, 0) || 0;

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {ord.order_number || ord.id.slice(0, 12).toUpperCase()}
                        </td>
                        <td className="p-3 text-slate-700">
                          {ord.created_by || 'System Planner'}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          {new Date(ord.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700 font-mono">
                          {linesCount}
                        </td>
                        <td className="p-3 text-center font-black font-mono text-emerald-800">
                          {totalQty}
                        </td>
                        <td className="p-3 flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrderId(ord.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border rounded-lg"
                          >
                            {lang === 'ar' ? 'معاينة البنود' : 'View lines'}
                          </button>
                          
                          <button
                            onClick={() => onUpdateOrderStatus(ord.id, 'approved')}
                            className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 shadow-md shadow-emerald-600/10"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'اعتماد أمر الإنتاج' : 'Approve Order'}</span>
                          </button>

                          <button
                            onClick={() => onUpdateOrderStatus(ord.id, 'draft')}
                            className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/50 rounded-lg"
                          >
                            {lang === 'ar' ? 'إعادة كمسودة' : 'Reject'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================
          TAB 4: BATCH CONTROL & SCHEDULING
          ================================================== */}
      {currentSubTab === 'batches' && !selectedBatchId && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5">
            <Hash className="w-5 h-5 text-emerald-600" />
            <span>{lang === 'ar' ? 'سجل دفعات وجدولة الإنتاج الفني' : 'Production Batches & Serialization Logs'}</span>
          </h3>

          {batches.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {lang === 'ar' ? 'لا توجد دفعات إنتاج معالجة حالياً.' : 'No production batches compiled currently.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((b) => {
                const orderNo = b.production_orders?.order_number || 'ORD-2026-X';
                const totalBatchQty = b.quantity || 10; // compatibility or mapped from lines

                return (
                  <div key={b.id} className="bg-slate-50/50 border border-slate-200/60 p-4 rounded-2xl flex flex-col justify-between space-y-4 shadow-sm hover:border-indigo-500/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-mono font-black text-slate-800 text-xs">
                          {b.batch_number || b.id.slice(0, 12).toUpperCase()}
                        </h4>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Linked Order: {orderNo}</span>
                      </div>
                      
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                        b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        b.status === 'printed' ? 'bg-indigo-100 text-indigo-800' :
                        b.status === 'serialized' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {b.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between items-end border-t pt-2.5">
                      <div className="text-[10px] text-slate-400">
                        <span>Created: {new Date(b.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setSelectedBatchId(b.id)}
                          className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200/30"
                        >
                          {lang === 'ar' ? 'تتبع الدفعة' : 'Track'}
                        </button>

                        {/* Created -> Serialized Integration */}
                        {b.status === 'created' && isOperatorOrAbove && (
                          <button
                            onClick={() => onGenerateSerials(b.id)}
                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                          >
                            {lang === 'ar' ? 'توليد السيريالات' : 'Serialize'}
                          </button>
                        )}
                        
                        {/* Printed -> Completed */}
                        {b.status === 'printed' && isOperatorOrAbove && (
                          <button
                            onClick={async () => {
                              try {
                                await batchesApi.updateStatus(b.id, 'completed');
                                window.location.reload();
                              } catch (err) {
                                console.error('Error completing batch:', err);
                              }
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                          >
                            {lang === 'ar' ? 'إكمال نهائي' : 'Complete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================
          TAB 5: REAL-TIME PRODUCTION MONITORING
          ================================================== */}
      {currentSubTab === 'monitoring' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: lang === 'ar' ? 'أوامر الإنتاج' : 'Total Orders', val: orders.length, bg: 'bg-white text-slate-800' },
              { label: lang === 'ar' ? 'قيد التصنيع' : 'In Production', val: inProductionOrdersCount, bg: 'bg-blue-50 text-blue-800 border-blue-100' },
              { label: lang === 'ar' ? 'دفعات مفعلة' : 'Serialized Batches', val: serializedBatchesCount, bg: 'bg-purple-50 text-purple-800 border-purple-100' },
              { label: lang === 'ar' ? 'دفعات مكتملة' : 'Completed Batches', val: completedBatchesCount, bg: 'bg-emerald-50 text-emerald-800 border-emerald-100' }
            ].map((metric, i) => (
              <div key={i} className={`p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between ${metric.bg}`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-60">{metric.label}</span>
                <span className="text-2xl font-black font-mono mt-2 block">{metric.val}</span>
              </div>
            ))}
          </div>

          {/* Filtering Panel */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'تصفية الفحص ومطابقة حركات خط الإنتاج' : 'Diagnostic Filter & Diagnostic Matrix'}</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">{lang === 'ar' ? 'من تاريخ' : 'Start Date'}</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">{lang === 'ar' ? 'إلى تاريخ' : 'End Date'}</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">{lang === 'ar' ? 'حالة الأمر' : 'Order Status'}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
                  <option value="draft">{t.status_draft}</option>
                  <option value="planned">{t.status_planned}</option>
                  <option value="approved">{t.status_approved}</option>
                  <option value="in_production">{t.status_in_production}</option>
                  <option value="completed">{t.status_completed}</option>
                  <option value="cancelled">{t.status_cancelled}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">{lang === 'ar' ? 'رقم الأمر' : 'Order Number'}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filterOrderNo}
                    onChange={(e) => setFilterOrderNo(e.target.value)}
                    placeholder="ORD-..."
                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 outline-none focus:border-emerald-500 w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-bold">{lang === 'ar' ? 'رقم الدفعة' : 'Batch Number'}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filterBatchNo}
                    onChange={(e) => setFilterBatchNo(e.target.value)}
                    placeholder="BAT-..."
                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 outline-none focus:border-emerald-500 w-full font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Monitoring Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Filtered Orders Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-800 border-b pb-2">
                {lang === 'ar' ? 'متابعة أوامر التشغيل المطابقة' : 'Track Filtered Orders'}
              </h4>
              
              {filteredOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {lang === 'ar' ? 'لا توجد أوامر مطابقة لخيارات التصفية.' : 'No matching orders found.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredOrders.map(o => {
                    const linesCount = o.production_order_lines?.length || 0;
                    return (
                      <div key={o.id} className="p-4 border rounded-2xl flex items-center justify-between bg-slate-50/20 hover:border-indigo-500/50 transition-colors">
                        <div>
                          <span className="font-mono font-bold text-slate-800 text-xs">{o.order_number || o.id.slice(0, 10)}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Lines: {linesCount} • Created: {new Date(o.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          o.status === 'cancelled' ? 'bg-slate-100 text-slate-400' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {o.status.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filtered Batches Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-800 border-b pb-2">
                {lang === 'ar' ? 'متابعة حركات دفعات الإنتاج والترميز' : 'Track Filtered Batches'}
              </h4>
              
              {filteredBatches.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {lang === 'ar' ? 'لا توجد دفعات مطابقة لخيارات التصفية.' : 'No matching batches found.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredBatches.map(b => (
                    <div key={b.id} className="p-4 border rounded-2xl flex items-center justify-between bg-slate-50/20 hover:border-indigo-500/50 transition-colors">
                      <div>
                        <span className="font-mono font-bold text-slate-800 text-xs">{b.batch_number || b.id.slice(0, 10)}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Linked Order: {b.production_orders?.order_number || 'N/A'}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        b.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {b.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          Collapsible Drawer: 03 Production Order Details
          ================================================== */}
      {selectedOrderId && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-6">
          {(() => {
            const ord = orders.find(o => o.id === selectedOrderId);
            if (!ord) return null;

            const lines = ord.production_order_lines || [];
            const totalQty = lines.reduce((sum: number, l: any) => sum + l.quantity, 0);

            return (
              <>
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <span>{lang === 'ar' ? `تفاصيل أمر الإنتاج الفني: ${ord.order_number}` : `Production Order Details: ${ord.order_number}`}</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">UUID: {ord.id}</span>
                  </div>
                  <button onClick={() => setSelectedOrderId(null)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Header Information */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-50/50 p-4 rounded-2xl">
                  <div>
                    <span className="text-slate-400 block font-bold">{lang === 'ar' ? 'الحالة الحالية' : 'Status'}</span>
                    <span className="text-slate-700 font-black block mt-1 uppercase">{ord.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">{lang === 'ar' ? 'تاريخ التخطيط' : 'Created Date'}</span>
                    <span className="text-slate-700 font-mono block mt-1">{new Date(ord.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">{lang === 'ar' ? 'إجمالي الوحدات' : 'Total Quantity'}</span>
                    <span className="text-slate-700 font-black font-mono block mt-1 text-emerald-700">{totalQty}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">{lang === 'ar' ? 'خطوط المواصفات' : 'Line Count'}</span>
                    <span className="text-slate-700 font-mono block mt-1 font-extrabold">{lines.length} lines</span>
                  </div>
                </div>

                {/* Lines Details Table */}
                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full text-xs text-slate-600 text-right min-w-[700px]">
                    <thead>
                      <tr className="border-b bg-slate-50 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="p-3 text-right">{t.type}</th>
                        <th className="p-3 text-right">{t.category}</th>
                        <th className="p-3 text-right">{t.brand_label}</th>
                        <th className="p-3 text-right">{t.model_label}</th>
                        <th className="p-3 text-center">{t.size_label} (W×L×H)</th>
                        <th className="p-3 text-center">{t.quantity}</th>
                        <th className="p-3 text-right">{t.notes}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((l: any, i: number) => {
                        const brandName = l.brands?.name_ar || 'سليبي';
                        const modelName = l.models?.name_ar || 'ماجستي';
                        const catName = l.categories?.name_ar || 'مراتب';
                        const typeCode = l.product_types?.code || 'MAT-STD';

                        return (
                          <tr key={l.id || i} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-700">{typeCode}</td>
                            <td className="p-3">{catName}</td>
                            <td className="p-3 font-semibold">{brandName}</td>
                            <td className="p-3 font-medium text-slate-700">{modelName}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-800">
                              {l.width_cm} × {l.length_cm} × {l.height_cm} سم
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-800">{l.quantity}</td>
                            <td className="p-3 text-slate-400 text-xs">{l.notes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedOrderId(null)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                  >
                    {lang === 'ar' ? 'رجوع للسجل' : 'Back'}
                  </button>
                  
                  {ord.status === 'draft' && isOperatorOrAbove && (
                    <button
                      onClick={() => {
                        onUpdateOrderStatus(ord.id, 'planned');
                        setSelectedOrderId(null);
                      }}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
                    >
                      {lang === 'ar' ? 'تقديم للاعتماد' : 'Submit for Approval'}
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ==================================================
          Collapsible Drawer: 05 Batch Details
          ================================================== */}
      {selectedBatchId && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-6">
          {(() => {
            const b = batches.find(x => x.id === selectedBatchId);
            if (!b) return null;

            const orderNo = b.production_orders?.order_number || 'N/A';
            const matchedSerials = serials.filter(s => s.batch_id === b.id || s.batchId === b.id);

            return (
              <>
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <Hash className="w-5 h-5 text-emerald-600" />
                      <span>{lang === 'ar' ? `تفاصيل دفعة الإنتاج: ${b.batch_number || b.batchId}` : `Batch Details: ${b.batch_number}`}</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Linked Order: {orderNo}</span>
                  </div>
                  <button onClick={() => setSelectedBatchId(null)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="p-4 border rounded-2xl bg-slate-50">
                    <span className="text-[10px] text-slate-400 font-bold block">Status</span>
                    <span className="text-xs font-black block mt-1 text-slate-800 uppercase">{b.status}</span>
                  </div>
                  <div className="p-4 border rounded-2xl bg-slate-50">
                    <span className="text-[10px] text-slate-400 font-bold block">Generated Serials</span>
                    <span className="text-xs font-black font-mono block mt-1 text-purple-700">{matchedSerials.length} codes</span>
                  </div>
                  <div className="p-4 border rounded-2xl bg-slate-50">
                    <span className="text-[10px] text-slate-400 font-bold block">Production Date</span>
                    <span className="text-xs font-mono font-bold block mt-1 text-slate-700">{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Serial list in Batch */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">{lang === 'ar' ? 'قائمة الأكواد التسلسلية المسجلة:' : 'Serialized Barcodes List:'}</h4>
                  
                  {matchedSerials.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/50 rounded-2xl text-slate-400 text-xs">
                      {lang === 'ar' ? 'لم يتم توليد أي سيريال لهذه الدفعة حتى الآن' : 'No serials generated for this batch yet.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-1">
                      {matchedSerials.map((s, i) => (
                        <div key={s.id || i} className="p-3 border rounded-xl bg-slate-50/50 flex items-center justify-between text-xs font-mono">
                          <span className="font-extrabold text-slate-800">{s.serial_number || s.serialNumber}</span>
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] rounded font-bold uppercase">{s.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedBatchId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                  >
                    {t.close}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
