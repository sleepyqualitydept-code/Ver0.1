-- ==================================================
-- DEMO DATA CLEANUP MIGRATION
-- Company: Sleepee Platform
-- ==================================================

-- Remove demo products generated from demo models
DELETE FROM products 
WHERE model_id IN (
    SELECT id 
    FROM models 
    WHERE name_en IN ('Marriott', 'Queen', 'Silver', 'Golden', 'Platinum')
);

-- Remove demo models
DELETE FROM models 
WHERE name_en IN ('Marriott', 'Queen', 'Silver', 'Golden', 'Platinum');
