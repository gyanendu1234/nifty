import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/stars?type=rising|falling&limit=50&offset=0&category=Large+Cap&min_periods=1
// Rising  = companies with more periods improved than any filter threshold
// Falling = companies with more periods declined than any filter threshold
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q          = req.query as Record<string, string>;
    const type       = q.type === 'falling' ? 'falling' : 'rising';
    const limit      = Math.min(parseInt(q.limit  ?? '50', 10) || 50, 200);
    const offset     = parseInt(q.offset ?? '0', 10) || 0;
    const minPeriods = Math.max(1, parseInt(q.min_periods ?? '1', 10) || 1);
    const category   = q.category || null;   // end_category filter e.g. "Large Cap"
    const trendLabel = q.trend_label || null; // optional further filter

    // Get latest completed period for current rank lookup
    const { data: latestPeriod } = await supabase
      .from('nifty_periods')
      .select('id')
      .eq('import_status', 'completed')
      .order('period_end_date', { ascending: false })
      .limit(1)
      .single();

    const latestPeriodId = latestPeriod?.id;

    // Filter by periods_improved or periods_declined instead of non-existent trend_label values
    const periodField = type === 'rising' ? 'periods_improved' : 'periods_declined';

    let query = supabase
      .from('company_ladder_summary')
      .select(`
        company_id,
        trend_label,
        ladder_score,
        movement_path,
        periods_improved,
        periods_declined,
        periods_stable,
        start_category,
        end_category,
        total_rank_improvement,
        total_rank_decline,
        companies!company_id(
          company_name,
          isin,
          nse_symbol,
          sector_primary
        )
      `, { count: 'exact' })
      .gte(periodField, minPeriods)
      .order(periodField, { ascending: false })
      .order('ladder_score', { ascending: type !== 'rising' })
      .range(offset, offset + limit - 1);

    if (category)   query = query.eq('end_category', category);
    if (trendLabel) query = query.eq('trend_label', trendLabel);

    const { data: sumData, count } = await query;

    // Get current-period ranks for these companies
    const companyIds = (sumData ?? []).map(r => r.company_id as string).filter(Boolean);
    const snapshotMap: Record<string, { rank: number | null; category: string | null }> = {};

    if (companyIds.length > 0 && latestPeriodId) {
      const { data: snaps } = await supabase
        .from('nifty_snapshots')
        .select('company_id, market_cap_rank, category')
        .eq('period_id', latestPeriodId)
        .in('company_id', companyIds);

      for (const s of snaps ?? []) {
        const sid = s.company_id as string;
        snapshotMap[sid] = {
          rank:     s.market_cap_rank as number | null,
          category: s.category        as string | null,
        };
      }
    }

    const rows = (sumData ?? []).map(r => {
      const co   = (r.companies as unknown) as Record<string, unknown> | null;
      const snap = snapshotMap[r.company_id as string] ?? {};
      return {
        company_id:             r.company_id,
        company_name:           co?.company_name as string | null ?? null,
        isin:                   co?.isin         as string ?? '',
        nse_symbol:             co?.nse_symbol   as string | null ?? null,
        sector_primary:         co?.sector_primary as string | null ?? null,
        trend_label:            r.trend_label,
        ladder_score:           r.ladder_score,
        movement_path:          r.movement_path,
        periods_improved:       r.periods_improved as number ?? 0,
        periods_declined:       r.periods_declined as number ?? 0,
        periods_stable:         r.periods_stable   as number ?? 0,
        start_category:         r.start_category,
        end_category:           r.end_category,
        total_rank_improvement: r.total_rank_improvement as number ?? 0,
        total_rank_decline:     r.total_rank_decline     as number ?? 0,
        current_rank:           snap.rank     ?? null,
        current_category:       snap.category ?? null,
      };
    });

    res.json({ data: rows, meta: { total: count ?? 0, limit, offset } });
  } catch (err) {
    next(err);
  }
});

export default router;
