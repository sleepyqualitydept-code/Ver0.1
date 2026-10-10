/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export type TemplateStatus = 'draft' | 'published' | 'inactive';

export type DynamicFieldSource = 
  | 'brand' 
  | 'model' 
  | 'size' 
  | 'warranty' 
  | 'serial' 
  | 'batch' 
  | 'production_date';

export interface LabelElement {
  id: string;
  type: 'logo' | 'text' | 'brand' | 'model' | 'size' | 'warranty' | 'serial' | 'batch' | 'date' | 'qr' | 'barcode' | 'shape' | 'line' | 'rectangle' | 'image';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  visible: boolean;
  staticValue?: string;
  mapping?: DynamicFieldSource;
  rotation?: number;
}

export interface TemplateSnapshot {
  name: string;
  category_id: string;
  label_width: number;
  label_height: number;
  description?: string;
  elements: LabelElement[];
  version: string;
  published_at?: string;
}

export interface TemplateVersionHistoryItem {
  version: string;
  published_at: string;
  published_by?: string;
  status: TemplateStatus;
  template_snapshot: TemplateSnapshot | LabelElement[];
  notes?: string;
}

export interface LabelTemplate {
  id: string;
  name: string;
  category_id: string;
  label_width: number; // 100 mm
  label_height: number; // 50 or 100 mm
  template_json: {
    status: TemplateStatus;
    version: string;
    elements: LabelElement[];
    version_history?: TemplateVersionHistoryItem[];
    created_by?: string;
    description?: string;
  };
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Computed / joined
  categories?: any;
}

// Official brand logo asset path in project
export const OFFICIAL_SLEEPEE_LOGO_PATH = '/src/assets/images/sleepee_brand_logo_1791210733150.jpg';

// Default standard element layout for NEW templates in editor ONLY
// NEVER used as print fallback, published fallback, preview fallback, or database fallback.
export const getDefaultElements = (size: '100x50' | '100x100'): LabelElement[] => {
  const is100x100 = size === '100x100';

  return [
    {
      id: 'el-logo',
      type: 'logo',
      name: 'Official Company Logo',
      x: 5,
      y: 5,
      width: 45,
      height: 18,
      visible: true,
      staticValue: OFFICIAL_SLEEPEE_LOGO_PATH
    },
    {
      id: 'el-brand',
      type: 'brand',
      name: 'Brand Name',
      x: 55,
      y: 5,
      width: 40,
      height: 16,
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'right',
      visible: true,
      mapping: 'brand'
    },
    {
      id: 'el-line-1',
      type: 'line',
      name: 'Header Divider',
      x: 5,
      y: 23,
      width: 90,
      height: 2,
      visible: true
    },
    {
      id: 'el-model',
      type: 'model',
      name: 'Product Model',
      x: 5,
      y: 26,
      width: 90,
      height: 14,
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'left',
      visible: true,
      mapping: 'model'
    },
    {
      id: 'el-size',
      type: 'size',
      name: 'Dimensions / Size',
      x: 5,
      y: 42,
      width: 45,
      height: 12,
      fontSize: 11,
      textAlign: 'left',
      visible: true,
      mapping: 'size'
    },
    {
      id: 'el-warranty',
      type: 'warranty',
      name: 'Warranty Coverage',
      x: 55,
      y: 42,
      width: 40,
      height: 12,
      fontSize: 11,
      textAlign: 'right',
      visible: true,
      mapping: 'warranty'
    },
    {
      id: 'el-serial',
      type: 'serial',
      name: 'Serial Number Text',
      x: 5,
      y: is100x100 ? 58 : 55,
      width: 60,
      height: 12,
      fontSize: 11,
      fontWeight: 'bold',
      textAlign: 'left',
      visible: true,
      mapping: 'serial'
    },
    {
      id: 'el-batch',
      type: 'batch',
      name: 'Batch Number',
      x: 5,
      y: is100x100 ? 72 : 68,
      width: 45,
      height: 10,
      fontSize: 10,
      textAlign: 'left',
      visible: true,
      mapping: 'batch'
    },
    {
      id: 'el-date',
      type: 'date',
      name: 'Production Date',
      x: 55,
      y: is100x100 ? 72 : 68,
      width: 40,
      height: 10,
      fontSize: 10,
      textAlign: 'right',
      visible: true,
      mapping: 'production_date'
    },
    {
      id: 'el-barcode',
      type: 'barcode',
      name: 'Linear Barcode (Code128)',
      x: 5,
      y: is100x100 ? 84 : 78,
      width: 60,
      height: is100x100 ? 14 : 18,
      visible: true,
      mapping: 'serial'
    },
    {
      id: 'el-qr',
      type: 'qr',
      name: 'Warranty QR Code',
      x: 70,
      y: is100x100 ? 56 : 52,
      width: is100x100 ? 25 : 22,
      height: is100x100 ? 25 : 22,
      visible: true,
      mapping: 'serial'
    }
  ];
};

