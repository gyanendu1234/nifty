import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

const BOUNDARY_RANGES: Record<string, { min: number; max: number }> = {
  'near-large-upgrade':   { min: 101, max: 125 },
  'near-large-downgrade': { min: 90,  max: 100 },
  'near-mid-upgrade':     { min: 251, max: 300 },
  'near-mid-downgrade':   { min: 225, max: 250 },
  'deep-large':           { min: 1,   max: 75  },
  'deep-mid':             { min: 126, max: 225 },
  'deep-small':           { min: 301, max: 99999 },
};

type MovData = {
  movement_type?: string | null;
  rank_change?: number | null;
  is_category_entry?: boolean;
  entered_category?: string | null;
  is_category_exit?: boolean;
  exited_category?: string | null;
};

// GET /api/ladder
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;

    const limit  = Math.min(parseInt(q.limit ?? '50', 10) || 50, 500);
    const offset = parseInt(q.offset ?? '0', 10) || 0;

    // ── Resolve period ──
    let toPeriodId: string | undefined = q.to_period_id ?? q.period_id;

    if (!toPeriodId) {
      const { data: latest } = await supabase
        .from('nifty_periods')
        .select('id')
        .eq('import_status', 'completed')
        .order('period_end_date', { ascending: false })
        .limit(1)
        .single();
      toPeriodId = latest?.id;
    }

    if (!toPeriodId) {
      res.json({ data: [], meta: { total: 0, limit, offset } });
      return;
    }

    // ── Pre-filter: movement fields → get matching company_ids from ladder_movements ──
    // This fixes pagination: count and data now reflect the filtered set correctly.
    const hasMovFilter = q.is_category_exit === 'true' || q.is_category_entry === 'true' ||
                         !!q.exited_category || !!q.entered_category || !!q.movement_type;

    let movFilterIds: string[] | null = null;
    if (hasMovFilter) {
      let movQ = supabase
        .from('ladder_movements')
        .select('company_id')
        .eq('to_period_id', toPeriodId);

      if (q.is_category_exit === 'true')  movQ = movQ.eq('is_category_exit', true);
      if (q.is_category_entry === 'true') movQ = movQ.eq('is_category_entry', true);
      if (q.exited_category)              movQ = movQ.eq('exited_category', q.exited_category);
      if (q.entered_category)             movQ = movQ.eq('entered_category', q.entered_category);
      if (q.movement_type)                movQ = movQ.eq('movement_type', q.movement_type);

      const { data: movRows } = await movQ;
      movFilterIds = (movRows ?? []).map((m: Record<string, unknown>) => m.company_id as string);

      if (movFilterIds.length === 0) {
        res.json({ data: [], meta: { total: 0, limit, offset } });
        return;
      }
    }

    // ── Pre-filter: summary fields → get matching company_ids from company_ladder_summary ──
    const hasSummaryFilter = !!q.stability_status || !!q.trend_label;

    let summaryFilterIds: string[] | null = null;
    if (hasSummaryFilter) {
      let sumQ = supabase.from('company_ladder_summary').select('company_id');
      if (q.stability_status) sumQ = sumQ.eq('stability_status', q.stability_status);
      if (q.trend_label)      sumQ = sumQ.eq('trend_label', q.trend_label);

      const { data: sumRows } = await sumQ;
      summaryFilterIds = (sumRows ?? []).map((c: Record<string, unknown>) => c.company_id as string);

      if (summaryFilterIds.length === 0) {
        res.json({ data: [], meta: { total: 0, limit, offset } });
        return;
      }
    }

    // ── Build snapshot query ──
    let query = supabase
      .from('nifty_snapshots')
      .select(`
        id,
        isin,
        company_name_raw,
        nse_symbol,
        bse_symbol,
        market_cap_rank,
        average_market_cap,
        category,
        companies!company_id(
          id,
          company_name,
          nse_symbol,
          bse_symbol,
          sector_primary,
          company_sector_tags(sector_tag),
          company_ladder_summary(
            movement_path,
            stability_status,
            trend_label,
            ladder_score,
            start_category
          )
        )
      `, { count: 'exact' })
      .eq('period_id', toPeriodId);

    // Apply pre-computed company_id lists
    if (movFilterIds)     query = query.in('company_id', movFilterIds);
    if (summaryFilterIds) query = query.in('company_id', summaryFilterIds);

    if (q.category)  query = query.eq('category', q.category);
    if (q.rank_min)  query = query.gte('market_cap_rank', parseInt(q.rank_min, 10));
    if (q.rank_max)  query = query.lte('market_cap_rank', parseInt(q.rank_max, 10));

    if (q.near_boundary) {
      const range = BOUNDARY_RANGES[q.near_boundary];
      if (range) query = query.gte('market_cap_rank', range.min).lte('market_cap_rank', range.max);
    }

    if (q.search) {
      query = query.or(`isin.ilike.%${q.search}%,company_name_raw.ilike.%${q.search}%`);
    }

    const sortBy  = q.sort_by  ?? 'market_cap_rank';
    const sortDir = q.sort_dir ?? 'asc';
    if (['market_cap_rank', 'category', 'company_name_raw'].includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortDir === 'asc' });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // ── Always fetch movements for the resolved period ──
    const movByCompany = new Map<string, MovData>();
    const { data: movements } = await supabase
      .from('ladder_movements')
      .select('company_id, movement_type, rank_change, is_category_entry, entered_category, is_category_exit, exited_category')
      .eq('to_period_id', toPeriodId);

    for (const m of movements ?? []) {
      movByCompany.set(m.company_id as string, m as MovData);
    }

    let rows = (data ?? []).map((snap: Record<string, unknown>) => {
      const company = snap.companies as Record<string, unknown> | null;
      // PostgREST returns one-to-one relations as an object, but defensively handle array too.
      const rawSummary = company?.company_ladder_summary as Record<string, unknown> | Record<string, unknown>[] | null;
      const summary    = (Array.isArray(rawSummary) ? rawSummary[0] : rawSummary) ?? {};
      const mov: MovData = movByCompany.get(company?.id as string ?? '') ?? {};

      return {
        company_id:         company?.id,
        company_name:       company?.company_name ?? snap.company_name_raw,
        isin:               snap.isin,
        nse_symbol:         company?.nse_symbol ?? snap.nse_symbol,
        bse_symbol:         company?.bse_symbol ?? snap.bse_symbol,
        sector_primary:     company?.sector_primary,
        sector_tags:        (company?.company_sector_tags as { sector_tag: string }[] ?? []).map(t => t.sector_tag),
        current_category:   snap.category,
        current_rank:       snap.market_cap_rank,
        average_market_cap: snap.average_market_cap,
        start_category:     (summary as Record<string, unknown>).start_category ?? null,
        movement_path:      (summary as Record<string, unknown>).movement_path ?? null,
        stability_status:   (summary as Record<string, unknown>).stability_status ?? null,
        trend_label:        (summary as Record<string, unknown>).trend_label ?? null,
        ladder_score:       (summary as Record<string, unknown>).ladder_score ?? null,
        movement_type:      mov.movement_type ?? null,
        rank_change:        mov.rank_change ?? null,
        is_category_entry:  mov.is_category_entry ?? false,
        entered_category:   mov.entered_category ?? null,
        is_category_exit:   mov.is_category_exit ?? false,
        exited_category:    mov.exited_category ?? null,
      };
    });

    // Sector post-filter (involves both sector_primary and sector_tags; pre-filtering is complex)
    if (q.sector) {
      rows = rows.filter(r => r.sector_primary === q.sector || r.sector_tags.includes(q.sector));
    }

    res.json({ data: rows, meta: { total: count ?? rows.length, limit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /api/ladder/entry-exit
router.get('/entry-exit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period_id, category, type, limit = '50', offset = '0' } = req.query as Record<string, string>;

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
      res.json({ data: [], meta: { total: 0 } });
      return;
    }

    let query = supabase
      .from('ladder_movements')
      .select(`
        *,
        companies!company_id(company_name, isin, nse_symbol, bse_symbol, sector_primary, company_ladder_summary(trend_label, stability_status)),
        from_period:nifty_periods!from_period_id(period_label),
        to_period:nifty_periods!to_period_id(period_label)
      `, { count: 'exact' })
      .eq('to_period_id', effectivePeriodId);

    if (type === 'entry') {
      query = query.eq('is_category_entry', true);
      if (category) query = query.eq('entered_category', category);
    } else if (type === 'exit') {
      query = query.eq('is_category_exit', true);
      if (category) query = query.eq('exited_category', category);
    }

    query = query.range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // Hoist company_ladder_summary from inside companies to top level (frontend expects it there)
    const rows = (data ?? []).map((m: Record<string, unknown>) => {
      const co = m.companies as Record<string, unknown> | null;
      const { company_ladder_summary: cls, ...companiesRest } = (co ?? {}) as Record<string, unknown>;
      return { ...m, companies: co ? companiesRest : null, company_ladder_summary: cls ?? [] };
    });

    res.json({ data: rows, meta: { total: count ?? 0, limit: parseInt(limit, 10), offset: parseInt(offset, 10) } });
  } catch (err) {
    next(err);
  }
});

export default router;
