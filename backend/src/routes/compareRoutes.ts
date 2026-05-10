import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/compare?period_ids=id1,id2,id3&category=Large+Cap&limit=100&offset=0
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q        = req.query as Record<string, string>;
    const rawIds   = q.period_ids ?? '';
    const periodIds = rawIds.split(',').map(s => s.trim()).filter(Boolean);

    if (periodIds.length === 0) {
      res.json({ data: [], periods: [], meta: { total: 0 } });
      return;
    }

    const limit  = Math.min(parseInt(q.limit  ?? '100', 10) || 100, 500);
    const offset = parseInt(q.offset ?? '0', 10) || 0;
    const search = q.search?.trim().toLowerCase() || null;

    // Fetch period metadata in chronological order
    const { data: periodData } = await supabase
      .from('nifty_periods')
      .select('id, period_label, period_end_date')
      .in('id', periodIds)
      .order('period_end_date', { ascending: true });

    const orderedPeriods = periodData ?? [];
    const orderedIds     = orderedPeriods.map(p => p.id);

    if (orderedIds.length === 0) {
      res.json({ data: [], periods: [], meta: { total: 0 } });
      return;
    }

    // If a category filter is given, first resolve company_ids whose LATEST-period
    // snapshot is in that category — then we fetch their FULL rank history below
    // (otherwise filtering snapshots by category drops periods where the company was
    // a different cap, breaking the trend chart for any cross-cap company).
    const latestPeriodId = orderedIds[orderedIds.length - 1];
    let allowedCompanyIds: Set<string> | null = null;
    if (q.category) {
      const ids: string[] = [];
      for (let off = 0; ; off += 1000) {
        const { data: catRows, error: catErr } = await supabase
          .from('nifty_snapshots')
          .select('company_id')
          .eq('period_id', latestPeriodId)
          .eq('category', q.category)
          .range(off, off + 999);
        if (catErr) throw new Error(catErr.message);
        if (!catRows || catRows.length === 0) break;
        for (const r of catRows) if (r.company_id) ids.push(r.company_id as string);
        if (catRows.length < 1000) break;
      }
      allowedCompanyIds = new Set(ids);
      if (allowedCompanyIds.size === 0) {
        res.json({
          data: [], periods: orderedPeriods.map(p => ({ id: p.id, label: p.period_label, date: p.period_end_date })),
          meta: { total: 0, limit, offset },
        });
        return;
      }
    }

    // Fetch snapshots for these periods (paginate — Supabase caps at 1000/page).
    // No category filter on snapshots — we filter by company_id below to keep full history.
    const PAGE = 1000;
    const snaps: Record<string, unknown>[] = [];
    for (let pageOffset = 0; ; pageOffset += PAGE) {
      const { data: pageData, error: pageErr } = await supabase
        .from('nifty_snapshots')
        .select(`
          company_id,
          period_id,
          market_cap_rank,
          category,
          isin,
          company_name_raw,
          companies!company_id(
            id,
            company_name,
            nse_symbol,
            sector_primary,
            company_ladder_summary(trend_label, ladder_score, movement_path, periods_improved, periods_declined)
          )
        `)
        .in('period_id', orderedIds)
        .range(pageOffset, pageOffset + PAGE - 1);
      if (pageErr) throw new Error(pageErr.message);
      if (!pageData || pageData.length === 0) break;
      for (const r of pageData) {
        if (!allowedCompanyIds || (r.company_id && allowedCompanyIds.has(r.company_id as string))) {
          snaps.push(r as Record<string, unknown>);
        }
      }
      if (pageData.length < PAGE) break;
    }

    // Group by company
    type PeriodEntry = { rank: number | null; category: string | null };
    type CompanyEntry = {
      company_id:      string;
      company_name:    string | null;
      isin:            string;
      nse_symbol:      string | null;
      sector_primary:  string | null;
      trend_label:     string | null;
      ladder_score:    number | null;
      movement_path:   string | null;
      periods_improved: number;
      periods_declined: number;
      ranks:           Record<string, PeriodEntry>;
    };

    const byCompany = new Map<string, CompanyEntry>();

    for (const snap of snaps) {
      const co         = (snap.companies as unknown) as Record<string, unknown> | null;
      // PostgREST returns one-to-one as object, defensively handle array too.
      const rawSummary = co?.company_ladder_summary as Record<string, unknown> | Record<string, unknown>[] | null;
      const summary    = (Array.isArray(rawSummary) ? rawSummary[0] : rawSummary) ?? {};
      const cid        = snap.company_id as string;

      if (!byCompany.has(cid)) {
        byCompany.set(cid, {
          company_id:       cid,
          company_name:     (co?.company_name ?? snap.company_name_raw) as string | null,
          isin:             snap.isin as string,
          nse_symbol:       co?.nse_symbol as string | null ?? null,
          sector_primary:   co?.sector_primary as string | null ?? null,
          trend_label:      summary.trend_label as string | null ?? null,
          ladder_score:     summary.ladder_score as number | null ?? null,
          movement_path:    summary.movement_path as string | null ?? null,
          periods_improved: summary.periods_improved as number ?? 0,
          periods_declined: summary.periods_declined as number ?? 0,
          ranks: {},
        });
      }

      byCompany.get(cid)!.ranks[snap.period_id as string] = {
        rank:     snap.market_cap_rank as number | null,
        category: snap.category       as string | null,
      };
    }

    const firstId = orderedIds[0];
    const lastId  = orderedIds[orderedIds.length - 1];

    let companies = Array.from(byCompany.values());

    // Only keep companies that have data in at least 2 periods when multiple periods selected
    if (orderedIds.length > 1) {
      companies = companies.filter(c => Object.keys(c.ranks).length >= 2);
    }

    // Search filter (by company name, NSE symbol, or ISIN)
    if (search) {
      companies = companies.filter(c =>
        c.company_name?.toLowerCase().includes(search) ||
        c.nse_symbol?.toLowerCase().includes(search) ||
        c.isin.toLowerCase().includes(search)
      );
    }

    // Compute rank delta: positive = improved (rank went DOWN numerically = better)
    const result = companies.map(c => {
      const startRank = c.ranks[firstId]?.rank ?? null;
      const endRank   = c.ranks[lastId]?.rank   ?? null;
      const delta     = (startRank !== null && endRank !== null) ? startRank - endRank : null;
      return { ...c, rank_start: startRank, rank_end: endRank, rank_delta: delta };
    });

    // Sort by latest-period rank, companies with no latest-period rank go to the end
    result.sort((a, b) => {
      const aRank = a.ranks[lastId]?.rank ?? 999999;
      const bRank = b.ranks[lastId]?.rank ?? 999999;
      return aRank - bRank;
    });

    const total  = result.length;
    const paged  = result.slice(offset, offset + limit);

    res.json({
      data:    paged,
      periods: orderedPeriods.map(p => ({ id: p.id, label: p.period_label, date: p.period_end_date })),
      meta:    { total, limit, offset },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
