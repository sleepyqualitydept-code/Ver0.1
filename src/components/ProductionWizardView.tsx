import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Factory, Layers, Printer, ScanBarcode, ShieldCheck } from 'lucide-react';
import { Language } from '../utils/translations.ts';

interface Props {
  orders: any[]; batches: any[]; serials: any[]; brands: any[]; models: any[]; categories: any[];
  productSizes: string[]; productTypes: any[]; currentRole: string; lang: Language;
  onAddOrder: (lines: any[]) => Promise<any>;
  onUpdateOrderStatus: (id: string, status: any) => Promise<any>;
  onGenerateSerials: (batchId: string) => Promise<any>;
  onCreateBatch: (orderId: string) => Promise<any>;
}

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-100';
const label = 'mb-1.5 block text-[11px] font-bold text-slate-600';
function parseSize(size: string): { width: number; length: number } | null {
  const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  return { width: Number(match[1]), length: Number(match[2]) };
}

export default function ProductionWizardView(props: Props) {
  const { orders, batches, serials, brands, models, categories, productSizes, productTypes, currentRole, lang, onAddOrder, onUpdateOrderStatus, onGenerateSerials, onCreateBatch } = props;
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const canApprove = ['Administrator', 'Production Manager'].includes(currentRole);
  const [step, setStep] = useState(1);
  const [modelId, setModelId] = useState('');
  const [size, setSize] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [models, modelId]);
  const selectedOrder = orders.find((order) => order.id === orderId);
  const selectedBatch = batches.find((batch) => batch.id === batchId);
  const sizeParts = parseSize(size);
  const matchingBatches = batches.filter((batch) => batch.production_order_id === orderId);
  const activeBatch = selectedBatch || matchingBatches[0];
  const isSetupReady = Boolean(selectedModel && selectedModel.brand_id && selectedModel.category_id && sizeParts && Number(heightCm) > 0 && Number.isInteger(Number(quantity)) && Number(quantity) > 0 && productTypeId);
  const steps = [
    { number: 1, title: ar ? 'تعريف الإنتاج' : 'Production definition', icon: ClipboardList },
    { number: 2, title: ar ? 'مراجعة واعتماد الأمر' : 'Order review & approval', icon: ShieldCheck },
    { number: 3, title: ar ? 'الدفعة والأرقام' : 'Batch & serials', icon: ScanBarcode },
    { number: 4, title: ar ? 'التسليم للطباعة' : 'Printing handoff', icon: Printer }
  ];

  const execute = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (e: any) { setError(e.message || (ar ? 'تعذر تنفيذ الخطوة.' : 'The step could not be completed.')); }
    finally { setBusy(false); }
  };

  const createOrder = () => execute(async () => {
    if (!isSetupReady || !selectedModel || !sizeParts) throw new Error(ar ? 'أكمل المنتج والمقاس والارتفاع والكمية ونوع المنتج من البيانات المحملة من قاعدة البيانات.' : 'Choose a database-backed model, size, height, quantity, and product type.');
    const order = await onAddOrder([{
      product_type_id: productTypeId,
      category_id: selectedModel.category_id,
      brand_id: selectedModel.brand_id,
      model_id: selectedModel.id,
      width_cm: sizeParts.width,
      length_cm: sizeParts.length,
      height_cm: Number(heightCm),
      quantity: Number(quantity),
      notes: notes.trim()
    }]);
    if (!order?.id) throw new Error(ar ? 'تم إرسال الطلب لكن لم يُرجع النظام معرّف أمر الإنتاج. راجع السجل قبل إعادة المحاولة.' : 'The order was submitted without returning an order ID. Check the database before retrying.');
    setOrderId(order.id);
    setStep(2);
    setMessage(ar ? `تم إنشاء أمر الإنتاج ${order.order_number || order.id}. انتقل إلى الإرسال للمراجعة.` : `Production order ${order.order_number || order.id} created. Continue to review.`);
  });

  const submitOrder = () => execute(async () => {
    if (!orderId) throw new Error(ar ? 'لا يوجد أمر إنتاج محدد.' : 'No production order is selected.');
    await onUpdateOrderStatus(orderId, 'planned');
    setMessage(ar ? 'أُرسل أمر الإنتاج للمراجعة. الاعتماد التالي متاح لصلاحية المدير.' : 'The order was submitted for review. Approval requires manager permission.');
  });

  const approveOrder = () => execute(async () => {
    if (!canApprove) throw new Error(ar ? 'اعتماد أمر الإنتاج يتطلب Administrator أو Production Manager في التطبيق الحالي.' : 'Approving orders requires Administrator or Production Manager in the current application rules.');
    await onUpdateOrderStatus(orderId, 'approved');
    setMessage(ar ? 'تم إرسال طلب الاعتماد إلى قاعدة البيانات. يمكن إنشاء الدفعة بعد التحقق من حالة الأمر.' : 'Approval status was submitted to the database. Batch creation follows the confirmed order state.');
  });

  const createBatch = () => execute(async () => {
    const order = orders.find((item) => item.id === orderId) || selectedOrder;
    if (!order || order.status !== 'approved') throw new Error(ar ? 'لا يمكن إنشاء دفعة قبل أن تصبح حالة أمر الإنتاج Approved.' : 'A batch can only be created after the order is Approved.');
    const batch = await onCreateBatch(orderId);
    if (!batch?.id) throw new Error(ar ? 'لم يُرجع النظام معرّف الدفعة؛ لا تعاود الإنشاء قبل مراجعة قاعدة البيانات.' : 'No batch ID was returned. Check the database before retrying.');
    await onUpdateOrderStatus(orderId, 'in_production');
    setBatchId(batch.id);
    setStep(3);
    setMessage(ar ? `تم إنشاء الدفعة ${batch.batch_number || batch.id}.` : `Batch ${batch.batch_number || batch.id} created.`);
  });

  const generateSerials = () => execute(async () => {
    const batch = activeBatch;
    if (!batch?.id) throw new Error(ar ? 'أنشئ دفعة إنتاج أولًا.' : 'Create a batch first.');
    await onGenerateSerials(batch.id);
    setBatchId(batch.id);
    setStep(4);
    setMessage(ar ? 'اكتمل طلب توليد الأرقام التسلسلية. الخطوة التالية هي مركز الطباعة؛ لم يتم تسجيل أي ملصق كمطبوع من هذا المعالج.' : 'Serial generation completed. Continue to the printing center; this wizard does not mark any label as printed.');
  });

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Factory className="h-7 w-7" /></div><div><h1 className="text-xl font-black text-slate-900">{ar ? 'معالج الإنتاج السريع' : 'Quick Production Wizard'}</h1><p className="mt-1 text-xs leading-6 text-slate-600">{ar ? 'مسار إرشادي فوق واجهات الإنتاج الحالية. ينتقل بين الخطوات بعد نجاح العملية وقابلية التحقق من الحالة؛ لا يتجاوز الاعتماد أو الطباعة الفعلية.' : 'A guided flow over existing production APIs. Progress follows successful operations and state checks; it never bypasses approval or physical print confirmation.'}</p></div></div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{steps.map((item) => { const Icon = item.icon; const current = step === item.number; const done = step > item.number; return <div key={item.number} className={`flex items-center gap-3 rounded-xl border p-3 ${current ? 'border-emerald-500 bg-emerald-600 text-white' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${current ? 'bg-white/15' : 'bg-slate-100'}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div><div><div className="text-[10px] font-bold opacity-80">{ar ? `الخطوة ${item.number}` : `STEP ${item.number}`}</div><div className="text-xs font-black">{item.title}</div></div></div>; })}</div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{message}</div>}

      {step === 1 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-black text-slate-900">{ar ? 'ماذا ننتج وكم الكمية؟' : 'What are we producing, and how many?'}</h2>{(!models.length || !categories.length || !brands.length || !productTypes.length || !productSizes.length) && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{ar ? 'لا يمكن إكمال المعالج بقوائم افتراضية. تأكد من تحميل الموديلات والفئات والعلامات وأنواع المنتجات والمقاسات من Supabase.' : 'This wizard does not fall back to hard-coded data. Load models, categories, brands, product types, and sizes from Supabase first.'}</div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div><label className={label}>{ar ? 'الموديل *' : 'Model *'}</label><select className={field} value={modelId} onChange={(e) => setModelId(e.target.value)}><option value="">{ar ? 'اختر موديلًا' : 'Select model'}</option>{models.map((m) => <option key={m.id} value={m.id}>{m.name_ar || m.name_en || m.name}</option>)}</select></div>
        <div><label className={label}>{ar ? 'المقاس *' : 'Size *'}</label><select className={field} value={size} onChange={(e) => setSize(e.target.value)}><option value="">{ar ? 'اختر مقاسًا معتمدًا' : 'Select database size'}</option>{productSizes.map((s) => <option key={s} value={s}>{s}</option>)}</select>{size && !sizeParts && <p className="mt-1 text-[10px] text-rose-600">{ar ? 'صيغة المقاس الحالية لا يمكن تفسيرها آليًا؛ راجع قيمة المصدر.' : 'This size format cannot be parsed; review the source value.'}</p>}</div>
        <div><label className={label}>{ar ? 'ارتفاع المرتبة (سم) *' : 'Mattress height (cm) *'}</label><input className={field} type="number" min="1" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder={ar ? 'أدخل ارتفاع هذا المنتج من المصدر' : 'Enter the source-confirmed height'} /></div>
        <div><label className={label}>{ar ? 'نوع المنتج *' : 'Product type *'}</label><select className={field} value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}><option value="">{ar ? 'اختر نوع المنتج' : 'Select product type'}</option>{productTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name_ar || pt.name_en || pt.code}</option>)}</select></div>
        <div><label className={label}>{ar ? 'الكمية *' : 'Quantity *'}</label><input className={field} type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        <div><label className={label}>{ar ? 'ملاحظات' : 'Notes'}</label><input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div><div className="mt-5 flex flex-wrap gap-2"><button disabled={busy || !isSetupReady} onClick={() => void createOrder()} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busy ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'إنشاء مسودة أمر إنتاج' : 'Create production order draft')}</button><button onClick={() => navigate('/production/planning')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600">{ar ? 'فتح لوحة التخطيط' : 'Open planning board'}</button></div></section>}

      {step === 2 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="text-sm font-black text-slate-900">{ar ? 'مراجعة أمر الإنتاج قبل الدفعة' : 'Review production order before batching'}</h2><div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700"><div><b>{ar ? 'رقم الأمر:' : 'Order:'}</b> {selectedOrder?.order_number || orderId || '—'}</div><div><b>{ar ? 'الحالة الحالية:' : 'Current state:'}</b> {selectedOrder?.status || '—'}</div><div><b>{ar ? 'العلامة / الموديل:' : 'Brand / model:'}</b> {brands.find((b) => b.id === (selectedModel?.brand_id || selectedModel?.brandId))?.name_ar || ''} / {selectedModel?.name_ar || selectedModel?.name_en || '—'}</div><div><b>{ar ? 'المقاس والكمية:' : 'Size / quantity:'}</b> {size} / {quantity}</div></div>{!selectedOrder && <p className="text-xs text-amber-800">{ar ? 'قد يتأخر تحديث قائمة الأوامر بعد الحفظ؛ اضغط تحديث الصفحة أو افتح أوامر الإنتاج للتحقق قبل المتابعة.' : 'The order list may not refresh immediately. Refresh or open production orders to confirm the status before continuing.'}</p>}<div className="flex flex-wrap gap-2">{selectedOrder?.status === 'draft' && <button onClick={() => void submitOrder()} disabled={busy} className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{ar ? 'إرسال للمراجعة' : 'Submit for review'}</button>}{selectedOrder?.status === 'planned' && canApprove && <button onClick={() => void approveOrder()} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{ar ? 'اعتماد أمر الإنتاج' : 'Approve order'}</button>}{selectedOrder?.status === 'approved' && <button onClick={() => void createBatch()} disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{ar ? 'إنشاء الدفعة والانتقال للتسلسل' : 'Create batch & continue'}</button>}<button onClick={() => navigate('/production/orders')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600">{ar ? 'فتح مركز الأوامر' : 'Open order center'}</button></div>{selectedOrder?.status === 'planned' && !canApprove && <p className="text-xs text-amber-700">{ar ? 'بانتظار مستخدم مخول بالاعتماد. لا يمكن تخطي هذه الخطوة.' : 'Awaiting an authorized approver. This step cannot be bypassed.'}</p>}</section>}

      {step === 3 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><h2 className="text-sm font-black text-slate-900">{ar ? 'توليد الأرقام التسلسلية' : 'Generate serial numbers'}</h2><div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700"><div><b>{ar ? 'أمر الإنتاج:' : 'Order:'}</b> {selectedOrder?.order_number || orderId}</div><div><b>{ar ? 'الدفعة:' : 'Batch:'}</b> {activeBatch?.batch_number || batchId}</div><div><b>{ar ? 'حالة الدفعة:' : 'Batch status:'}</b> {activeBatch?.status || '—'}</div><div><b>{ar ? 'عدد السيريالات المرتبطة:' : 'Related serials loaded:'}</b> {serials.filter((s) => s.batch_id === (activeBatch?.id || batchId)).length}</div></div><button onClick={() => void generateSerials()} disabled={busy || !activeBatch?.id || ['serialized','printed','completed'].includes(activeBatch?.status)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? (ar ? 'جارٍ التوليد...' : 'Generating...') : (ar ? 'توليد الأرقام التسلسلية' : 'Generate serials')}</button><p className="text-[11px] leading-5 text-slate-500">{ar ? 'لا تعِد المحاولة إذا انقطع الاتصال بعد إرسال الطلب قبل مراجعة الدفعة والأرقام في قاعدة البيانات.' : 'If the connection is interrupted after submitting, inspect the batch and serials in the database before retrying.'}</p></section>}

      {step === 4 && <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm space-y-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" /><div><h2 className="text-sm font-black text-slate-900">{ar ? 'الدفعة جاهزة للتسليم إلى مركز الطباعة' : 'Batch handed off to the printing center'}</h2><p className="mt-1 text-xs leading-6 text-slate-600">{ar ? 'تم طلب توليد الأرقام. افتح مركز الطباعة لإنشاء/مراجعة Print Job واختبار الاتصال الفعلي. لن يُسجل هذا المعالج حالة Printed.' : 'Serial generation was requested. Open Printing Center to create/review a print job and verify hardware. This wizard will not mark anything Printed.'}</p></div></div><div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700"><div><b>{ar ? 'أمر الإنتاج:' : 'Order:'}</b> {selectedOrder?.order_number || orderId}</div><div><b>{ar ? 'الدفعة:' : 'Batch:'}</b> {activeBatch?.batch_number || batchId}</div><div><b>{ar ? 'حالة الدفعة الحالية:' : 'Current batch state:'}</b> {activeBatch?.status || '—'}</div></div><div className="flex flex-wrap gap-2"><button onClick={() => navigate('/printing/queue')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white"><Printer className="h-4 w-4" />{ar ? 'فتح مركز الطباعة' : 'Open printing center'}</button><button onClick={() => navigate('/serialization/search')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600"><ScanBarcode className="h-4 w-4" />{ar ? 'فحص الأرقام' : 'Review serials'}</button><button onClick={() => { setStep(1); setOrderId(''); setBatchId(''); setModelId(''); setSize(''); setHeightCm(''); setQuantity(''); setNotes(''); setProductTypeId(''); setError(''); setMessage(''); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600">{ar ? 'بدء أمر جديد' : 'Start another order'}</button></div></section>}

      <div className="flex justify-between"><button onClick={() => navigate('/production/planning')} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800">{ar ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}{ar ? 'العودة إلى الإنتاج' : 'Back to production'}</button>{step > 1 && step < 4 && <button onClick={() => setStep(step - 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">{ar ? 'عرض الخطوة السابقة' : 'Review previous step'}</button>}</div>
    </div>
  );
}
