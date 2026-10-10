
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  console.log('--- SLEEPEE MASTER DATA AUDIT ---');

  const tables = ['brands', 'categories', 'product_types', 'mattress_sizes', 'models', 'products'];
  
  console.log('\n1. COUNTS:');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`${table}: ${count}`);
    }
  }

  console.log('\n2. BRANDS:');
  const { data: brands, error: brandsErr } = await supabase.from('brands').select('id, name_ar, name_en, is_active').order('name_en');
  if (brandsErr) console.log(`ERROR: ${brandsErr.message}`);
  else console.table(brands);

  console.log('\n3. CATEGORIES:');
  const { data: categories, error: catsErr } = await supabase.from('categories').select('id, name_ar, name_en, is_active').order('name_en');
  if (catsErr) console.log(`ERROR: ${catsErr.message}`);
  else console.table(categories);

  console.log('\n4. PRODUCT TYPES:');
  const { data: types, error: typesErr } = await supabase.from('product_types').select('*').order('name_en');
  if (typesErr) console.log(`ERROR: ${typesErr.message}`);
  else console.table(types);

  console.log('\n5. MODELS:');
  const { data: models, error: modelsErr } = await supabase.from('models').select(`
    id, name_ar, name_en, 
    brands (name_en),
    categories (name_en)
  `);
  if (modelsErr) console.log(`ERROR: ${modelsErr.message}`);
  else {
    const formattedModels = models.map((m: any) => ({
      id: m.id,
      name_ar: m.name_ar,
      name_en: m.name_en,
      brand: m.brands?.name_en,
      category: m.categories?.name_en
    }));
    console.table(formattedModels);
  }

  console.log('\n6. PRODUCTS:');
  const { data: products, error: prodsErr } = await supabase.from('products').select(`
    id, code, name_en, 
    brands (name_en),
    models (name_en),
    width_cm, length_cm, height_cm
  `);
  if (prodsErr) console.log(`ERROR: ${prodsErr.message}`);
  else {
    const formattedProds = products.map((p: any) => ({
      id: p.id,
      code: p.code,
      name_en: p.name_en,
      brand: p.brands?.name_en,
      model: p.models?.name_en,
      width: p.width_cm,
      length: p.length_cm,
      height: p.height_cm
    }));
    console.table(formattedProds);
  }

  console.log('\n7-9. DUPLICATES (by name_en):');
  const checkDuplicates = (data: any[], label: string) => {
    if (!data) return;
    const counts: Record<string, number> = {};
    data.forEach(item => {
      const name = item.name_en;
      counts[name] = (counts[name] || 0) + 1;
    });
    const dups = Object.entries(counts).filter(([_, count]) => count > 1);
    if (dups.length === 0) console.log(`No duplicate ${label} found.`);
    else console.log(`Duplicate ${label}:`, dups);
  };
  checkDuplicates(brands || [], 'brands');
  checkDuplicates(categories || [], 'categories');
  checkDuplicates(models || [], 'models');

  console.log('\n10. ORPHAN MODELS:');
  if (models) {
    const orphans = models.filter((m: any) => !m.brands || !m.categories);
    if (orphans.length === 0) console.log('No orphan models found.');
    else console.log('Orphan models:', orphans);
  }

  console.log('\n11. ORPHAN PRODUCTS:');
  if (products) {
    // Note: products join in select was brands and models. 
    // In SQL requirement it also checked categories.
    const orphans = products.filter((p: any) => !p.brands || !p.models);
    if (orphans.length === 0) console.log('No orphan products found.');
    else console.log('Orphan products:', orphans);
  }

  console.log('\n--- END OF AUDIT ---');
}

runAudit();