export const labelTemplatesApi = {
  async getAll(): Promise<LabelTemplate[]> {
    const { data, error } = await getClient()
      .from('label_templates')
      .select(`
        *,
        categories (id, name_ar, name_en)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((t: any) => ({
      ...t,
      template_json: typeof t.template_json === 'string' ? JSON.parse(t.template_json) : (t.template_json || { status: 'draft', version: '1.0', elements: [] })
    }));
  },

  async getById(id: string): Promise<LabelTemplate | null> {
    const { data, error } = await getClient()
      .from('label_templates')
      .select(`
        *,
        categories (id, name_ar, name_en)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      template_json: typeof data.template_json === 'string' ? JSON.parse(data.template_json) : (data.template_json || { status: 'draft', version: '1.0', elements: [] })
    };
  },

  async create(params: {
    name: string;
    categoryId: string;
    labelWidth: 100;
    labelHeight: 50 | 100;
    elements?: LabelElement[];
    createdBy?: string;
    description?: string;
  }): Promise<LabelTemplate> {
    const { name, categoryId, labelWidth, labelHeight, elements, createdBy, description } = params;

    if (!name || name.trim() === '') {
      throw new Error('TEMPLATE_VALIDATION_ERROR: Template name is required.');
    }
    if (!categoryId || categoryId.trim() === '') {
      throw new Error('TEMPLATE_VALIDATION_ERROR: Product category is required.');
    }
    if (labelWidth !== 100 || (labelHeight !== 50 && labelHeight !== 100)) {
      throw new Error('TEMPLATE_VALIDATION_ERROR: Supported label sizes are 100x50 mm and 100x100 mm.');
    }

    const templateElements = elements && elements.length > 0 ? elements : getDefaultElements(labelHeight === 50 ? '100x50' : '100x100');

    const templateJson = {
      status: 'draft' as TemplateStatus,
      version: '1.0',
      elements: templateElements,
      version_history: [],
      created_by: createdBy,
      description: description || ''
    };

    const { data, error } = await getClient()
      .from('label_templates')
      .insert([{
        name: name.trim(),
        category_id: categoryId,
        label_width: labelWidth,
        label_height: labelHeight,
        template_json: templateJson,
        is_active: false // Newly created templates start as Draft/Inactive
      }])
      .select(`
        *,
        categories (id, name_ar, name_en)
      `);

    if (error || !data?.[0]) {
      throw new Error(error?.message || 'Failed to create label template in PostgreSQL database.');
    }

    return {
      ...data[0],
      template_json: templateJson
    };
  },

  async update(id: string, params: {
    name?: string;
    categoryId?: string;
    labelWidth?: number;
    labelHeight?: number;
    elements?: LabelElement[];
    description?: string;
  }): Promise<LabelTemplate> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('TEMPLATE_NOT_FOUND: Template does not exist.');

    const updatedElements = params.elements || existing.template_json.elements;
    const updatedJson = {
      ...existing.template_json,
      elements: updatedElements,
      description: params.description !== undefined ? params.description : existing.template_json.description
    };

    const updatePayload: any = {
      template_json: updatedJson,
      updated_at: new Date().toISOString()
    };

    if (params.name) updatePayload.name = params.name.trim();
    if (params.categoryId) updatePayload.category_id = params.categoryId;
    if (params.labelWidth) updatePayload.label_width = params.labelWidth;
    if (params.labelHeight) updatePayload.label_height = params.labelHeight;

    const { data, error } = await getClient()
      .from('label_templates')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        categories (id, name_ar, name_en)
      `);

    if (error || !data?.[0]) throw new Error(error?.message || 'Failed to update template in database.');

    return {
      ...data[0],
      template_json: updatedJson
    };
  },

  async duplicate(id: string, createdBy?: string): Promise<LabelTemplate> {
    const original = await this.getById(id);
    if (!original) throw new Error('TEMPLATE_NOT_FOUND: Template to duplicate does not exist.');

    const duplicatedName = `${original.name} (Copy)`;
    return this.create({
      name: duplicatedName,
      categoryId: original.category_id,
      labelWidth: original.label_width as 100,
      labelHeight: original.label_height as 50 | 100,
      elements: original.template_json.elements,
      createdBy,
      description: `Duplicated from ${original.name} (v${original.template_json.version})`
    });
  },

  /**
   * Validates template rules:
   * 1. Name required
   * 2. Category required
   * 3. Label Size required (100x50 or 100x100)
   * 4. At least one Dynamic element required
   * 5. At least one Serial representation required
   * 6. QR OR Barcode required
   */
  validateTemplate(template: LabelTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim() === '') {
      errors.push('Template Name is required.');
    }
    if (!template.category_id) {
      errors.push('Category assignment is required.');
    }
    if (template.label_width !== 100 || (template.label_height !== 50 && template.label_height !== 100)) {
      errors.push('Supported label sizes are 100x50 mm and 100x100 mm.');
    }

    const elements = template.template_json?.elements || [];
    if (elements.length === 0) {
      errors.push('Template canvas is empty. Add elements before publishing.');
    }

    // At least one dynamic element
    const hasDynamic = elements.some((el: LabelElement) => 
      ['brand', 'model', 'size', 'warranty', 'serial', 'batch', 'date', 'qr', 'barcode'].includes(el.type) || !!el.mapping
    );
    if (!hasDynamic) {
      errors.push('At least ONE dynamic database-bound element is required.');
    }

    // At least one Serial representation
    const hasSerialRepr = elements.some((el: LabelElement) => 
      el.type === 'serial' || el.mapping === 'serial' || el.type === 'barcode' || el.type === 'qr'
    );
    if (!hasSerialRepr) {
      errors.push('At least ONE Serial representation is required (Serial Text, Barcode, or QR).');
    }

    // QR OR Barcode required
    const hasBarcodeOrQr = elements.some((el: LabelElement) => el.type === 'barcode' || el.type === 'qr');
    if (!hasBarcodeOrQr) {
      errors.push('QR code OR Barcode element is required for physical scanning.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  async publish(id: string, publishedBy?: string, notes?: string): Promise<LabelTemplate> {
    const template = await this.getById(id);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND: Template does not exist.');

    // 1. Validation check
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`PUBLISH_VALIDATION_FAILED: ${validation.errors.join(' ')}`);
    }

    const client = getClient();

    // 2. Publish Rule: Only ONE active published template per Category + Label Size
    // Deactivate previous active templates for same category & size
    await client
      .from('label_templates')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('category_id', template.category_id)
      .eq('label_width', template.label_width)
      .eq('label_height', template.label_height)
      .neq('id', id);

    // 3. Increment Version & Append COMPLETE Snapshot to Version History
    const currentVersion = template.template_json.version || '1.0';
    const [major, minor] = currentVersion.split('.').map(Number);
    const newVersion = `${major || 1}.${(minor || 0) + 1}`;

    // COMPLETE TEMPLATE SNAPSHOT (FIX 03)
    const completeSnapshot: TemplateSnapshot = {
      name: template.name,
      category_id: template.category_id,
      label_width: template.label_width,
      label_height: template.label_height,
      description: template.template_json.description || '',
      elements: JSON.parse(JSON.stringify(template.template_json.elements)),
      version: currentVersion,
      published_at: new Date().toISOString()
    };

    const historyItem: TemplateVersionHistoryItem = {
      version: currentVersion,
      published_at: new Date().toISOString(),
      published_by: publishedBy || 'Administrator',
      status: 'published',
      template_snapshot: completeSnapshot,
      notes: notes || `Published version ${newVersion}`
    };

    const existingHistory = template.template_json.version_history || [];
    const updatedHistory = [historyItem, ...existingHistory];

    const updatedJson = {
      ...template.template_json,
      status: 'published' as TemplateStatus,
      version: newVersion,
      version_history: updatedHistory
    };

    // 4. Update and activate in PostgreSQL
    const { data, error } = await client
      .from('label_templates')
      .update({
        template_json: updatedJson,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        categories (id, name_ar, name_en)
      `);

    if (error || !data?.[0]) throw new Error(error?.message || 'Failed to publish template in database.');

    return {
      ...data[0],
      template_json: updatedJson
    };
  },

  async deactivate(id: string): Promise<void> {
    const template = await this.getById(id);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND: Template does not exist.');

    const updatedJson = {
      ...template.template_json,
      status: 'inactive' as TemplateStatus
    };

    const { error } = await getClient()
      .from('label_templates')
      .update({
        template_json: updatedJson,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  // RESTORE COMPLETE HISTORICAL SNAPSHOT & CREATE NEW VERSION (FIX 04)
  async restore(id: string, targetVersion: string, restoredBy?: string): Promise<LabelTemplate> {
    const template = await this.getById(id);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND: Template does not exist.');

    const history = template.template_json.version_history || [];
    const targetItem = history.find((h: TemplateVersionHistoryItem) => h.version === targetVersion);

    if (!targetItem || !targetItem.template_snapshot) {
      throw new Error(`VERSION_NOT_FOUND: Historical version ${targetVersion} not found in template history.`);
    }

    const rawSnapshot: any = targetItem.template_snapshot;
    // Extract snapshot preserving all fields: name, category_id, label_width, label_height, description, elements
    const restoredName = rawSnapshot.name || template.name;
    const restoredCategoryId = rawSnapshot.category_id || template.category_id;
    const restoredWidth = rawSnapshot.label_width || template.label_width;
    const restoredHeight = rawSnapshot.label_height || template.label_height;
    const restoredDescription = rawSnapshot.description !== undefined ? rawSnapshot.description : template.template_json.description;
    const restoredElements: LabelElement[] = Array.isArray(rawSnapshot) ? rawSnapshot : (rawSnapshot.elements || []);

    // 1. Create a NEW active version without destroying historical records
    const [major, minor] = (template.template_json.version || '1.0').split('.').map(Number);
    const newRestoredVersion = `${major || 1}.${(minor || 0) + 1}`;

    // 2. Archive current snapshot prior to restoration
    const currentArchivalSnapshot: TemplateSnapshot = {
      name: template.name,
      category_id: template.category_id,
      label_width: template.label_width,
      label_height: template.label_height,
      description: template.template_json.description || '',
      elements: JSON.parse(JSON.stringify(template.template_json.elements)),
      version: template.template_json.version || '1.0',
      published_at: new Date().toISOString()
    };

    const newHistoryItem: TemplateVersionHistoryItem = {
      version: template.template_json.version || '1.0',
      published_at: new Date().toISOString(),
      published_by: restoredBy || 'Administrator',
      status: 'published',
      template_snapshot: currentArchivalSnapshot,
      notes: `Snapshot prior to restoring version ${targetVersion}`
    };

    const updatedJson = {
      ...template.template_json,
      status: 'published' as TemplateStatus,
      version: newRestoredVersion,
      elements: restoredElements,
      description: restoredDescription,
      version_history: [newHistoryItem, ...history]
    };

    // 3. Deactivate previous active templates for same category & size
    await getClient()
      .from('label_templates')
      .update({ is_active: false })
      .eq('category_id', restoredCategoryId)
      .eq('label_width', restoredWidth)
      .eq('label_height', restoredHeight)
      .neq('id', id);

    // 4. Update database record with restored complete snapshot
    const { data, error } = await getClient()
      .from('label_templates')
      .update({
        name: restoredName,
        category_id: restoredCategoryId,
        label_width: restoredWidth,
        label_height: restoredHeight,
        template_json: updatedJson,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        categories (id, name_ar, name_en)
      `);

    if (error || !data?.[0]) throw new Error(error?.message || 'Failed to restore template in database.');

    return {
      ...data[0],
      template_json: updatedJson
    };
  },

  async resolveTemplate(categoryId?: string, width = 100, height = 100): Promise<LabelTemplate> {
    return this.resolveActiveTemplate(categoryId, width, height);
  },

  // EXACT CATEGORY + SIZE MATCH ONLY (FIX 01 - REMOVE CROSS-CATEGORY FALLBACK)
  async resolveActiveTemplate(categoryId?: string, width = 100, height = 100): Promise<LabelTemplate> {
    if (width !== 100 || (height !== 50 && height !== 100)) {
      throw new Error(`UNSUPPORTED_LABEL_SIZE: Supported label sizes are 100x50 mm and 100x100 mm.`);
    }

    if (!categoryId || categoryId.trim() === '') {
      throw new Error('TEMPLATE_NOT_FOUND: Product category is required to resolve active label template.');
    }

    const client = getClient();

    // Query strictly for active published template matching Category ID + Width + Height
    const { data, error } = await client
      .from('label_templates')
      .select(`
        *,
        categories (id, name_ar, name_en)
      `)
      .eq('category_id', categoryId)
      .eq('label_width', width)
      .eq('label_height', height)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`DATABASE_QUERY_ERROR: ${error.message}`);
    }

    if (data) {
      const parsedJson = typeof data.template_json === 'string' ? JSON.parse(data.template_json) : data.template_json;
      if (parsedJson?.status === 'published') {
        return {
          ...data,
          template_json: parsedJson
        };
      }
    }

    // EXACT MATCH FAILED: Strictly throw TEMPLATE_NOT_FOUND. Never cross-category fallback!
    throw new Error(`TEMPLATE_NOT_FOUND: No active published label template found in database for category '${categoryId}' and size ${width}x${height}mm.`);
  }
};
