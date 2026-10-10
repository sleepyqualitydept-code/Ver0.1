import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized. Configure the existing project credentials first.');
  return supabase;
};

function explainMigrationError(error: any): never {
  const message = String(error?.message || error || 'Unknown database error');
  if (/relation .* does not exist|could not find the table|schema cache/i.test(message)) {
    throw new Error('MANUFACTURING_ENGINEERING_NOT_DEPLOYED: هندسة المنتج وBOM وRouting تحتاج إلى مراجعة وتطبيق ترحيل الإضافة بعد فحص قاعدة Supabase الحالية وموافقة المالك. لم يتم إنشاء أي بيانات محلية بديلة.');
  }
  throw error instanceof Error ? error : new Error(message);
}

export const manufacturingEngineeringApi = {
  async getModelSpec(modelId: string) {
    const { data, error } = await getClient().from('model_engineering_specs').select('*').eq('model_id', modelId).maybeSingle();
    if (error) explainMigrationError(error);
    return data;
  },

  async saveModelSpec(payload: {
    model_id: string;
    construction_type: string | null;
    manufacturing_system: string | null;
    face_configuration: string | null;
    spring_wire_diameter_mm: number | null;
    notes: string | null;
    source_reference: string | null;
  }) {
    const { data, error } = await getClient().from('model_engineering_specs').upsert(payload, { onConflict: 'model_id' }).select('*').single();
    if (error) explainMigrationError(error);
    return data;
  },

  async getBomVersions(modelId: string) {
    const { data, error } = await getClient().from('product_bom_versions').select('*').eq('model_id', modelId).order('created_at', { ascending: false });
    if (error) explainMigrationError(error);
    return data || [];
  },

  async getBomComponents(versionId: string) {
    const { data, error } = await getClient().from('product_bom_components').select('*').eq('bom_version_id', versionId).order('sequence_no', { ascending: true });
    if (error) explainMigrationError(error);
    return data || [];
  },

  async createBomDraft(payload: { model_id: string; version_code: string; source_reference?: string | null; notes?: string | null }) {
    const { data, error } = await getClient().from('product_bom_versions').insert({
      model_id: payload.model_id,
      version_code: payload.version_code.trim(),
      status: 'draft',
      source_reference: payload.source_reference || null,
      notes: payload.notes || null
    }).select('*').single();
    if (error) explainMigrationError(error);
    return data;
  },

  async addBomComponent(payload: {
    bom_version_id: string; sequence_no: number; component_type: string | null; component_code: string | null;
    component_name_ar: string; component_name_en: string | null; quantity: number; unit_of_measure: string;
    length_cm: number | null; width_cm: number | null; height_cm: number | null; face_scope: string | null;
    attachment_method: string | null; is_required: boolean; source_reference: string | null; source_description: string | null; notes: string | null;
  }) {
    const { data, error } = await getClient().from('product_bom_components').insert(payload).select('*').single();
    if (error) explainMigrationError(error);
    return data;
  },

  async getRoutingVersions(modelId: string) {
    const { data, error } = await getClient().from('manufacturing_routing_versions').select('*').eq('model_id', modelId).order('created_at', { ascending: false });
    if (error) explainMigrationError(error);
    return data || [];
  },

  async getRoutingSteps(versionId: string) {
    const { data, error } = await getClient().from('manufacturing_routing_steps').select('*').eq('routing_version_id', versionId).order('step_sequence', { ascending: true });
    if (error) explainMigrationError(error);
    return data || [];
  },

  async createRoutingDraft(payload: {
    model_id: string; version_code: string; manufacturing_system: string | null; forming_line: string | null;
    source_total_minutes: number | null; source_output_quantity: number | null; source_time_scope: string | null;
    source_reference: string | null; notes: string | null;
  }) {
    const { data, error } = await getClient().from('manufacturing_routing_versions').insert({ ...payload, version_code: payload.version_code.trim(), status: 'draft' }).select('*').single();
    if (error) explainMigrationError(error);
    return data;
  },

  async addRoutingStep(payload: {
    routing_version_id: string; step_sequence: number; department_code: string; operation_name_ar: string;
    operation_name_en: string | null; machine_or_line: string | null; estimated_minutes: number | null;
    measured_minutes: number | null; repeat_group: string | null; is_optional: boolean; source_reference: string | null; notes: string | null;
  }) {
    const { data, error } = await getClient().from('manufacturing_routing_steps').insert(payload).select('*').single();
    if (error) explainMigrationError(error);
    return data;
  }
};
