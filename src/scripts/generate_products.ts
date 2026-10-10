import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function generateProducts() {
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: brands } = await supabase.from('brands').select('*');
  const { data: models, error: mErr } = await supabase.from('models').select('*');
  const { data: sizes } = await supabase.from('mattress_sizes').select('*');
  
  if (mErr) console.error('Error fetching models:', mErr);
  else console.log('Models found:', models?.length);

  if (!categories || !brands || !models || !sizes) {
    console.error('Failed to fetch complete master data. One or more tables returned null.');
    return;
  }

  console.log(`Found: ${categories.length} categories, ${brands.length} brands, ${models.length} models, ${sizes.length} sizes.`);

  const productsToInsert = [];

  for (const model of models) {
    const brand = brands.find(b => b.id === model.brand_id);
    const category = categories.find(c => c.id === model.category_id);
    
    if (!brand || !category) continue;

    for (const size of sizes) {
      productsToInsert.push({
        code: `PROD-${brand.name_en.substring(0,3).toUpperCase()}-${model.name_en.substring(0,3).toUpperCase()}-${size.width_cm}x${size.length_cm}`,
        name_ar: `${model.name_ar} - ${size.width_cm}x${size.length_cm}`,
        name_en: `${model.name_en} - ${size.width_cm}x${size.length_cm}`,
        category_id: category.id,
        brand_id: brand.id,
        model_id: model.id,
        width_cm: size.width_cm,
        length_cm: size.length_cm,
        height_cm: 25, // Default height
        is_active: true
      });
    }
  }

  console.log(`Inserting ${productsToInsert.length} products...`);
  
  const { error } = await supabase.from('products').upsert(productsToInsert, { onConflict: 'code' });
  
  if (error) {
    console.error('Error inserting products:', error.message);
  } else {
    console.log('Products seeded successfully.');
  }
}

generateProducts();
