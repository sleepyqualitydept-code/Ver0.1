-- ==================================================
-- MASTER DATA SEED FINAL (PENDING MODEL CATALOG)
-- Company: Arabian Spring & Foam Mattresses Mfg. Company LTD (Sleepee)
-- ==================================================

-- 1. Seed Categories
insert into categories (name_ar, name_en, is_active) values
('مراتب', 'Mattresses', true),
('مخدات', 'Pillows', true),
('خداديات', 'Cushions', true),
('أسرة', 'Beds', true),
('كفرات حماية', 'Protective Covers', true),
('إكسسوارات', 'Accessories', true)
on conflict (name_en) do update set 
  name_ar = excluded.name_ar,
  is_active = excluded.is_active;

-- 2. Seed Brands
insert into brands (name_ar, name_en, is_active) values
('سليبي', 'Sleepee', true),
('كمفورت', 'Comfort', true),
('إس إتش', 'SH', true),
('ريتش هاوس', 'Rich House', true),
('الإماراتية', 'Emareties', true),
('متخصص', 'Specialist', true)
on conflict (name_en) do update set 
  name_ar = excluded.name_ar,
  is_active = excluded.is_active;

-- 3. Seed Product Types
insert into product_types (code, name_ar, name_en) values
('MAT-STD', 'مرتبة قياسية', 'Standard Product'),
('MAT-CUST', 'مرتبة تفصيل خاص', 'Custom Product'),
('MAT-PROJ', 'مرتبة عقود ومشاريع', 'Project Product')
on conflict (code) do update set 
  name_ar = excluded.name_ar,
  name_en = excluded.name_en;

-- 4. Seed Mattress Sizes
insert into mattress_sizes (width_cm, length_cm, is_active) values
(90, 190, true),
(100, 200, true),
(120, 200, true),
(140, 200, true),
(150, 200, true),
(160, 200, true),
(180, 200, true),
(200, 200, true)
on conflict (width_cm, length_cm) do update set 
  is_active = excluded.is_active;

-- 5. Models (PENDING OFFICIAL CATALOG VERIFICATION)
-- NO MODELS SEEDED. CATALOG PENDING.
