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
  label_width: number; // positive whole number in millimeters; custom sizes supported
  label_height: number; // positive whole number in millimeters; custom sizes supported
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

// Default element layout for NEW templates in the editor only.
// All coordinates and dimensions are millimeters relative to the saved canvas.
// The layout scales with the requested width/height and keeps every element inside it.
export const getDefaultElements = (size: string | { width: number; height: number }): LabelElement[] => {
  let width: number;
  let height: number;

  if (typeof size === 'string') {
    const match = size.toLowerCase().replace(/\s/g, '').match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
    if (!match) throw new Error('TEMPLATE_VALIDATION_ERROR: Size must be provided as WIDTHxHEIGHT in millimeters.');
    width = Number(match[1]);
    height = Number(match[2]);
  } else {
    width = size.width;
    height = size.height;
  }

  assertValidLabelDimensions(width, height);

  const marginX = Math.min(4, width * 0.04);
  const marginY = Math.min(2, height * 0.04);
  const innerW = width - (2 * marginX);
  const innerH = height - (2 * marginY);
  const gapY = innerH * 0.008;
  const row = {
    header: innerH * 0.15,
    divider: innerH * 0.018,
    model: innerH * 0.13,
    size: innerH * 0.12,
    serial: innerH * 0.12,
    batch: innerH * 0.10,
    bottom: innerH * 0.24
  };
  const fontBase = Math.max(4, Math.min(14, Math.min(width, height) * 0.20));
  let y = marginY;
  const headerY = y; y += row.header + gapY;
  const dividerY = y; y += row.divider + gapY;
  const modelY = y; y += row.model + gapY;
  const sizeY = y; y += row.size + gapY;
  const serialY = y; y += row.serial + gapY;
  const batchY = y; y += row.batch + gapY;
  const bottomY = y;

  const halfGap = innerW * 0.03;
  const halfW = (innerW - halfGap) / 2;
  const qrSize = Math.max(Math.min(innerW * 0.22, row.bottom * 0.92), Math.min(innerW, row.bottom) * 0.05);
  const barcodeWidth = Math.max(innerW - qrSize - halfGap, innerW * 0.35);
  const fitFont = (factor: number, max = fontBase) => Math.max(3, Math.min(max, fontBase * factor));

  return [
    {
      id: 'el-logo', type: 'logo', name: 'Official Company Logo',
      x: marginX, y: headerY, width: innerW * 0.42, height: row.header * 0.9,
      visible: true, staticValue: OFFICIAL_SLEEPEE_LOGO_PATH
    },
    {
      id: 'el-brand', type: 'brand', name: 'Brand Name',
      x: marginX + innerW * 0.45, y: headerY, width: innerW * 0.55, height: row.header * 0.9,
      fontSize: fitFont(1.05), fontWeight: 'bold', textAlign: 'right', visible: true, mapping: 'brand'
    },
    {
      id: 'el-line-1', type: 'line', name: 'Header Divider',
      x: marginX, y: dividerY, width: innerW, height: Math.max(0.01, row.divider * 0.6), visible: true
    },
    {
      id: 'el-model', type: 'model', name: 'Product Model',
      x: marginX, y: modelY, width: innerW, height: row.model * 0.92,
      fontSize: fitFont(1), fontWeight: 'bold', textAlign: 'left', visible: true, mapping: 'model'
    },
    {
      id: 'el-size', type: 'size', name: 'Dimensions / Size',
      x: marginX, y: sizeY, width: halfW, height: row.size * 0.92,
      fontSize: fitFont(0.82), textAlign: 'left', visible: true, mapping: 'size'
    },
    {
      id: 'el-warranty', type: 'warranty', name: 'Warranty Coverage',
      x: marginX + halfW + halfGap, y: sizeY, width: halfW, height: row.size * 0.92,
      fontSize: fitFont(0.82), textAlign: 'right', visible: true, mapping: 'warranty'
    },
    {
      id: 'el-serial', type: 'serial', name: 'Serial Number Text',
      x: marginX, y: serialY, width: innerW, height: row.serial * 0.92,
      fontSize: fitFont(0.9), fontWeight: 'bold', textAlign: 'left', visible: true, mapping: 'serial'
    },
    {
      id: 'el-batch', type: 'batch', name: 'Batch Number',
      x: marginX, y: batchY, width: halfW, height: row.batch * 0.92,
      fontSize: fitFont(0.72), textAlign: 'left', visible: true, mapping: 'batch'
    },
    {
      id: 'el-date', type: 'date', name: 'Production Date',
      x: marginX + halfW + halfGap, y: batchY, width: halfW, height: row.batch * 0.92,
      fontSize: fitFont(0.72), textAlign: 'right', visible: true, mapping: 'production_date'
    },
    {
      id: 'el-barcode', type: 'barcode', name: 'Linear Barcode (Code128)',
      x: marginX, y: bottomY, width: Math.min(barcodeWidth, innerW), height: row.bottom * 0.9,
      visible: true, mapping: 'serial'
    },
    {
      id: 'el-qr', type: 'qr', name: 'Warranty QR Code',
      x: marginX + innerW - qrSize, y: bottomY, width: qrSize, height: Math.min(qrSize, row.bottom * 0.9),
      visible: true, mapping: 'serial'
    }
  ];
};

