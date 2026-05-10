import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/dashboard/summary
router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_summary').single();
    if (error) {
      // Fallback: query view directly
      const { data: viewData, error: viewErr } = await supabase
        .from('v_dashboard_summary')
        .select('*')
        .single();
      if (viewErr) throw new Error(viewErr.message);
      res.json({ data: viewData });
      return;
    }
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/boundary-alerts
router.get('/boundary-alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const periodId = req.query.period_id as string | undefined;

    let query = supabase
      .from('nifty_snapshots')
      .select(`
        isin,
        company_name_raw,
        market_cap_rank,
        category,
        average_market_cap,
        companies(company_name, nse_symbol, bse_symbol, sector_primary),
        nifty_periods!period_id(period_label, period_end_date)
      `);

    if (periodId) {
      query = query.eq('period_id', periodId);
    } else {
      // Latest completed period
      const { data: latest } = await supabase
        .from('nifty_periods')
        .select('id')
        .eq('import_status', 'completed')
        .order('period_end_date', { ascending: false })
        .limit(1)
        .single();

      if (latest?.id) {
        query = query.eq('period_id', latest.id);
      }
    }

    // Get boundary companies: ranks 90-100, 101-125, 225-250, 251-300
    const { data, error } = await query
      .or('market_cap_rank.gte.90,market_cap_rank.lte.300')
      .order('market_cap_rank', { ascending: true });

    if (error) throw new Error(error.message);

    const NEAR_LARGE_DOWNGRADE = (data ?? []).filter(r => r.market_cap_rank >= 90 && r.market_cap_rank <= 100);
    const NEAR_LARGE_UPGRADE   = (data ?? []).filter(r => r.market_cap_rank >= 101 && r.market_cap_rank <= 125);
    const NEAR_MID_DOWNGRADE   = (data ?? []).filter(r => r.market_cap_rank >= 225 && r.market_cap_rank <= 250);
    const NEAR_MID_UPGRADE     = (data ?? []).filter(r => r.market_cap_rank >= 251 && r.market_cap_rank <= 300);

    res.json({
      data: {
        near_large_cap_downgrade: NEAR_LARGE_DOWNGRADE,
        near_large_cap_upgrade: NEAR_LARGE_UPGRADE,
        near_mid_cap_downgrade: NEAR_MID_DOWNGRADE,
        near_mid_cap_upgrade: NEAR_MID_UPGRADE,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
