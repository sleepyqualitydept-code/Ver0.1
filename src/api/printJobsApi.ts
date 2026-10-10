/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';
import { labelTemplatesApi, LabelTemplate } from './labelTemplatesApi.ts';
import { serialNumbersApi } from './serialNumbersApi.ts';
import { batchesApi } from './batchesApi.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export type PrintJobStatus = 'pending' | 'processing' | 'printed' | 'failed' | 'cancelled' | 'paused';

export interface PrintJobMetadata {
  job_number: string;
  batch_id: string;
  printer: string;
  status: PrintJobStatus;
  total_labels: number;
  printed_labels: number;
  failed_labels: number;
  error_message?: string;
  is_reprint?: boolean;
  reprint_reason?: string;
}

export interface PrintJob {
  id: string;
  job_number: string;
  batch_id: string;
  template_id: string;
  printer_name: string;
  copies: number;
  status: PrintJobStatus;
  total_labels: number;
  printed_labels: number;
  failed_labels: number;
  error_message?: string;
  is_reprint?: boolean;
  reprint_reason?: string;
  created_by?: string | null;
  created_at: string;
  // Joined relations
  label_templates?: LabelTemplate | null;
  production_batches?: any;
}

// Helpers to serialize and deserialize PostgreSQL metadata
function encodePrinterPayload(meta: PrintJobMetadata): string {
  return JSON.stringify(meta);
}

function parsePrinterPayload(raw: string, fallbackId: string): PrintJobMetadata {
  try {
    if (raw && (raw.startsWith('{') || raw.startsWith('['))) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          job_number: parsed.job_number || `JOB-${new Date().getFullYear()}-${fallbackId.slice(0, 8).toUpperCase()}`,
          batch_id: parsed.batch_id || '',
          printer: parsed.printer || 'Zebra ZD220 Direct Thermal',
          status: parsed.status || 'pending',
          total_labels: Number(parsed.total_labels) || 0,
          printed_labels: Number(parsed.printed_labels) || 0,
          failed_labels: Number(parsed.failed_labels) || 0,
          error_message: parsed.error_message || undefined,
          is_reprint: !!parsed.is_reprint,
          reprint_reason: parsed.reprint_reason || undefined
        };
      }
    }
  } catch (err) {
    // raw string is simple printer name
  }

  return {
    job_number: `JOB-${new Date().getFullYear()}-${fallbackId.slice(0, 8).toUpperCase()}`,
    batch_id: '',
    printer: raw || 'Zebra ZD220 Direct Thermal',
    status: 'pending',
    total_labels: 0,
    printed_labels: 0,
    failed_labels: 0
  };
}