export function assertValidLabelDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('TEMPLATE_VALIDATION_ERROR: Label width and height must be positive whole numbers in millimeters.');
  }
}

export function getLabelElementGeometryErrors(elements: LabelElement[], width: number, height: number): string[] {
  const errors: string[] = [];
  if (!Array.isArray(elements)) return ['Template elements must be an array.'];

  elements.forEach((element, index) => {
    const label = element?.name || element?.id || `Element ${index + 1}`;
    const numericFields: Array<keyof Pick<LabelElement, 'x' | 'y' | 'width' | 'height'>> = ['x', 'y', 'width', 'height'];
    if (!element || numericFields.some((key) => !Number.isFinite(element[key]))) {
      errors.push(`${label}: position and dimensions must be finite numbers.`);
      return;
    }
    if (element.x < 0 || element.y < 0) errors.push(`${label}: X and Y cannot be negative.`);
    if (element.width <= 0 || element.height <= 0) errors.push(`${label}: element width and height must be greater than zero.`);
    if (element.x + element.width > width + 0.0001) errors.push(`${label}: element extends beyond the ${width} mm canvas width.`);
    if (element.y + element.height > height + 0.0001) errors.push(`${label}: element extends beyond the ${height} mm canvas height.`);
  });
  return errors;
}

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
    labelWidth: number;
    labelHeight: number;
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
    assertValidLabelDimensions(labelWidth, labelHeight);

    const templateElements = elements && elements.length > 0
      ? elements
      : getDefaultElements({ width: labelWidth, height: labelHeight });
    const geometryErrors = getLabelElementGeometryErrors(templateElements, labelWidth, labelHeight);
    if (geometryErrors.length > 0) {
      throw new Error(`TEMPLATE_VALIDATION_ERROR: ${geometryErrors.join(' ')}`);
    }

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

    if (params.name !== undefined && !params.name.trim()) {
      throw new Error('TEMPLATE_VALIDATION_ERROR: Template name cannot be empty.');
    }
    const nextWidth = params.labelWidth !== undefined ? params.labelWidth : existing.label_width;
    const nextHeight = params.labelHeight !== undefined ? params.labelHeight : existing.label_height;
    assertValidLabelDimensions(nextWidth, nextHeight);
    const updatedElements = params.elements !== undefined ? params.elements : (existing.template_json.elements || []);
    const geometryErrors = getLabelElementGeometryErrors(updatedElements, nextWidth, nextHeight);
    if (geometryErrors.length > 0) {
      throw new Error(`TEMPLATE_VALIDATION_ERROR: ${geometryErrors.join(' ')}`);
    }
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
    if (params.labelWidth !== undefined) updatePayload.label_width = params.labelWidth;
    if (params.labelHeight !== undefined) updatePayload.label_height = params.labelHeight;

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
      labelWidth: original.label_width,
      labelHeight: original.label_height,
      elements: original.template_json.elements,
      createdBy,
      description: `Duplicated from ${original.name} (v${original.template_json.version})`
    });
  },

  /**
   * Validates template rules:
   * 1. Name required
   * 2. Category required
   * 3. Label dimensions must be positive whole numbers and all elements must fit within the canvas
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
    try {
      assertValidLabelDimensions(template.label_width, template.label_height);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Label dimensions must be positive whole numbers.');
    }

    const elements = template.template_json?.elements || [];
    errors.push(...getLabelElementGeometryErrors(elements, template.label_width, template.label_height));
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
    assertValidLabelDimensions(restoredWidth, restoredHeight);
    const restoreGeometryErrors = getLabelElementGeometryErrors(restoredElements, restoredWidth, restoredHeight);
    if (restoreGeometryErrors.length > 0) {
      throw new Error(`TEMPLATE_RESTORE_VALIDATION_FAILED: ${restoreGeometryErrors.join(' ')}`);
    }

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

  async resolveTemplate(categoryId: string, width: number, height: number): Promise<LabelTemplate> {
    return this.resolveActiveTemplate(categoryId, width, height);
  },

  // Resolve only an exact, explicitly supplied category and size.
  async resolveActiveTemplate(categoryId: string, width: number, height: number): Promise<LabelTemplate> {
    assertValidLabelDimensions(width, height);

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
        const resolved: LabelTemplate = { ...data, template_json: parsedJson };
        const validation = this.validateTemplate(resolved);
        if (!validation.valid) {
          throw new Error(`TEMPLATE_VALIDATION_FAILED: ${validation.errors.join(' ')}`);
        }
        return resolved;
      }
    }

    // EXACT MATCH FAILED: Strictly throw TEMPLATE_NOT_FOUND. Never cross-category fallback!
    throw new Error(`TEMPLATE_NOT_FOUND: No active published label template found in database for category '${categoryId}' and size ${width}x${height}mm.`);
  }
};
