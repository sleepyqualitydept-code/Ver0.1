/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';
import { serialNumbersApi } from './serialNumbersApi.ts';
import { printJobsApi, PrintJob } from './printJobsApi.ts';

const getClient = () => {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
};

export interface PrintHistoryRecord {
  id: string;
  print_job_id: string;
  serial_id: string;
  printed_at: string;
  // Joined relations
  print_jobs?: any;
  serial_numbers?: any;
}

export const printHistoryApi = {
  async getAll(filters?: {
    query?: string;
    batchId?: string;
    serialId?: string;
    jobId?: string;
  }): Promise<PrintHistoryRecord[]> {
    let q = getClient()
      .from('print_history')
      .select(`
        *,
        print_jobs (
          id,
          printer_name,
          copies,
          created_at,
          label_templates (id, name, label_width, label_height)
        ),
        serial_numbers (
          id,
          serial_number,
          status,
          production_date,
          batch_id,
          production_batches (
            id,
            batch_number,
            status,
            production_orders (
              id,
              order_number
            )
          ),
          models (
            id,
            name_ar,
            name_en,
            brands (id, name_ar, name_en)
          )
        )
      `)
      .order('printed_at', { ascending: false });

    if (filters?.jobId) {
      q = q.eq('print_job_id', filters.jobId);
    }
    if (filters?.serialId) {
      q = q.eq('serial_id', filters.serialId);
    }

    const { data, error } = await q;
    if (error) throw error;

    let results = data || [];

    // Filter by batchId if provided
    if (filters?.batchId && filters.batchId !== 'all') {
      results = results.filter((r: any) => 
        r.serial_numbers?.batch_id === filters.batchId || 
        r.serial_numbers?.production_batches?.id === filters.batchId
      );
    }

    // Database-backed search query evaluation
    if (filters?.query && filters.query.trim() !== '') {
      const qLower = filters.query.trim().toLowerCase();
      results = results.filter((r: any) => {
        const serialNo = r.serial_numbers?.serial_number?.toLowerCase() || '';
        const batchNo = r.serial_numbers?.production_batches?.batch_number?.toLowerCase() || '';
        const orderNo = r.serial_numbers?.production_batches?.production_orders?.order_number?.toLowerCase() || '';
        const modelNameAr = r.serial_numbers?.models?.name_ar?.toLowerCase() || '';
        const modelNameEn = r.serial_numbers?.models?.name_en?.toLowerCase() || '';
        const jobId = r.print_job_id?.toLowerCase() || '';
        return (
          serialNo.includes(qLower) ||
          batchNo.includes(qLower) ||
          orderNo.includes(qLower) ||
          modelNameAr.includes(qLower) ||
          modelNameEn.includes(qLower) ||
          jobId.includes(qLower)
        );
      });
    }

    return results;
  },

  async reprintSerial(params: {
    serialId: string;
    reason: string;
    userId?: string;
  }): Promise<PrintJob> {
    const { serialId, reason, userId } = params;

    if (!serialId || serialId.trim() === '') {
      throw new Error('REPRINT_VALIDATION_ERROR: Serial ID is required for reprint.');
    }

    if (!reason || reason.trim() === '') {
      throw new Error('REPRINT_VALIDATION_ERROR: A mandatory reprint reason is required for audit trail.');
    }

    // 1. Verify serial exists
    const serial = await serialNumbersApi.getById(serialId);
    if (!serial) {
      throw new Error('REPRINT_VALIDATION_ERROR: Serial record not found in database.');
    }

    // 2. Verify original print record exists
    const { data: existingHistory, error: historyLookupError } = await getClient()
      .from('print_history')
      .select('id, print_job_id, printed_at')
      .eq('serial_id', serialId)
      .order('printed_at', { ascending: false })
      .limit(1);

    if (historyLookupError) throw new Error(`REPRINT_VALIDATION_ERROR: Could not inspect original print history: ${historyLookupError.message}`);
    if (!existingHistory || existingHistory.length === 0) {
      throw new Error('REPRINT_VALIDATION_ERROR: Cannot reprint a serial without an original recorded print event.');
    }
    const originalPrintJobId = existingHistory[0].print_job_id;
    const { data: originalJob, error: originalJobError } = await getClient()
      .from('print_jobs')
      .select('template_id, printer_name')
      .eq('id', originalPrintJobId)
      .maybeSingle();
    if (originalJobError) throw new Error(`REPRINT_VALIDATION_ERROR: Could not load original print job: ${originalJobError.message}`);
    if (!originalJob?.template_id) {
      throw new Error('REPRINT_VALIDATION_ERROR: The original print job has no template reference, so a safe reprint cannot be queued.');
    }
    let originalMetadata: any = null;
    try {
      originalMetadata = typeof originalJob.printer_name === 'string' && originalJob.printer_name.trim().startsWith('{')
        ? JSON.parse(originalJob.printer_name)
        : null;
    } catch {
      originalMetadata = null;
    }
    const originalTemplateSnapshot = originalMetadata?.template_snapshot;
    if (!originalTemplateSnapshot || !Array.isArray(originalTemplateSnapshot.elements)) {
      throw new Error('REPRINT_VALIDATION_ERROR: The original print job has no saved label-layout snapshot. A safe reprint cannot be queued from an unversioned layout.');
    }

    const batchId = serial.batch_id || serial.production_batches?.id;
    if (!batchId) {
      throw new Error('REPRINT_VALIDATION_ERROR: Serial record does not have a linked production batch.');
    }

    // 3. Create a traceable Reprint Job in PostgreSQL
    // Queue a traceable request using the same template as the last actual print.
    // Do not insert print_history or mark this job printed before a physical print succeeds.
    return printJobsApi.createJob({
      batchId,
      templateId: originalJob.template_id,
      templateSnapshotOverride: originalTemplateSnapshot,
      targetSerialId: serialId,
      copies: 1,
      userId,
      isReprint: true,
      reprintReason: reason.trim()
    });
  }
};
