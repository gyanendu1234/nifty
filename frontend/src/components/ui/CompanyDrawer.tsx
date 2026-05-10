'use client';

import { useEffect, useState } from 'react';
import { getCompany } from '@/lib/api';
import { CompanyDetail, TimelineRow } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { MovementBadge } from '@/components/ui/MovementBadge';
import { RankChangePill } from '@/components/ui/RankChangePill';
import { RankHistoryChart } from '@/components/charts/RankHistoryChart';
import { X, ExternalLink, Tag, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Props {
  isin: string | null;
  onClose: () => void;
}

export function CompanyDrawer({ isin, onClose }: Props) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isin) return;
    setLoading(true);
    setError(null);
    setCompany(null);
    getCompany(isin.toUpperCase())
      .then(setCompany)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [isin]);

  // Close on Escape
  useEffect(() => {
    if (!isin) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isin, onClose]);

  const open = !!isin;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-screen w-full max-w-md bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            {company ? (
              <>
                <h2 className="text-lg font-bold text-slate-100 leading-tight">
                  {company.company_name ?? company.isin}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                  <span>{company.isin}</span>
                  {company.nse_symbol && <span className="bg-slate-800 px-1.5 py-0.5 rounded">NSE: {company.nse_symbol}</span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Loading company…</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {company && (
              <Link
                href={`/company/${company.isin}`}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-800"
                title="Open full page"
              >
                <ExternalLink className="w-3.5 h-3.5" />Full page
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          )}

          {error && (
            <div className="p-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {company && !loading && <CompanyContent company={company} />}
        </div>
      </div>
    </>
  );
}

function CompanyContent({ company }: { company: CompanyDetail }) {
  const latestTimeline = company.timeline[company.timeline.length - 1] as TimelineRow | undefined;
  const summary = company.company_ladder_summary?.[0];
  const tags = company.company_sector_tags?.map(t => t.sector_tag) ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-3">
        {latestTimeline && (
          <>
            <CategoryBadge category={latestTimeline.category} />
            <span className="font-mono font-bold text-slate-200">#{latestTimeline.market_cap_rank}</span>
          </>
        )}
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
            <Tag className="w-2.5 h-2.5" />{tag}
          </span>
        ))}
      </div>

      {/* Rank History */}
      <div className="card">
        <h3 className="section-title mb-3">Rank History</h3>
        <RankHistoryChart timeline={company.timeline} />
        <p className="text-xs text-slate-600 mt-2">
          Green = Large Cap (1–100) · Yellow = Mid Cap (101–250) · Purple = Small Cap (251+)
        </p>
      </div>

      {/* Period-by-Period Timeline */}
      <div className="card">
        <h3 className="section-title mb-3">All Periods</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Category</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {[...company.timeline].reverse().map((row, i) => (
                <tr key={i}>
                  <td className="text-slate-300 font-medium text-xs">{row.period_label}</td>
                  <td><CategoryBadge category={row.category} size="sm" /></td>
                  <td className="font-mono text-slate-200 font-semibold text-xs">#{row.market_cap_rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement History */}
      {company.movements.filter(m => m.from_period_id !== m.to_period_id).length > 0 && (
        <div className="card">
          <h3 className="section-title mb-3">Movement History</h3>
          <div className="space-y-2">
            {company.movements.filter(m => m.from_period_id !== m.to_period_id).map(m => {
              const fromP = m.from_period as { period_label?: string } | undefined;
              const toP   = m.to_period   as { period_label?: string } | undefined;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MovementBadge movementType={m.movement_type} size="sm" />
                    <span className="text-xs text-slate-500">
                      {fromP?.period_label ?? '—'} → {toP?.period_label ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <CategoryBadge category={m.from_category as string} size="sm" />
                      <span>→</span>
                      <CategoryBadge category={m.to_category as string} size="sm" />
                    </div>
                    <RankChangePill change={m.rank_change} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="card">
          <h3 className="section-title mb-3">Ladder Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="kpi-label">Start</p>
              <CategoryBadge category={summary.start_category as string} size="sm" />
            </div>
            <div>
              <p className="kpi-label">Current</p>
              <CategoryBadge category={summary.end_category as string} size="sm" />
            </div>
            <div>
              <p className="kpi-label">Periods Improved</p>
              <p className="text-green-400 font-semibold mt-0.5">{summary.periods_improved}</p>
            </div>
            <div>
              <p className="kpi-label">Periods Declined</p>
              <p className="text-red-400 font-semibold mt-0.5">{summary.periods_declined}</p>
            </div>
            <div>
              <p className="kpi-label">Periods Stable</p>
              <p className="text-slate-400 font-semibold mt-0.5">{summary.periods_stable}</p>
            </div>
            <div>
              <p className="kpi-label">Total Rank Gain</p>
              <p className="text-green-400 font-semibold mt-0.5">+{summary.total_rank_improvement}</p>
            </div>
            <div>
              <p className="kpi-label">Trend</p>
              <p className="text-blue-400 mt-0.5">{summary.trend_label ?? '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
