import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runCleanup() {
  console.log('--- STARTING DEMO DATA CLEANUP ---');
  const demoModels = ['Marriott', 'Queen', 'Silver', 'Golden', 'Platinum'];

  // Remove products linked to demo models
  const { data: models, error: fetchErr } = await supabase.from('models').select('id').in('name_en', demoModels);
  
  if (fetchErr) {
    console.error('Error fetching demo models:', fetchErr.message);
    return;
  }

  if (models && models.length > 0) {
    const modelIds = models.map(m => m.id);
    const { error: delProductErr } = await supabase.from('products').delete().in('model_id', modelIds);
    if (delProductErr) console.error('Error deleting demo products:', delProductErr.message);
    else console.log('Deleted demo products.');
  }

  // Remove demo models
  const { error: delModelErr } = await supabase.from('models').delete().in('name_en', demoModels);
  if (delModelErr) console.error('Error deleting demo models:', delModelErr.message);
  else console.log('Deleted demo models.');

  console.log('--- CLEANUP COMPLETE ---');
}

runCleanup();
