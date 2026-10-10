-- ==================================================
-- UNIQUE CONSTRAINT MIGRATION
-- Company: Sleepee Platform
-- ==================================================

-- Brands
ALTER TABLE brands ADD CONSTRAINT unique_brand_name_en UNIQUE (name_en);

-- Categories
ALTER TABLE categories ADD CONSTRAINT unique_category_name_en UNIQUE (name_en);

-- Product Types
ALTER TABLE product_types ADD CONSTRAINT unique_product_type_code UNIQUE (code);

-- Mattress Sizes
ALTER TABLE mattress_sizes ADD CONSTRAINT unique_mattress_size UNIQUE (width_cm, length_cm);

-- Models (Multi-column constraint)
ALTER TABLE models ADD CONSTRAINT unique_model_brand_cat_name UNIQUE (brand_id, category_id, name_en);
