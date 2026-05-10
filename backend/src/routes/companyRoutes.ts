import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/companies
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, sector, category, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let query = supabase
      .from('companies')
      .select(`
        *,
        company_sector_tags(sector_tag)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,isin.ilike.%${search}%,nse_symbol.ilike.%${search}%`);
    }
    if (sector) {
      query = query.eq('sector_primary', sector);
    }

    query = query
      .order('company_name', { ascending: true })
      .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({ data, meta: { total: count ?? 0, limit: parseInt(limit, 10), offset: parseInt(offset, 10) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:isin
router.get('/:isin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isin } = req.params;

    const { data: company, error } = await supabase
      .from('companies')
      .select(`
        *,
        company_sector_tags(sector_tag),
        company_ladder_summary(*)
      `)
      .eq('isin', isin.toUpperCase())
      .single();

    if (error || !company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    // Full timeline
    const { data: timeline } = await supabase.rpc('get_company_timeline', { p_isin: isin.toUpperCase() });

    // Recent movements
    const { data: movements } = await supabase
      .from('ladder_movements')
      .select(`
        *,
        from_period:nifty_periods!from_period_id(period_label, period_end_date),
        to_period:nifty_periods!to_period_id(period_label, period_end_date)
      `)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Similar companies (same sector, same current category)
    const latestSnap = timeline?.[timeline.length - 1] as { category: string } | undefined;
    let similar: unknown[] = [];

    if (latestSnap && company.sector_primary) {
      const { data: similarData } = await supabase
        .from('v_latest_snapshot')
        .select('company_id, company_name, isin, nse_symbol, market_cap_rank, category')
        .eq('sector_primary', company.sector_primary)
        .eq('category', latestSnap.category)
        .neq('isin', isin.toUpperCase())
        .order('market_cap_rank', { ascending: true })
        .limit(10);
      similar = similarData ?? [];
    }

    res.json({
      data: {
        ...company,
        timeline: timeline ?? [],
        movements: movements ?? [],
        similar_companies: similar,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
