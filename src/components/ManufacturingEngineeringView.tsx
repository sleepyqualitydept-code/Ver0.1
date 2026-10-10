import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, Factory, Layers, Plus, RefreshCw, Save, Settings2 } from 'lucide-react';
import { Language } from '../utils/translations.ts';
import { manufacturingEngineeringApi } from '../api/manufacturingEngineeringApi.ts';

interface Props {
  models: any[];
  brands: any[];
  currentRole: string;
  lang: Language;
  onLogAudit?: (action: string, details: string, recordId?: string, tableName?: string) => void;
}

type Tab = 'spec' | 'bom' | 'routing';
const departments = [
  { value: 'wire_chassis', ar: 'السلك وتكوين الشاسيه', en: 'Wire & Chassis Formation' },
  { value: 'quilting_tailoring', ar: 'التطريز والتفصيل', en: 'Quilting & Tailoring' },
  { value: 'upholstery_assembly', ar: 'التنجيد والتجميع', en: 'Upholstery & Assembly' },
  { value: 'tape_edge', ar: 'التيب', en: 'Tape Edge' },
  { value: 'packaging', ar: 'التغليف', en: 'Packaging' }
];
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-[11px] font-bold text-slate-600';
const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ManufacturingEngineeringView({ models, brands, currentRole, lang, onLogAudit }: Props) {
  const ar = lang === 'ar';
  const canEdit = currentRole === 'Administrator';
  const [tab, setTab] = useState<Tab>('bom');
  const [modelId, setModelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [spec, setSpec] = useState<any>({ construction_type: '', manufacturing_system: '', face_configuration: '', spring_wire_diameter_mm: '', notes: '', source_reference: '' });
  const [bomVersions, setBomVersions] = useState<any[]>([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  const [bomComponents, setBomComponents] = useState<any[]>([]);
  const [routingVersions, setRoutingVersions] = useState<any[]>([]);
  const [selectedRoutingId, setSelectedRoutingId] = useState('');
  const [routingSteps, setRoutingSteps] = useState<any[]>([]);

  const selectedModel = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);
  const selectedBrand = useMemo(() => brands.find((b) => b.id === (selectedModel?.brand_id || selectedModel?.brandId)), [brands, selectedModel]);

  const [bomVersionCode, setBomVersionCode] = useState('');
  const [bomSource, setBomSource] = useState('');
  const [bomNotes, setBomNotes] = useState('');
  const [component, setComponent] = useState<any>({ sequence_no: '1', component_type: '', component_code: '', component_name_ar: '', component_name_en: '', quantity: '', unit_of_measure: '', length_cm: '', width_cm: '', height_cm: '', face_scope: '', attachment_method: '', is_required: true, source_reference: '', source_description: '', notes: '' });
  const [routingVersionCode, setRoutingVersionCode] = useState('');
  const [routingSystem, setRoutingSystem] = useState('');
  const [formingLine, setFormingLine] = useState('');
  const [sourceMinutes, setSourceMinutes] = useState('');
  const [sourceOutputQuantity, setSourceOutputQuantity] = useState('');
  const [sourceTimeScope, setSourceTimeScope] = useState(ar ? 'إجمالي أزمنة الأقسام الفعلية كما في المصدر' : 'Aggregate source time across actual factory departments');
  const [routingSource, setRoutingSource] = useState('');
  const [routingNotes, setRoutingNotes] = useState('');
  const [step, setStep] = useState<any>({ department_code: 'wire_chassis', operation_name_ar: '', operation_name_en: '', machine_or_line: '', estimated_minutes: '', measured_minutes: '', repeat_group: '', is_optional: false, source_reference: '', notes: '' });

  const loadForModel = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [loadedSpec, loadedBomVersions, loadedRoutingVersions] = await Promise.all([
        manufacturingEngineeringApi.getModelSpec(id),
        manufacturingEngineeringApi.getBomVersions(id),
        manufacturingEngineeringApi.getRoutingVersions(id)
      ]);
      setSpec({
        construction_type: loadedSpec?.construction_type || '',
        manufacturing_system: loadedSpec?.manufacturing_system || '',
        face_configuration: loadedSpec?.face_configuration || '',
        spring_wire_diameter_mm: loadedSpec?.spring_wire_diameter_mm == null ? '' : String(loadedSpec.spring_wire_diameter_mm),
        notes: loadedSpec?.notes || '',
        source_reference: loadedSpec?.source_reference || ''
      });
      setBomVersions(loadedBomVersions);
      setRoutingVersions(loadedRoutingVersions);
      const nextBomId = loadedBomVersions[0]?.id || '';
      const nextRoutingId = loadedRoutingVersions[0]?.id || '';
      setSelectedBomId(nextBomId);
      setSelectedRoutingId(nextRoutingId);
      setBomComponents(nextBomId ? await manufacturingEngineeringApi.getBomComponents(nextBomId) : []);
      setRoutingSteps(nextRoutingId ? await manufacturingEngineeringApi.getRoutingSteps(nextRoutingId) : []);
    } catch (e: any) {
      setError(e.message || (ar ? 'تعذر تحميل بيانات هندسة المنتج من Supabase.' : 'Could not load engineering data from Supabase.'));
      setBomVersions([]); setRoutingVersions([]); setBomComponents([]); setRoutingSteps([]);
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => {
    if (!modelId && models.length) setModelId(models[0].id);
  }, [models, modelId]);
  useEffect(() => { if (modelId) void loadForModel(modelId); }, [modelId, loadForModel]);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setSuccess('');
    try { await action(); }
    catch (e: any) { setError(e.message || (ar ? 'فشلت العملية.' : 'Operation failed.')); }
    finally { setBusy(false); }
  };

  const saveSpec = () => runAction(async () => {
    if (!modelId) throw new Error(ar ? 'اختر الموديل أولًا.' : 'Select a model first.');
    const saved = await manufacturingEngineeringApi.saveModelSpec({
      model_id: modelId,
      construction_type: spec.construction_type.trim() || null,
      manufacturing_system: spec.manufacturing_system.trim() || null,
      face_configuration: spec.face_configuration.trim() || null,
      spring_wire_diameter_mm: numberOrNull(String(spec.spring_wire_diameter_mm)),
      notes: spec.notes.trim() || null,
      source_reference: spec.source_reference.trim() || null
    });
    onLogAudit?.('SAVE_MODEL_ENGINEERING_SPEC', `Saved model engineering specification for ${selectedModel?.name_ar || selectedModel?.name_en || modelId}`, saved.id, 'model_engineering_specs');
    setSuccess(ar ? 'تم حفظ المواصفات الفنية في Supabase.' : 'Engineering specifications saved to Supabase.');
    await loadForModel(modelId);
  });

  const createBomDraft = () => runAction(async () => {
    if (!modelId || !bomVersionCode.trim()) throw new Error(ar ? 'اختر الموديل واكتب رمز إصدار BOM.' : 'Select a model and enter a BOM version code.');
    const created = await manufacturingEngineeringApi.createBomDraft({ model_id: modelId, version_code: bomVersionCode.trim(), source_reference: bomSource.trim() || null, notes: bomNotes.trim() || null });
    setBomVersionCode(''); setBomSource(''); setBomNotes('');
    onLogAudit?.('CREATE_BOM_DRAFT', `Created BOM draft ${created.version_code}`, created.id, 'product_bom_versions');
    setSuccess(ar ? 'تم إنشاء إصدار BOM كمسودة. لم يتم اعتماده أو نشره.' : 'BOM version draft created. It is not approved or published.');
    await loadForModel(modelId);
    setSelectedBomId(created.id);
    setBomComponents([]);
  });

  const addComponent = () => runAction(async () => {
    const activeVersion = bomVersions.find((v) => v.id === selectedBomId);
    if (!selectedBomId || activeVersion?.status !== 'draft') throw new Error(ar ? 'اختر إصدار BOM بحالة مسودة.' : 'Select a draft BOM version.');
    if (!component.component_name_ar.trim() || !component.quantity || Number(component.quantity) <= 0 || !component.unit_of_measure.trim()) throw new Error(ar ? 'اسم المكون والكمية ووحدة القياس مطلوبة.' : 'Component name, quantity, and unit are required.');
    for (const [field, label] of [['length_cm', ar ? 'الطول' : 'length'], ['width_cm', ar ? 'العرض' : 'width'], ['height_cm', ar ? 'الارتفاع' : 'height']] as const) {
      const raw = String(component[field] ?? '').trim();
      if (raw && !(Number(raw) > 0)) throw new Error(ar ? `${label} يجب أن يكون أكبر من صفر أو يترك فارغًا.` : `${label} must be greater than zero or left blank.`);
    }
    const created = await manufacturingEngineeringApi.addBomComponent({
      bom_version_id: selectedBomId, sequence_no: Math.max(1, Number(component.sequence_no) || bomComponents.length + 1),
      component_type: component.component_type.trim() || null, component_code: component.component_code.trim() || null,
      component_name_ar: component.component_name_ar.trim(), component_name_en: component.component_name_en.trim() || null,
      quantity: Number(component.quantity), unit_of_measure: component.unit_of_measure.trim(),
      length_cm: numberOrNull(component.length_cm), width_cm: numberOrNull(component.width_cm), height_cm: numberOrNull(component.height_cm),
      face_scope: component.face_scope.trim() || null, attachment_method: component.attachment_method.trim() || null,
      is_required: Boolean(component.is_required), source_reference: component.source_reference.trim() || null,
      source_description: component.source_description.trim() || null, notes: component.notes.trim() || null
    });
    onLogAudit?.('ADD_BOM_COMPONENT', `Added BOM component ${created.component_code || created.component_name_ar}`, created.id, 'product_bom_components');
    setComponent((prev: any) => ({ ...prev, component_type: '', component_code: '', component_name_ar: '', component_name_en: '', quantity: '', unit_of_measure: '', length_cm: '', width_cm: '', height_cm: '', face_scope: '', attachment_method: '', source_reference: '', source_description: '', notes: '', sequence_no: String(Number(prev.sequence_no || 1) + 1) }));
    setSuccess(ar ? 'تم حفظ المكون في إصدار BOM المسودة.' : 'Component saved to the draft BOM.');
    setBomComponents(await manufacturingEngineeringApi.getBomComponents(selectedBomId));
  });

  const createRoutingDraft = () => runAction(async () => {
    if (!modelId || !routingVersionCode.trim()) throw new Error(ar ? 'اختر الموديل واكتب رمز إصدار Routing.' : 'Select a model and enter a routing version code.');
    if (sourceMinutes.trim() && !(Number(sourceMinutes) > 0)) throw new Error(ar ? 'وقت المصدر يجب أن يكون أكبر من صفر أو يترك فارغًا.' : 'Source minutes must be greater than zero or left blank.');
    if (sourceOutputQuantity.trim() && !(Number(sourceOutputQuantity) > 0)) throw new Error(ar ? 'كمية إنتاج المصدر يجب أن تكون أكبر من صفر أو تترك فارغة.' : 'Source output quantity must be greater than zero or left blank.');
    const created = await manufacturingEngineeringApi.createRoutingDraft({
      model_id: modelId, version_code: routingVersionCode.trim(), manufacturing_system: routingSystem.trim() || null,
      forming_line: formingLine.trim() || null, source_total_minutes: numberOrNull(sourceMinutes),
      source_output_quantity: numberOrNull(sourceOutputQuantity), source_time_scope: sourceTimeScope.trim() || null,
      source_reference: routingSource.trim() || null, notes: routingNotes.trim() || null
    });
    onLogAudit?.('CREATE_ROUTING_DRAFT', `Created routing draft ${created.version_code}`, created.id, 'manufacturing_routing_versions');
    setRoutingVersionCode(''); setFormingLine(''); setSourceMinutes(''); setSourceOutputQuantity(''); setRoutingSource(''); setRoutingNotes('');
    setSuccess(ar ? 'تم إنشاء إصدار Routing كمسودة. أزمنة المصدر محفوظة منفصلة عن أزمنة العمليات.' : 'Routing draft created. Source total time remains separate from operation-level times.');
    await loadForModel(modelId);
    setSelectedRoutingId(created.id); setRoutingSteps([]);
  });

  const addRoutingStep = () => runAction(async () => {
    const activeVersion = routingVersions.find((v) => v.id === selectedRoutingId);
    if (!selectedRoutingId || activeVersion?.status !== 'draft') throw new Error(ar ? 'اختر إصدار Routing بحالة مسودة.' : 'Select a draft routing version.');
    if (!step.operation_name_ar.trim()) throw new Error(ar ? 'اسم العملية مطلوب.' : 'Operation name is required.');
    if (step.estimated_minutes.trim() && !(Number(step.estimated_minutes) > 0)) throw new Error(ar ? 'الزمن المقدر يجب أن يكون أكبر من صفر أو يترك فارغًا.' : 'Estimated minutes must be greater than zero or left blank.');
    if (step.measured_minutes.trim() && !(Number(step.measured_minutes) > 0)) throw new Error(ar ? 'الزمن المقاس يجب أن يكون أكبر من صفر أو يترك فارغًا.' : 'Measured minutes must be greater than zero or left blank.');
    const created = await manufacturingEngineeringApi.addRoutingStep({
      routing_version_id: selectedRoutingId, step_sequence: routingSteps.length + 1,
      department_code: step.department_code, operation_name_ar: step.operation_name_ar.trim(),
      operation_name_en: step.operation_name_en.trim() || null, machine_or_line: step.machine_or_line.trim() || null,
      estimated_minutes: numberOrNull(step.estimated_minutes), measured_minutes: numberOrNull(step.measured_minutes),
      repeat_group: step.repeat_group.trim() || null, is_optional: Boolean(step.is_optional),
      source_reference: step.source_reference.trim() || null, notes: step.notes.trim() || null
    });
    onLogAudit?.('ADD_ROUTING_STEP', `Added routing operation ${created.operation_name_ar}`, created.id, 'manufacturing_routing_steps');
    setStep((prev: any) => ({ ...prev, operation_name_ar: '', operation_name_en: '', machine_or_line: '', estimated_minutes: '', measured_minutes: '', repeat_group: '', source_reference: '', notes: '', is_optional: false }));
    setSuccess(ar ? 'تم حفظ العملية بالترتيب المحدد.' : 'Routing operation saved in sequence.');
    setRoutingSteps(await manufacturingEngineeringApi.getRoutingSteps(selectedRoutingId));
  });

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'bom', label: ar ? 'BOM Builder ومكونات المنتج' : 'BOM Builder', icon: Layers },
    { id: 'routing', label: ar ? 'Routing ومراحل التشغيل' : 'Routing & Operations', icon: WorkflowIcon },
    { id: 'spec', label: ar ? 'المواصفات الهندسية للموديل' : 'Model Engineering', icon: Settings2 }
  ];
  const selectedBom = bomVersions.find((v) => v.id === selectedBomId);
  const selectedRouting = routingVersions.find((v) => v.id === selectedRoutingId);

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Factory className="h-7 w-7" /></div><div><h1 className="text-xl font-black text-slate-900">{ar ? 'هندسة المنتج والتصنيع' : 'Product Engineering & Manufacturing'}</h1><p className="mt-1 max-w-3xl text-xs leading-6 text-slate-600">{ar ? 'إدارة مواصفات الموديل ومسودات BOM وRouting. مصدر البيانات Supabase؛ لا توجد قوائم تشغيلية وهمية أو استيراد تلقائي لملفات Excel.' : 'Manage model specifications and draft BOM/routing versions using Supabase as the source of truth. No mock operational data or automatic workbook import is used.'}</p></div></div>
          <div className="min-w-[260px]"><label className={labelClass}>{ar ? 'الموديل' : 'Model'}</label><select className={inputClass} value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!models.length}><option value="">{ar ? 'اختر موديلًا من قاعدة البيانات' : 'Select a database model'}</option>{models.map((m) => <option key={m.id} value={m.id}>{m.name_ar || m.name_en || m.name} — {brands.find((b) => b.id === (m.brand_id || m.brandId))?.name_ar || ''}</option>)}</select></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${tab === item.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}><Icon className="h-4 w-4" />{item.label}</button>; })}<button onClick={() => modelId && void loadForModel(modelId)} disabled={!modelId || loading} className="mr-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{ar ? 'تحديث من قاعدة البيانات' : 'Refresh from database'}</button></div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{success}</div>}
      {!selectedModel && <div className={panelClass}><p className="text-xs text-slate-600">{ar ? 'لا توجد موديلات محملة من Supabase. راجع اتصال قاعدة البيانات والبيانات الأساسية.' : 'No models were loaded from Supabase. Check the connection and live master data.'}</p></div>}

      {selectedModel && tab === 'spec' && <section className={`${panelClass} space-y-4`}>
        <div><h2 className="text-sm font-black text-slate-900">{ar ? 'المواصفات الهندسية للموديل' : 'Model Engineering Specification'}</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">{ar ? 'تسجل القيم المؤكدة فقط. يمكن ترك الحقول غير المحسومة فارغة وتوثيق مصدر كل قيمة.' : 'Enter only confirmed values. Leave unresolved fields blank and record the source of each value.'}</p></div>
        {!canEdit && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{ar ? 'العرض متاح؛ تعديل البيانات الرئيسية محصور في Administrator وفق حوكمة المشروع.' : 'Read-only. Master-data edits are reserved for Administrator under project governance.'}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className={labelClass}>{ar ? 'نوع التركيب (كما بالمصدر)' : 'Construction type (source term)'}</label><input className={inputClass} value={spec.construction_type} disabled={!canEdit} onChange={(e) => setSpec({ ...spec, construction_type: e.target.value })} /></div>
          <div><label className={labelClass}>{ar ? 'نظام التصنيع' : 'Manufacturing system'}</label><input className={inputClass} value={spec.manufacturing_system} disabled={!canEdit} onChange={(e) => setSpec({ ...spec, manufacturing_system: e.target.value })} placeholder={ar ? 'مثال: أمريكي / ألماني — وفق المصدر' : 'e.g. American / German — source-confirmed'} /></div>
          <div><label className={labelClass}>{ar ? 'تكوين الأوجه' : 'Face configuration'}</label><input className={inputClass} value={spec.face_configuration} disabled={!canEdit} onChange={(e) => setSpec({ ...spec, face_configuration: e.target.value })} placeholder={ar ? 'متماثل / وجه علوي / Pillow Top...' : 'Symmetric / top-only / Pillow Top...'} /></div>
          <div><label className={labelClass}>{ar ? 'قطر سلك السوست (مم)' : 'Spring wire diameter (mm)'}</label><input className={inputClass} type="number" min="0.01" step="0.01" value={spec.spring_wire_diameter_mm} disabled={!canEdit} onChange={(e) => setSpec({ ...spec, spring_wire_diameter_mm: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={labelClass}>{ar ? 'مرجع المصدر' : 'Source reference'}</label><input className={inputClass} value={spec.source_reference} disabled={!canEdit} onChange={(e) => setSpec({ ...spec, source_reference: e.target.value })} placeholder="Models BOM.xlsx / sheet name" /></div>
          <div className="md:col-span-2"><label className={labelClass}>{ar ? 'ملاحظات / نقاط غير محسومة' : 'Notes / unresolved points'}</label><textarea className={inputClass} rows={3} value={spec.notes} disabled={!canEdit} onChange={(e) => setSpec({ ...spec, notes: e.target.value })} /></div>
        </div>
        {canEdit && <button onClick={() => void saveSpec()} disabled={busy || !modelId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{ar ? 'حفظ المواصفات' : 'Save specification'}</button>}
      </section>}

      {selectedModel && tab === 'bom' && <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className={`${panelClass} space-y-4`}>
          <div><h2 className="text-sm font-black text-slate-900">{ar ? 'إصدارات BOM' : 'BOM Versions'}</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">{ar ? 'لا يتم تطبيق قاعدة طرح عامة على المكونات. أدخل أبعاد كل مكوّن من مصدر الموديل، وسجّل التعارضات بدل تعديلها.' : 'No global dimension-subtraction rule is applied. Capture each component from its model source and record discrepancies instead of silently correcting them.'}</p></div>
          <div className="space-y-2"><label className={labelClass}>{ar ? 'اختيار الإصدار' : 'Select version'}</label><select className={inputClass} value={selectedBomId} onChange={async (e) => { setSelectedBomId(e.target.value); setBomComponents(e.target.value ? await manufacturingEngineeringApi.getBomComponents(e.target.value).catch((err) => { setError(err.message); return []; }) : []); }}><option value="">{ar ? 'لا يوجد إصدار محدد' : 'No version selected'}</option>{bomVersions.map((v) => <option key={v.id} value={v.id}>{v.version_code} · {v.status}</option>)}</select></div>
          {selectedBom && <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600"><div><b>{ar ? 'الحالة:' : 'Status:'}</b> {selectedBom.status}</div><div><b>{ar ? 'مرجع المصدر:' : 'Source:'}</b> {selectedBom.source_reference || '—'}</div><div>{selectedBom.notes || ''}</div></div>}
          {canEdit && <div className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-black text-slate-800">{ar ? 'إنشاء إصدار مسودة' : 'Create draft version'}</h3><div className="space-y-3"><div><label className={labelClass}>{ar ? 'رمز الإصدار *' : 'Version code *'}</label><input className={inputClass} value={bomVersionCode} onChange={(e) => setBomVersionCode(e.target.value)} placeholder="BOM-2026-01" /></div><div><label className={labelClass}>{ar ? 'مرجع المصدر' : 'Source reference'}</label><input className={inputClass} value={bomSource} onChange={(e) => setBomSource(e.target.value)} placeholder="Models BOM.xlsx / model sheet" /></div><div><label className={labelClass}>{ar ? 'ملاحظات' : 'Notes'}</label><textarea rows={2} className={inputClass} value={bomNotes} onChange={(e) => setBomNotes(e.target.value)} /></div><button onClick={() => void createBomDraft()} disabled={busy || !bomVersionCode.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" />{ar ? 'إنشاء مسودة' : 'Create draft'}</button></div></div>}
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">{ar ? 'دورة اعتماد ونشر إصدارات BOM ما زالت قرارًا مطلوبًا. هذه النسخة تدعم المسودات فقط، ولا تحولها تلقائيًا إلى إصدار معتمد.' : 'The approval/effectivity lifecycle for engineering versions is still an open decision. This candidate supports drafts only and does not publish them automatically.'}</p>
        </section>
        <section className={`${panelClass} space-y-4`}>
          <div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-900">{ar ? 'مكونات الإصدار' : 'Version Components'}</h2><p className="mt-1 text-[11px] text-slate-500">{selectedBom ? `${selectedBom.version_code} · ${bomComponents.length}` : (ar ? 'اختر إصدارًا لعرض مكوناته' : 'Choose a version to view its components')}</p></div><ClipboardList className="h-5 w-5 text-emerald-600" /></div>
          {selectedBom?.status === 'draft' && canEdit && <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 md:grid-cols-2">
            <div><label className={labelClass}>{ar ? 'اسم المكون بالعربية *' : 'Component name *'}</label><input className={inputClass} value={component.component_name_ar} onChange={(e) => setComponent({ ...component, component_name_ar: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'اسم المكون بالإنجليزية' : 'Component name (English)'}</label><input className={inputClass} value={component.component_name_en} onChange={(e) => setComponent({ ...component, component_name_en: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'كود الخامة كما بالمصدر' : 'Source material code'}</label><input className={inputClass} value={component.component_code} onChange={(e) => setComponent({ ...component, component_code: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'نوع المكون' : 'Component type'}</label><input className={inputClass} value={component.component_type} onChange={(e) => setComponent({ ...component, component_type: e.target.value })} placeholder={ar ? 'طبقة / بلصة / قماش / تغليف...' : 'Layer / patch / fabric / packaging...'} /></div>
            <div><label className={labelClass}>{ar ? 'الكمية *' : 'Quantity *'}</label><input className={inputClass} type="number" min="0.00001" step="0.00001" value={component.quantity} onChange={(e) => setComponent({ ...component, quantity: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'وحدة القياس *' : 'Unit *'}</label><input className={inputClass} value={component.unit_of_measure} onChange={(e) => setComponent({ ...component, unit_of_measure: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'الطول (سم)' : 'Length (cm)'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={component.length_cm} onChange={(e) => setComponent({ ...component, length_cm: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'العرض (سم)' : 'Width (cm)'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={component.width_cm} onChange={(e) => setComponent({ ...component, width_cm: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'الارتفاع (سم)' : 'Height (cm)'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={component.height_cm} onChange={(e) => setComponent({ ...component, height_cm: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'الوجه / النطاق' : 'Face / scope'}</label><input className={inputClass} value={component.face_scope} onChange={(e) => setComponent({ ...component, face_scope: e.target.value })} placeholder={ar ? 'علوي / سفلي / وجهان / داخلي' : 'Top / bottom / both / internal'} /></div>
            <div><label className={labelClass}>{ar ? 'طريقة التثبيت' : 'Attachment method'}</label><input className={inputClass} value={component.attachment_method} onChange={(e) => setComponent({ ...component, attachment_method: e.target.value })} /></div>
            <div><label className={labelClass}>{ar ? 'مرجع المصدر' : 'Source reference'}</label><input className={inputClass} value={component.source_reference} onChange={(e) => setComponent({ ...component, source_reference: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelClass}>{ar ? 'الوصف الأصلي كما ورد في المصدر' : 'Original source description'}</label><textarea className={inputClass} rows={2} value={component.source_description} onChange={(e) => setComponent({ ...component, source_description: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelClass}>{ar ? 'ملاحظات / تعارضات' : 'Notes / conflicts'}</label><textarea className={inputClass} rows={2} value={component.notes} onChange={(e) => setComponent({ ...component, notes: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 md:col-span-2"><input type="checkbox" checked={component.is_required} onChange={(e) => setComponent({ ...component, is_required: e.target.checked })} />{ar ? 'مكوّن مطلوب وفق المصدر' : 'Required component per source'}</label>
            <div className="md:col-span-2"><button onClick={() => void addComponent()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" />{ar ? 'إضافة المكون للمسودة' : 'Add component to draft'}</button></div>
          </div>}
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[780px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-start">#</th><th className="p-3 text-start">{ar ? 'المكون' : 'Component'}</th><th className="p-3 text-start">{ar ? 'الكود' : 'Code'}</th><th className="p-3 text-start">{ar ? 'الكمية' : 'Quantity'}</th><th className="p-3 text-start">{ar ? 'الأبعاد (ط×ع×ا)' : 'Dimensions (L×W×H)'}</th><th className="p-3 text-start">{ar ? 'النطاق' : 'Scope'}</th></tr></thead><tbody className="divide-y divide-slate-100">{bomComponents.map((c) => <tr key={c.id}><td className="p-3">{c.sequence_no}</td><td className="p-3 font-bold text-slate-800">{c.component_name_ar}<div className="font-normal text-slate-400">{c.component_name_en || ''}</div></td><td className="p-3 font-mono">{c.component_code || '—'}</td><td className="p-3">{c.quantity} {c.unit_of_measure}</td><td className="p-3 font-mono">{[c.length_cm, c.width_cm, c.height_cm].map((v) => v ?? '—').join(' × ')}</td><td className="p-3">{c.face_scope || '—'}</td></tr>)}{!bomComponents.length && <tr><td colSpan={6} className="p-7 text-center text-slate-400">{ar ? 'لا توجد مكونات محفوظة لهذا الإصدار.' : 'No components are stored for this version.'}</td></tr>}</tbody></table></div>
        </section>
      </div>}

      {selectedModel && tab === 'routing' && <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className={`${panelClass} space-y-4`}>
          <div><h2 className="text-sm font-black text-slate-900">{ar ? 'إصدارات Routing' : 'Routing Versions'}</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">{ar ? 'يحفظ زمن التشغيل الإجمالي من المصدر منفصلًا عن أزمنة العمليات. لا يتم توزيع الزمن الإجمالي على الأقسام بالتخمين، ويمكن تكرار القسم في أكثر من خطوة.' : 'Source total time is stored separately from operation times. No aggregate time is guessed or split; an actual department can appear more than once in the route.'}</p></div>
          <div><label className={labelClass}>{ar ? 'اختيار الإصدار' : 'Select version'}</label><select className={inputClass} value={selectedRoutingId} onChange={async (e) => { setSelectedRoutingId(e.target.value); setRoutingSteps(e.target.value ? await manufacturingEngineeringApi.getRoutingSteps(e.target.value).catch((err) => { setError(err.message); return []; }) : []); }}><option value="">{ar ? 'لا يوجد إصدار محدد' : 'No version selected'}</option>{routingVersions.map((v) => <option key={v.id} value={v.id}>{v.version_code} · {v.status}</option>)}</select></div>
          {selectedRouting && <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600"><div><b>{ar ? 'نظام التصنيع:' : 'System:'}</b> {selectedRouting.manufacturing_system || '—'} · <b>{ar ? 'خط التشكيل:' : 'Forming line:'}</b> {selectedRouting.forming_line || '—'}</div><div><b>{ar ? 'زمن المصدر الإجمالي:' : 'Source total time:'}</b> {selectedRouting.source_total_minutes ?? '—'} {ar ? 'دقيقة' : 'min'} · <b>{ar ? 'كمية دورة المصدر:' : 'Source output quantity:'}</b> {selectedRouting.source_output_quantity ?? '—'}</div><div>{selectedRouting.source_time_scope || ''}</div><div>{selectedRouting.source_reference || ''}</div></div>}
          {canEdit && <div className="space-y-3 border-t border-slate-100 pt-4"><h3 className="text-xs font-black text-slate-800">{ar ? 'إنشاء إصدار Routing مسودة' : 'Create routing draft'}</h3><div><label className={labelClass}>{ar ? 'رمز الإصدار *' : 'Version code *'}</label><input className={inputClass} value={routingVersionCode} onChange={(e) => setRoutingVersionCode(e.target.value)} placeholder="ROUTING-2026-01" /></div><div><label className={labelClass}>{ar ? 'نظام التصنيع (وفق المصدر)' : 'Manufacturing system (source)'}</label><input className={inputClass} value={routingSystem} onChange={(e) => setRoutingSystem(e.target.value)} /></div><div><label className={labelClass}>{ar ? 'خط/ماكينة التشكيل' : 'Forming line / machine'}</label><input className={inputClass} value={formingLine} onChange={(e) => setFormingLine(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>{ar ? 'إجمالي وقت المصدر بالدقائق' : 'Source total minutes'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={sourceMinutes} onChange={(e) => setSourceMinutes(e.target.value)} /></div><div><label className={labelClass}>{ar ? 'كمية الإنتاج في دورة المصدر' : 'Source output quantity'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={sourceOutputQuantity} onChange={(e) => setSourceOutputQuantity(e.target.value)} /></div></div><div><label className={labelClass}>{ar ? 'نطاق زمن المصدر' : 'Source time scope'}</label><input className={inputClass} value={sourceTimeScope} onChange={(e) => setSourceTimeScope(e.target.value)} /></div><div><label className={labelClass}>{ar ? 'مرجع المصدر' : 'Source reference'}</label><input className={inputClass} value={routingSource} onChange={(e) => setRoutingSource(e.target.value)} /></div><div><label className={labelClass}>{ar ? 'ملاحظات' : 'Notes'}</label><textarea className={inputClass} rows={2} value={routingNotes} onChange={(e) => setRoutingNotes(e.target.value)} /></div><button onClick={() => void createRoutingDraft()} disabled={busy || !routingVersionCode.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" />{ar ? 'إنشاء مسودة Routing' : 'Create routing draft'}</button></div>}
        </section>
        <section className={`${panelClass} space-y-4`}>
          <div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-900">{ar ? 'ترتيب العمليات الفعلية' : 'Factory Operations'}</h2><p className="mt-1 text-[11px] text-slate-500">{ar ? `${routingSteps.length} عملية في الإصدار المحدد` : `${routingSteps.length} operations in selected version`}</p></div><Factory className="h-5 w-5 text-emerald-600" /></div>
          {selectedRouting?.status === 'draft' && canEdit && <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 md:grid-cols-2"><div><label className={labelClass}>{ar ? 'القسم الفعلي' : 'Actual department'}</label><select className={inputClass} value={step.department_code} onChange={(e) => setStep({ ...step, department_code: e.target.value })}>{departments.map((d) => <option key={d.value} value={d.value}>{ar ? d.ar : d.en}</option>)}</select></div><div><label className={labelClass}>{ar ? 'اسم العملية بالعربية *' : 'Operation name *'}</label><input className={inputClass} value={step.operation_name_ar} onChange={(e) => setStep({ ...step, operation_name_ar: e.target.value })} /></div><div><label className={labelClass}>{ar ? 'اسم العملية بالإنجليزية' : 'Operation name (English)'}</label><input className={inputClass} value={step.operation_name_en} onChange={(e) => setStep({ ...step, operation_name_en: e.target.value })} /></div><div><label className={labelClass}>{ar ? 'الماكينة/الخط' : 'Machine / line'}</label><input className={inputClass} value={step.machine_or_line} onChange={(e) => setStep({ ...step, machine_or_line: e.target.value })} /></div><div><label className={labelClass}>{ar ? 'الزمن المقدر للعملية (اختياري)' : 'Estimated step minutes (optional)'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={step.estimated_minutes} onChange={(e) => setStep({ ...step, estimated_minutes: e.target.value })} /></div><div><label className={labelClass}>{ar ? 'الزمن المقاس ميدانيًا (اختياري)' : 'Measured step minutes (optional)'}</label><input className={inputClass} type="number" min="0.001" step="0.001" value={step.measured_minutes} onChange={(e) => setStep({ ...step, measured_minutes: e.target.value })} /></div><div><label className={labelClass}>{ar ? 'مجموعة التكرار (إن وجدت)' : 'Repeat group (if applicable)'}</label><input className={inputClass} value={step.repeat_group} onChange={(e) => setStep({ ...step, repeat_group: e.target.value })} /></div><div><label className={labelClass}>{ar ? 'مرجع المصدر' : 'Source reference'}</label><input className={inputClass} value={step.source_reference} onChange={(e) => setStep({ ...step, source_reference: e.target.value })} /></div><div className="md:col-span-2"><label className={labelClass}>{ar ? 'ملاحظات' : 'Notes'}</label><textarea className={inputClass} rows={2} value={step.notes} onChange={(e) => setStep({ ...step, notes: e.target.value })} /></div><label className="flex items-center gap-2 text-xs font-bold text-slate-700 md:col-span-2"><input type="checkbox" checked={step.is_optional} onChange={(e) => setStep({ ...step, is_optional: e.target.checked })} />{ar ? 'عملية اختيارية وفق مسار الموديل' : 'Optional step for this model route'}</label><div className="md:col-span-2"><button onClick={() => void addRoutingStep()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" />{ar ? 'إضافة العملية التالية' : 'Add next operation'}</button></div></div>}
          <div className="space-y-2">{routingSteps.map((s) => { const d = departments.find((item) => item.value === s.department_code); return <div key={s.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-black text-emerald-700">{s.step_sequence}</div><div className="min-w-0 flex-1"><div className="text-xs font-black text-slate-800">{s.operation_name_ar} <span className="font-normal text-slate-400">· {ar ? d?.ar : d?.en}</span></div><div className="mt-1 text-[10px] text-slate-500">{s.machine_or_line || (ar ? 'ماكينة/خط غير محدد' : 'Machine/line not specified')} · {ar ? 'زمن مقدر' : 'Estimated'}: {s.estimated_minutes ?? '—'} · {ar ? 'زمن مقاس' : 'Measured'}: {s.measured_minutes ?? '—'} {s.repeat_group ? ` · ${ar ? 'تكرار' : 'Repeat'}: ${s.repeat_group}` : ''}</div></div></div>; })}{!routingSteps.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">{ar ? 'لا توجد عمليات مسجلة في هذا الإصدار.' : 'No operations have been recorded for this version.'}</p>}</div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">{ar ? 'لا يتم تقسيم الزمن الإجمالي على الأقسام آليًا. اترك أزمنة الخطوات فارغة حتى تتوفر قياسات موثقة.' : 'Aggregate time is never auto-split across departments. Leave step times blank until measured values are sourced.'}</p>
        </section>
      </div>}
    </div>
  );
}

function WorkflowIcon({ className }: { className?: string }) {
  return <ClipboardList className={className} />;
}
