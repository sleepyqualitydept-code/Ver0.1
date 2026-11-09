# GitHub وGoogle AI Studio — طريقة التسليم

1. احتفظ بنسخة احتياطية خارج المستودع الحالي.
2. فك `SLEEPEE_PLATFORM_FINAL_HANDOFF_v1.6.0-rc.2.zip` في مجلد منفصل، ثم استبدل ملفات العمل بالمجلد بعد التأكد من بقاء `.git` فقط في مستودع GitHub Desktop وعدم نسخ أي ملف `.env`.
3. شغّل بوابات `npm ci`, `npm run verify:release`, `npm run typecheck`, `npm run build` محليًا أو عبر GitHub Actions.
4. بعد مراجعة فرق الملفات، أنشئ commit وpush واحدًا إلى `main`.
5. في Google AI Studio استورد المصدر يدويًا. راجع كل تعديل في diff قبل إرجاعه إلى GitHub. لا توجد مزامنة تلقائية.

لا تنفذ SQL عند مجرد رفع الكود. مراجعة Supabase مشروع منفصل يتطلب فحص المخطط الحي، backup وموافقة صريحة.
