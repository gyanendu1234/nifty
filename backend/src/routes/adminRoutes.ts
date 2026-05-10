import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/authMiddleware';
import { supabase } from '../config/supabase';
import { processNiftyUpload, reprocessPeriod } from '../services/uploadService';
import { calculateMovementsForPeriod, recalculateSummary } from '../services/movementCalculator';
import { logger } from '../config/logger';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 52_428_800 } });

// POST /api/admin/upload
router.post(
  '/upload',
  requireAdmin,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { period_label, period_end_date, notes } = req.body as {
        period_label: string;
        period_end_date: string;
        notes?: string;
      };

      if (!period_label || !period_end_date) {
        res.status(400).json({ error: 'period_label and period_end_date are required' });
        return;
      }

      const result = await processNiftyUpload({
        fileBuffer:    req.file.buffer,
        originalName:  req.file.originalname,
        periodLabel:   period_label,
        periodEndDate: period_end_date,
        notes,
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/reprocess/:periodId
router.post('/reprocess/:periodId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reprocessPeriod(req.params.periodId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/periods/:periodId
router.delete('/periods/:periodId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { periodId } = req.params;

    // Delete dependent rows first
    await supabase.from('ladder_movements').delete().eq('to_period_id', periodId);
    await supabase.from('ladder_movements').delete().eq('from_period_id', periodId);
    await supabase.from('nifty_snapshots').delete().eq('period_id', periodId);

    const { error } = await supabase.from('nifty_periods').delete().eq('id', periodId);
    if (error) throw new Error(error.message);

    res.json({ data: { deleted: true, periodId } });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/companies?limit=N&offset=N
router.get('/companies', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit  = Math.min(parseInt((req.query.limit as string) ?? '1000', 10) || 1000, 10000);
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;
    const { data, error, count } = await supabase
      .from('companies')
      .select('id, isin, company_name, nse_symbol, bse_symbol, sector_primary', { count: 'exact' })
      .order('company_name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    res.json({ data: data ?? [], meta: { total: count ?? 0, limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/periods
router.get('/periods', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('nifty_periods')
      .select('*')
      .order('period_end_date', { ascending: false });

    if (error) throw new Error(error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/recalculate-movements/:periodId
router.post('/recalculate-movements/:periodId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { periodId } = req.params;

    const { data: period } = await supabase
      .from('nifty_periods')
      .select('period_end_date')
      .eq('id', periodId)
      .single();

    const { data: prevPeriods } = await supabase
      .from('nifty_periods')
      .select('id')
      .eq('import_status', 'completed')
      .lt('period_end_date', period?.period_end_date)
      .order('period_end_date', { ascending: false })
      .limit(1);

    const prevPeriodId = prevPeriods?.[0]?.id ?? null;
    const result = await calculateMovementsForPeriod(periodId, prevPeriodId);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/companies/:companyId/tags
router.post('/companies/:companyId/tags', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const { tags } = req.body as { tags: string[] };

    if (!Array.isArray(tags) || tags.length === 0) {
      res.status(400).json({ error: 'tags array is required' });
      return;
    }

    // Delete existing tags, re-insert
    await supabase.from('company_sector_tags').delete().eq('company_id', companyId);

    const inserts = tags.map(tag => ({ company_id: companyId, sector_tag: tag.trim() }));
    const { error } = await supabase.from('company_sector_tags').insert(inserts);
    if (error) throw new Error(error.message);

    res.json({ data: { company_id: companyId, tags } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/companies/:companyId/sector
router.patch('/companies/:companyId/sector', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sector_primary } = req.body as { sector_primary: string };
    const { error } = await supabase
      .from('companies')
      .update({ sector_primary })
      .eq('id', req.params.companyId);

    if (error) throw new Error(error.message);
    res.json({ data: { updated: true } });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/recalculate-summaries
router.post('/recalculate-summaries', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Page through ALL companies (Supabase caps select() at 1000 rows by default)
    const PAGE = 1000;
    const ids: string[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data: rows, error } = await supabase
        .from('companies')
        .select('id')
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      for (const r of rows) ids.push(r.id as string);
      if (rows.length < PAGE) break;
    }

    let done = 0;
    let skipped = 0;
    for (const id of ids) {
      try {
        await recalculateSummary(id);
        done++;
      } catch (e) {
        skipped++;
        logger.warn(`Summary skip ${id}: ${(e as Error).message}`);
      }
    }

    res.json({ data: { total: ids.length, recalculated: done, skipped } });
  } catch (err) {
    next(err);
  }
});

export default router;
