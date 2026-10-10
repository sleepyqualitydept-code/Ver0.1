# بيان الإصدار المرشح — Sleepee Rebuilt Candidate v1.1

- الحالة: نسخة مرشحة للمراجعة المعمارية والاختبار، غير معتمدة للإنتاج.
- خط الأساس: `SLEEPEE_PLATFORM_PHASE_10_18_UNIFIED_v1.0(4).zip`.
- طبقة التحسينات: `SLEEPEE_PLATFORM_INTEGRATION_CANDIDATE_v1.0.zip`.
- مرجعية العمل: `Sleepee_Single_Source_Of_Truth_v1.0`، لم تُعدّل.
- وثيقة البناء: `docs/reference/Sleepee_Architecture_Development_Blueprint_v1.0_DRAFT_AR.md` ونسخة Word المقابلة.

## التغييرات المضمنة

- إعادة تركيب خط أساس 10–18 وطبقة التكامل مع توثيق الفروقات.
- إضافة مخطط معماري عربي جديد وخطة بناء وبوابات قبول لتوجيه Google AI Studio.
- الاحتفاظ بإضافات هندسة التصنيع وBOM/Routing ومعالج الإنتاج ومقاسات الملصقات والتحسينات الموثقة في طبقة التكامل.
- إزالة مبدل الدور التجريبي من الواجهة وحذف دالته من AuthContext.
- ترك الترحيلات الجديدة في مكان المراجعة المقترح وعدم تفعيلها تلقائيًا.

## الحالة الفنية

- بناء Vite وTypeScript/Lint: غير متحققين في تثبيت نظيف.
- Supabase schema/Auth/RLS/RPC/Storage/Realtime: غير متحقق.
- Phase 09 live regression: غير منفذ في هذه الجولة.
- Zebra ZD220 physical test: غير منفذ.
- GitHub/Google AI Studio/Supabase target الجديد: لم يُربط بعد.

هذه الحزمة تسليم مصدر للمراجعة والخطوة التالية، وليست ادعاء اكتمال أو نشر.
