import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/sectors
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase.rpc('get_sector_summary');
    if (error) throw new Error(error.message);
    res.json({ data: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/sectors/:sector
router.get('/:sector', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sector = decodeURIComponent(req.params.sector);
    const { period_id } = req.query as { period_id?: string };

    let effectivePeriodId = period_id;
    if (!effectivePeriodId) {
      const { data: latest } = await supabase
        .from('nifty_periods')
        .select('id')
        .eq('import_status', 'completed')
        .order('period_end_date', { ascending: false })
        .limit(1)
        .single();
      effectivePeriodId = latest?.id;
    }

    if (!effectivePeriodId) {
      res.json({ data: [] });
      return;
    }

    const { data: rawData, error } = await supabase
      .from('nifty_snapshots')
      .select(`
        isin,
        company_name_raw,
        market_cap_rank,
        category,
        average_market_cap,
        companies!company_id(
          company_name,
          nse_symbol,
          bse_symbol,
          sector_primary,
          company_ladder_summary(
            movement_path,
            stability_status,
            trend_label,
            ladder_score
          )
        )
      `)
      .eq('period_id', effectivePeriodId)
      .eq('companies.sector_primary', sector)
      .order('market_cap_rank', { ascending: true });

    if (error) throw new Error(error.message);

    // Hoist company_ladder_summary from inside companies to snapshot level (frontend expects it there)
    const data = (rawData ?? []).map((snap: Record<string, unknown>) => {
      const co = snap.companies as Record<string, unknown> | null;
      const { company_ladder_summary: cls, ...companiesRest } = (co ?? {}) as Record<string, unknown>;
      return { ...snap, companies: co ? companiesRest : null, company_ladder_summary: cls ?? null };
    });

    // Historical trend (all periods) for this sector
    const { data: allPeriods } = await supabase
      .from('nifty_periods')
      .select('id, period_label, period_end_date')
      .eq('import_status', 'completed')
      .order('period_end_date', { ascending: true });

    const trendByPeriod = [];
    for (const p of allPeriods ?? []) {
      const { data: ps, count } = await supabase
        .from('nifty_snapshots')
        .select('category', { count: 'exact' })
        .eq('period_id', p.id)
        .eq('companies.sector_primary', sector);

      trendByPeriod.push({
        period_label: p.period_label,
        period_end_date: p.period_end_date,
        large_cap: (ps ?? []).filter(s => s.category === 'Large Cap').length,
        mid_cap:   (ps ?? []).filter(s => s.category === 'Mid Cap').length,
        small_cap: (ps ?? []).filter(s => s.category === 'Small Cap').length,
        total: count ?? 0,
      });
    }

    res.json({
      data: {
        sector,
        companies: data ?? [],
        trend_history: trendByPeriod,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
