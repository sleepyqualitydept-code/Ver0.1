# تشغيل المشروع والتسليم

## تشغيل محلي
1. استخدم Node.js `>=22.12` (Vite 8 requirement).
2. انسخ `.env.example` إلى `.env.local`، ثم ضع `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` من مشروع تطوير فقط.
3. نفّذ:
   ```bash
   npm ci
   npm run verify:release
   npm run typecheck
   npm run build
   npm run dev
   ```
4. لا تستخدم ملفات `supabase/proposed-migrations` كجزء من build أو start؛ هي منفصلة يدويًا.

## GitHub
المستودع الحالي يحتفظ بـ`.git` عند الاستبدال عبر GitHub Desktop. احتفظ بنسخة احتياطية خارج المستودع، ولا ترفع `.env.local` أو مفاتيح service-role. راجع الفرق ثم ارفع commit واحدًا مُسمى بوضوح.

## Google AI Studio
الربط يدوي: افتح مساحة المشروع المعتمدة ثم استورد المصدر/الملف من المستودع أو ارفع الأرشيف بحسب خيارات الواجهة المتاحة. لا يوجد webhook أو مزامنة تلقائية في هذا الكود. بعد التعديلات في Studio، راجع diff ثم commit إلى GitHub؛ لا تستخدم Studio كمرجع أعمال بديلًا عن SSoT.

## Supabase
- لا يوجد مشروع جديد أو تعديل حي ضمن هذه الحزمة.
- ملفات `001`, `002`, `003` في `supabase/proposed-migrations/` فقط.
- نفّذ الفحص الحي للـschema أولًا، خذ backup، قارن كل كائن، اراجع RLS/RPC، ثم اطلب موافقة مالك النظام قبل SQL.
- لا تعِد إدخال SQL التاريخي المستبعد. ملفات `supabase/verification/` استعلامات قراءة فقط بعد نشر معتمد.
