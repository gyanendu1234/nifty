import { supabase } from '../config/supabase';
import { logger } from '../config/logger';
import { parseNiftyExcel } from './niftyParser';
import { calculateMovementsForPeriod, recalculateSummary } from './movementCalculator';
import { ParsedNiftyRow } from '../types';

// NOTE: The Supabase storage bucket must also be renamed from 'amfi-files' to 'nifty-files'
// in the Supabase dashboard manually. Only the code reference is changed here.
const NIFTY_FILES_BUCKET = 'nifty-files';

export interface UploadInput {
  fileBuffer: Buffer;
  originalName: string;
  periodLabel: string;
  periodEndDate: string;
  notes?: string;
}

export interface UploadResult {
  period_id: string;
  rows_parsed: number;
  companies_upserted: number;
  snapshots_inserted: number;
  movements_inserted: number;
  errors: string[];
}

export async function processNiftyUpload(input: UploadInput): Promise<UploadResult> {
  const errors: string[] = [];

  // ── 1. Store original file in Supabase Storage ──
  const filePath = `raw/${input.periodEndDate.substring(0, 7)}-nifty.xlsx`;
  const { error: storageErr } = await supabase.storage
    .from(NIFTY_FILES_BUCKET)
    .upload(filePath, input.fileBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });

  if (storageErr) {
    logger.warn('Storage upload warning (continuing):', storageErr.message);
  }

  // ── 2. Create nifty_periods record ──
  const { data: period, error: periodErr } = await supabase
    .from('nifty_periods')
    .insert({
      period_label:     input.periodLabel,
      period_end_date:  input.periodEndDate,
      source_file_name: input.originalName,
      source_file_path: filePath,
      import_status:    'processing',
      notes:            input.notes ?? null,
    })
    .select()
    .single();

  if (periodErr || !period) {
    throw new Error(`Failed to create period record: ${periodErr?.message}`);
  }

  const periodId = period.id as string;
  logger.info(`Created period ${periodId} (${input.periodLabel})`);

  try {
    // ── 3. Parse Excel ──
    const rawRows = parseNiftyExcel(input.fileBuffer);

    // Deduplicate by ISIN — some source files contain duplicate rows for the same ISIN
    const seenIsins = new Set<string>();
    const rows = rawRows.filter(r => { if (seenIsins.has(r.isin)) return false; seenIsins.add(r.isin); return true; });
    if (rows.length < rawRows.length) {
      logger.warn(`Deduplicated ${rawRows.length - rows.length} duplicate ISINs from ${input.originalName}`);
    }

    // ── 4. Upsert companies (by ISIN) ──
    const companyUpserts = rows.map(r => ({
      isin:         r.isin,
      company_name: r.companyName,
      nse_symbol:   r.nseSymbol ?? null,
      bse_symbol:   r.bseSymbol ?? null,
    }));

    const { error: companyErr } = await supabase
      .from('companies')
      .upsert(companyUpserts, { onConflict: 'isin', ignoreDuplicates: false });

    if (companyErr) {
      throw new Error(`Company upsert failed: ${companyErr.message}`);
    }

    // ── 5. Fetch company IDs by ISIN (chunked to avoid URL length limits) ──
    const isins = rows.map(r => r.isin);
    const ISIN_CHUNK = 200;
    const companies: { id: string; isin: string }[] = [];

    for (let i = 0; i < isins.length; i += ISIN_CHUNK) {
      const chunk = isins.slice(i, i + ISIN_CHUNK);
      const { data, error: fetchErr } = await supabase
        .from('companies')
        .select('id, isin')
        .in('isin', chunk);

      if (fetchErr) {
        throw new Error(`Company fetch failed (chunk ${i}): ${fetchErr.message}`);
      }
      companies.push(...(data ?? []));
    }

    const companyByIsin = new Map(companies.map(c => [c.isin as string, c.id as string]));

    // ── 6. Insert nifty_snapshots ──
    const snapshots = rows.map((r: ParsedNiftyRow) => ({
      company_id:        companyByIsin.get(r.isin) ?? null,
      period_id:         periodId,
      isin:              r.isin,
      company_name_raw:  r.companyName,
      nse_symbol:        r.nseSymbol ?? null,
      bse_symbol:        r.bseSymbol ?? null,
      market_cap_rank:   r.rank,
      average_market_cap: r.averageMarketCap ?? null,
      category:          r.category,
    }));

    // Delete existing snapshots for this period (idempotent re-upload)
    await supabase.from('nifty_snapshots').delete().eq('period_id', periodId);

    const CHUNK_SIZE = 500;
    let snapshotsInserted = 0;

    for (let i = 0; i < snapshots.length; i += CHUNK_SIZE) {
      const chunk = snapshots.slice(i, i + CHUNK_SIZE);
      const { error: snapErr } = await supabase.from('nifty_snapshots').insert(chunk);
      if (snapErr) {
        errors.push(`Snapshot chunk ${i}: ${snapErr.message}`);
      } else {
        snapshotsInserted += chunk.length;
      }
    }

    // ── 7. Find previous period (by date) ──
    const { data: prevPeriods } = await supabase
      .from('nifty_periods')
      .select('id')
      .eq('import_status', 'completed')
      .lt('period_end_date', input.periodEndDate)
      .order('period_end_date', { ascending: false })
      .limit(1);

    const prevPeriodId = prevPeriods?.[0]?.id ?? null;

    // ── 8. Calculate movements ──
    const { inserted: movInserted, errors: movErrors } =
      await calculateMovementsForPeriod(periodId, prevPeriodId);
    errors.push(...movErrors);

    // ── 9. Recalculate summaries for affected companies ──
    const affectedCompanyIds = [...companyByIsin.values()];
    const SUMMARY_CHUNK = 50;

    for (let i = 0; i < affectedCompanyIds.length; i += SUMMARY_CHUNK) {
      const chunk = affectedCompanyIds.slice(i, i + SUMMARY_CHUNK);
      await Promise.allSettled(chunk.map(id => recalculateSummary(id)));
    }

    // ── 10. Mark period as completed ──
    await supabase
      .from('nifty_periods')
      .update({ import_status: 'completed' })
      .eq('id', periodId);

    return {
      period_id:           periodId,
      rows_parsed:         rows.length,
      companies_upserted:  companyUpserts.length,
      snapshots_inserted:  snapshotsInserted,
      movements_inserted:  movInserted,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Import failed for period ${periodId}:`, message);

    await supabase
      .from('nifty_periods')
      .update({ import_status: 'failed', import_error: message })
      .eq('id', periodId);

    throw err;
  }
}

export async function reprocessPeriod(periodId: string): Promise<UploadResult> {
  const { data: period, error } = await supabase
    .from('nifty_periods')
    .select('*')
    .eq('id', periodId)
    .single();

  if (error || !period) throw new Error('Period not found');
  if (!period.source_file_path) throw new Error('No source file path on this period');

  const { data: fileData, error: dlErr } = await supabase.storage
    .from(NIFTY_FILES_BUCKET)
    .download(period.source_file_path);

  if (dlErr || !fileData) throw new Error(`Could not download stored file: ${dlErr?.message}`);

  const buffer = Buffer.from(await fileData.arrayBuffer());

  return processNiftyUpload({
    fileBuffer:     buffer,
    originalName:   period.source_file_name ?? 'reprocess.xlsx',
    periodLabel:    period.period_label,
    periodEndDate:  period.period_end_date,
    notes:          period.notes ?? undefined,
  });
}
