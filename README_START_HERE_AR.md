# Sleepee — حزمة التسليم الموحدة v1.6.0-rc.2

**الحالة:** تسليم مصدر موحد بعد التنظيف وإصلاحات التكامل؛ غير معتمد للإنتاج حتى اجتياز بوابات البناء والنشر والاختبار الواقعي.

## ابدأ من هنا

1. `docs/README_AR.md` — خريطة ملفات المشروع وترتيب المرجعية.
2. `docs/reference/Sleepee_Single_Source_Of_Truth_v1.0_Portable_Reference.md` — المرجعية التجارية الحاكمة، محفوظة دون تعديل.
3. `docs/architecture/ARCHITECTURE_AR.md` والرسومان `SLEEPEE_SYSTEM_CONTEXT.svg` و`SLEEPEE_OPERATING_FLOW.svg` — تصميم النظام ومسار العمل.
4. `docs/phases/PHASE_DELIVERY_MATRIX_AR.md` — حالة المراحل وبوابات القبول الحقيقية.
5. `docs/quality/VERIFICATION_RESULTS_AR.md` — نتائج الفحوص المنفذة وحدود ما لم يمكن اختباره.

## التشغيل المحلي

```bash
cp .env.example .env.local
# ضع VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY في .env.local فقط
npm ci
npm run verify:release
npm run test:labels
npm run typecheck
npm run build
npm run dev
```

إذا تعذر `npm ci` بسبب شبكة npm، لا تستبدل lockfile عشوائيًا؛ شغّل التثبيت والبناء في بيئة متصلة أو GitHub Actions. يتضمن المستودع Workflow باسم **Sleepee Quality Gate**.

## نقاط أمان لا تتغير بالرفع

- لا Firebase. `models` كيان الموديل/المنتج canonical؛ لا تنشئ جدول `products` ثانيًا.
- لا توجد بيانات تشغيل أو BOM افتراضية؛ لا تدرج ملفات الخامات/التكلفة الداخلية الخام في المستودع.
- مدد الضمان الجديدة تُدار وفق سياسة الفئة/العلامة/الموديل؛ لقطة مدة ونهاية ضمان التفعيل القائم غير قابلة للتعديل.
- لا تكتب مباشرة إلى `warranty_activations` أو `serial_numbers` أو `serial_history` أو `print_history`.
- `supabase/proposed-migrations/` مراجعة فقط؛ لم تُنفذ ولا تغير Supabase الحي تلقائيًا.
- الطباعة الفيزيائية غير معتمدة بعد؛ `executePrint` يفشل بأمان ولا يسجل طباعة ناجحة وهمية.
- Google AI Studio ربط يدوي، وليس مزامنة تلقائية. راجع `docs/integration/GOOGLE_AI_STUDIO_AND_GITHUB_HANDOFF_AR.md`.
- تعارضات BOM/أزمنة التشغيل والمقاس وقواعد بعض حالات الاستبدال تبقى معلقة حتى تحقق/قرار معتمد؛ لم تُحل بالتخمين.

**الإجراء المهم قبل التشغيل:** راجع بوابات المرحلة في ملف المراحل؛ افحص مخطط Supabase الحي وخذ نسخة احتياطية قبل أي نشر؛ اختبر كل دور على مشروع تجريبي؛ ونفّذ إعداد أول Administrator يدويًا وفق `supabase/operations/BOOTSTRAP_FIRST_ADMIN_AR.md` بعد الموافقة فقط.