export const printJobsApi = {
  async getAll(): Promise<PrintJob[]> {
    const { data, error } = await getClient()
      .from('print_jobs')
      .select(`
        *,
        label_templates (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    // Map database records and enrich with batch details
    const jobs: PrintJob[] = [];
    for (const row of data) {
      const meta = parsePrinterPayload(row.printer_name, row.id);
      
      let batchData: any = null;
      if (meta.batch_id) {
        try {
          batchData = await batchesApi.getById(meta.batch_id);
        } catch {
          // ignore batch lookup failure
        }
      }

      jobs.push({
        id: row.id,
        job_number: meta.job_number,
        batch_id: meta.batch_id,
        template_id: row.template_id,
        printer_name: meta.printer,
        copies: row.copies || 1,
        status: meta.status,
        total_labels: meta.total_labels,
        printed_labels: meta.printed_labels,
        failed_labels: meta.failed_labels,
        error_message: meta.error_message,
        is_reprint: meta.is_reprint,
        reprint_reason: meta.reprint_reason,
        created_by: row.created_by,
        created_at: row.created_at,
        label_templates: row.label_templates,
        production_batches: batchData
      });
    }

    return jobs;
  },

  async getById(id: string): Promise<PrintJob | null> {
    const { data, error } = await getClient()
      .from('print_jobs')
      .select(`
        *,
        label_templates (*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const meta = parsePrinterPayload(data.printer_name, data.id);
    let batchData: any = null;
    if (meta.batch_id) {
      try {
        batchData = await batchesApi.getById(meta.batch_id);
      } catch {
        // ignore
      }
    }

    return {
      id: data.id,
      job_number: meta.job_number,
      batch_id: meta.batch_id,
      template_id: data.template_id,
      printer_name: meta.printer,
      copies: data.copies || 1,
      status: meta.status,
      total_labels: meta.total_labels,
      printed_labels: meta.printed_labels,
      failed_labels: meta.failed_labels,
      error_message: meta.error_message,
      is_reprint: meta.is_reprint,
      reprint_reason: meta.reprint_reason,
      created_by: data.created_by,
      created_at: data.created_at,
      label_templates: data.label_templates,
      production_batches: batchData
    };
  },

  async createJob(params: {
    batchId: string;
    templateId?: string;
    printerName?: string;
    copies?: number;
    userId?: string;
    isReprint?: boolean;
    reprintReason?: string;
  }): Promise<PrintJob> {
    const { 
      batchId, 
      templateId, 
      printerName = 'Zebra ZD220 Direct Thermal', 
      copies = 1, 
      userId,
      isReprint = false,
      reprintReason
    } = params;

    if (!batchId || batchId.trim() === '') {
      throw new Error('PRINT_VALIDATION_ERROR: A valid production batch ID is required.');
    }

    // 1. Verify batch exists and status is serialized or printed
    const batch = await batchesApi.getById(batchId);
    if (!batch) {
      throw new Error('PRINT_VALIDATION_ERROR: Production batch not found in database.');
    }

    if (batch.status !== 'serialized' && batch.status !== 'printed') {
      throw new Error(`PRINT_VALIDATION_ERROR: Batch ${batch.batch_number || batchId} status is '${batch.status}'. Only SERIALIZED or PRINTED batches are eligible for printing.`);
    }

    // 2. Fetch serials for batch and reject if zero serials exist
    const serials = await serialNumbersApi.search({ batchId });
    if (!serials || serials.length === 0) {
      throw new Error(`PRINT_VALIDATION_ERROR: Cannot create print job for batch ${batch.batch_number || batchId}. No serial numbers exist for this batch.`);
    }

    // 3. Resolve template
    let template: LabelTemplate | null = null;
    if (templateId && templateId.trim() !== '') {
      const { data: tData } = await getClient()
        .from('label_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();
      if (tData) {
        const parsed = typeof tData.template_json === 'string' ? JSON.parse(tData.template_json) : tData.template_json;
        if (tData.is_active && parsed?.status === 'published') {
          template = { ...tData, template_json: parsed };
        } else {
          throw new Error('PRINT_VALIDATION_ERROR: The selected label template is not active and published.');
        }
      } else {
        throw new Error('PRINT_VALIDATION_ERROR: Selected label template not found in database.');
      }
    }

    if (!template) {
      // Canonical Resolution: Batch → Production Order → Production Order Line (matching model) → Model → Category
      let resolvedCategoryId: string | null = null;

      // Identify model from batch serials if present
      const batchModelId = serials.length > 0 ? ((serials[0] as any).model_id || serials[0].modelId) : null;

      const prodOrder = Array.isArray((batch as any).production_orders)
        ? (batch as any).production_orders[0]
        : (batch as any).production_orders;

      const lines: any[] = Array.isArray(prodOrder?.production_order_lines) 
        ? prodOrder.production_order_lines 
        : (prodOrder?.production_order_lines ? [prodOrder.production_order_lines] : []);

      // Find matching line for model or first line
      const matchedLine = batchModelId ? lines.find((l: any) => l.model_id === batchModelId) : (lines.length > 0 ? lines[0] : null);

      if (matchedLine?.category_id) {
        resolvedCategoryId = matchedLine.category_id;
      } else if (matchedLine?.models?.category_id) {
        resolvedCategoryId = matchedLine.models.category_id;
      } else if (matchedLine?.models?.categories?.id) {
        resolvedCategoryId = matchedLine.models.categories.id;
      }

      // If not resolved from joined relation, query direct line on production_order_id
      if (!resolvedCategoryId && batch.production_order_id) {
        let lineQuery = getClient()
          .from('production_order_lines')
          .select('id, category_id, model_id, models (id, category_id)')
          .eq('production_order_id', batch.production_order_id);

        if (batchModelId) {
          lineQuery = lineQuery.eq('model_id', batchModelId);
        }

        const { data: directLine } = await lineQuery.limit(1).maybeSingle();

        if (directLine) {
          resolvedCategoryId = directLine.category_id || (directLine.models as any)?.category_id || null;
        }
      }

      // If still not resolved, query category directly from the model
      if (!resolvedCategoryId && batchModelId) {
        const { data: modelData } = await getClient()
          .from('models')
          .select('id, category_id')
          .eq('id', batchModelId)
          .maybeSingle();
        if (modelData?.category_id) {
          resolvedCategoryId = modelData.category_id;
        }
      }

      if (!resolvedCategoryId || resolvedCategoryId.trim() === '') {
        throw new Error(`PRINT_VALIDATION_ERROR: Product category could not be resolved for batch ${batch.batch_number || batchId}. Production order lines must have a valid category or model.`);
      }

      template = await labelTemplatesApi.resolveTemplate(resolvedCategoryId, 100, 100);
    }

    if (!template) {
      throw new Error('PRINT_VALIDATION_ERROR: No active published label template found for printing.');
    }

    const totalLabelsCount = serials.length * (copies > 0 ? copies : 1);
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const generatedJobNumber = `JOB-${year}-${randomHex}`;

    // Metadata payload stored persistently in PostgreSQL
    const metaPayload: PrintJobMetadata = {
      job_number: generatedJobNumber,
      batch_id: batchId,
      printer: printerName,
      status: 'pending', // Explicitly PENDING initially
      total_labels: totalLabelsCount,
      printed_labels: 0,
      failed_labels: 0,
      is_reprint: isReprint,
      reprint_reason: reprintReason
    };

    const { data: inserted, error: insertErr } = await getClient()
      .from('print_jobs')
      .insert([{
        template_id: template.id,
        printer_name: encodePrinterPayload(metaPayload),
        copies: copies > 0 ? copies : 1,
        created_by: userId || null
      }])
      .select(`
        *,
        label_templates (*)
      `);

    if (insertErr || !inserted?.[0]) {
      throw new Error(insertErr?.message || 'Failed to persist print job in PostgreSQL database.');
    }

    const row = inserted[0];
    return {
      id: row.id,
      job_number: generatedJobNumber,
      batch_id: batchId,
      template_id: template.id,
      printer_name: printerName,
      copies: copies > 0 ? copies : 1,
      status: 'pending',
      total_labels: totalLabelsCount,
      printed_labels: 0,
      failed_labels: 0,
      is_reprint: isReprint,
      reprint_reason: reprintReason,
      created_by: row.created_by,
      created_at: row.created_at,
      label_templates: template,
      production_batches: batch
    };
  },

  async updateJobStatus(jobId: string, status: PrintJobStatus, extra?: {
    printed_labels?: number;
    failed_labels?: number;
    error_message?: string;
  }): Promise<void> {
    const { data: existing, error: fetchErr } = await getClient()
      .from('print_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new Error('PRINT_JOB_NOT_FOUND: Print job does not exist.');
    }

    const meta = parsePrinterPayload(existing.printer_name, existing.id);
    meta.status = status;
    if (extra?.printed_labels !== undefined) meta.printed_labels = extra.printed_labels;
    if (extra?.failed_labels !== undefined) meta.failed_labels = extra.failed_labels;
    if (extra?.error_message !== undefined) meta.error_message = extra.error_message;

    const { data: updated, error: updateErr } = await getClient()
      .from('print_jobs')
      .update({
        printer_name: encodePrinterPayload(meta)
      })
      .eq('id', jobId)
      .select();

    if (updateErr) throw updateErr;
  },

  async startPrint(jobId: string): Promise<void> {
    const job = await this.getById(jobId);
    if (!job) throw new Error('PRINT_JOB_NOT_FOUND: Print job does not exist.');
    if (job.status === 'cancelled') {
      throw new Error('PRINT_JOB_CANCELLED: Cancelled print jobs cannot be started.');
    }
    if (job.status === 'printed') {
      throw new Error('PRINT_JOB_ALREADY_COMPLETED: This print job has already completed printing.');
    }

    // Transition from pending/paused/failed -> processing in PostgreSQL
    await this.updateJobStatus(jobId, 'processing');
  },

  async pauseJob(jobId: string): Promise<void> {
    const job = await this.getById(jobId);
    if (!job) throw new Error('PRINT_JOB_NOT_FOUND: Print job does not exist.');
    if (job.status !== 'processing') {
      throw new Error('INVALID_JOB_STATE: Only actively processing jobs can be paused.');
    }
    await this.updateJobStatus(jobId, 'paused');
  },

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.getById(jobId);
    if (!job) throw new Error('PRINT_JOB_NOT_FOUND: Print job does not exist.');
    if (job.status !== 'paused') {
      throw new Error('INVALID_JOB_STATE: Only paused jobs can be resumed.');
    }
    await this.updateJobStatus(jobId, 'processing');
  },

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.getById(jobId);
    if (!job) throw new Error('PRINT_JOB_NOT_FOUND: Print job does not exist.');
    if (job.status === 'printed') {
      throw new Error('INVALID_JOB_STATE: Completed print jobs cannot be cancelled.');
    }
    await this.updateJobStatus(jobId, 'cancelled');
  },

  /**
   * Real Printer Execution Boundary:
   * Dispatches the thermal payload to the Zebra ZD220 printer driver/gateway.
   *
   * REQUIRED STATE RULE:
   * - If printer is OFFLINE before physical execution begins:
   *   Status remains PENDING. Do NOT convert PENDING -> FAILED.
   *   Do NOT mark batch printed. Do NOT mark serial printed. Do NOT create print history.
   * - If printer is ONLINE and execution begins:
   *   Job transitions PENDING -> PROCESSING.
   *   If actual printing execution fails after reaching PROCESSING:
   *   Job transitions PROCESSING -> FAILED and records actual failure reason.
   *   If printing completes:
   *   Job transitions PROCESSING -> PRINTED, batch -> printed, serials -> printed.
   */
  async executePrint(jobId: string, options?: { userId?: string }): Promise<{
    success: boolean;
    isOffline?: boolean;
    printedCount: number;
    error?: string;
  }> {
    const job = await this.getById(jobId);
    if (!job) throw new Error('PRINT_JOB_NOT_FOUND: Print job does not exist.');
    if (job.status === 'cancelled') throw new Error('PRINT_JOB_CANCELLED: Cannot execute a cancelled print job.');
    if (job.status === 'printed') throw new Error('PRINT_JOB_ALREADY_COMPLETED: This print job has already completed printing.');

    // Fail closed until a genuine Zebra Browser Print dispatch and approved template-to-ZPL
    // renderer have been bundled and physically validated. A boolean UI flag is not hardware proof.
    // This path intentionally does not touch job, batch, serial, or print-history records.
    const browserPrintAvailable = typeof window !== 'undefined' && Boolean((window as any).BrowserPrint);
    return {
      success: false,
      isOffline: true,
      printedCount: 0,
      error: browserPrintAvailable
        ? 'BROWSER_PRINT_RENDERER_NOT_READY: Browser Print is detectable, but approved template rendering and physical acceptance testing are still required. No database state was changed.'
        : 'BROWSER_PRINT_NOT_CONFIGURED: The genuine Zebra Browser Print SDK is not available in this candidate. The job was not executed; no Printed status or print history was recorded.'
    };
  }
};
