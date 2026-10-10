/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase.ts';
import { serialNumbersApi } from './serialNumbersApi.ts';
import { printJobsApi } from './printJobsApi.ts';

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
  }): Promise<PrintHistoryRecord> {
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
    const { data: existingHistory } = await getClient()
      .from('print_history')
      .select('*')
      .eq('serial_id', serialId)
      .limit(1);

    if ((!existingHistory || existingHistory.length === 0) && serial.status === 'generated') {
      throw new Error('REPRINT_VALIDATION_ERROR: Cannot reprint a label that has never been originally printed. Please run a standard print job first.');
    }

    const batchId = serial.batch_id || serial.production_batches?.id;
    if (!batchId) {
      throw new Error('REPRINT_VALIDATION_ERROR: Serial record does not have a linked production batch.');
    }

    // 3. Create a traceable Reprint Job in PostgreSQL
    const reprintJob = await printJobsApi.createJob({
      batchId,
      copies: 1,
      userId,
      isReprint: true,
      reprintReason: reason.trim()
    });

    // 4. Create new print_history entry (Original history remains untouched)
    const { data: newHist, error: insertErr } = await getClient()
      .from('print_history')
      .insert([{
        print_job_id: reprintJob.id,
        serial_id: serialId,
        printed_at: new Date().toISOString()
      }])
      .select();

    if (insertErr || !newHist?.[0]) {
      throw new Error(insertErr?.message || 'Failed to record reprint event in database.');
    }

    // Mark reprint job as printed
    await printJobsApi.updateJobStatus(reprintJob.id, 'printed', {
      printed_labels: 1,
      failed_labels: 0
    });

    // 5. Append history event to serial_history
    await serialNumbersApi.addHistoryEvent(
      serialId,
      'Printed',
      `[REPRINT EXECUTED] Reason: ${reason.trim()}`,
      userId
    );

    return newHist[0];
  }
};
