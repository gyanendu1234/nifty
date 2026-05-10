'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCompany } from '@/lib/api';
import { CompanyDetail, TimelineRow } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { MovementBadge } from '@/components/ui/MovementBadge';
import { RankChangePill } from '@/components/ui/RankChangePill';
import { RankHistoryChart } from '@/components/charts/RankHistoryChart';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, ExternalLink, Tag } from 'lucide-react';

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

export default function CompanyPage({ params }: { params: { isin: string } }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getCompany(params.isin.toUpperCase())
      .then(setCompany)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.isin]);

  if (loading) return <PageLoader />;

  if (error || !company) {
    return (
      <div className="card">
        <p className="text-red-400">{error ?? 'Company not found'}</p>
        <Link href="/ladder" className="btn-secondary mt-3 inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Ladder
        </Link>
      </div>
    );
  }

  const latestTimeline = company.timeline[company.timeline.length - 1] as TimelineRow | undefined;
  const summary = company.company_ladder_summary?.[0];
  const tags = company.company_sector_tags?.map(t => t.sector_tag) ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href="/ladder" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300">
        <ArrowLeft className="w-3.5 h-3.5" />Back to Ladder
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-1">
              {company.company_name ?? company.isin}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="font-mono">{company.isin}</span>
              {company.nse_symbol && (
                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs font-mono">
                  NSE: {company.nse_symbol}
                </span>
              )}
              {company.bse_symbol && (
                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs font-mono">
                  BSE: {company.bse_symbol}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {latestTimeline && (
            <div className="text-right">
              <CategoryBadge category={latestTimeline.category} />
              <p className="text-slate-300 font-bold text-xl mt-1">#{latestTimeline.market_cap_rank}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rank History Chart */}
      <div className="card">
        <h2 className="section-title">Rank History</h2>
        <RankHistoryChart timeline={company.timeline} />
        <p className="text-xs text-slate-600 mt-2">
          Green zone = Large Cap (Rank 1–100) | Yellow zone = Mid Cap (101–250) | Purple zone = Small Cap (251+)
        </p>
      </div>

      {/* Timeline Table */}
      <div className="card">
        <h2 className="section-title">Period-by-Period Timeline</h2>
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
                  <td className="text-slate-300 font-medium">{row.period_label}</td>
                  <td><CategoryBadge category={row.category} size="sm" /></td>
                  <td className="font-mono text-slate-200 font-semibold">#{row.market_cap_rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement History */}
      {company.movements.filter(m => m.from_period_id !== m.to_period_id).length > 0 && (
        <div className="card">
          <h2 className="section-title">Movement History</h2>
          <div className="space-y-2">
            {company.movements.filter(m => m.from_period_id !== m.to_period_id).map(m => {
              const fromP = m.from_period as { period_label?: string } | undefined;
              const toP   = m.to_period   as { period_label?: string } | undefined;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <MovementBadge movementType={m.movement_type} size="sm" />
                    <span className="text-xs text-slate-500">
                      {fromP?.period_label ?? '—'} → {toP?.period_label ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
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
          <h2 className="section-title">Ladder Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoItem label="Start Category"    value={<CategoryBadge category={summary.start_category as string} size="sm" />} />
            <InfoItem label="Current Category"  value={<CategoryBadge category={summary.end_category as string} size="sm" />} />
            <InfoItem label="Periods Improved"  value={<span className="text-green-400 font-semibold">{summary.periods_improved}</span>} />
            <InfoItem label="Periods Declined"  value={<span className="text-red-400 font-semibold">{summary.periods_declined}</span>} />
            <InfoItem label="Periods Stable"    value={<span className="text-slate-400 font-semibold">{summary.periods_stable}</span>} />
            <InfoItem label="Total Rank Gain"   value={<span className="text-green-400 font-semibold">+{summary.total_rank_improvement}</span>} />
            {summary.small_to_mid_months && (
              <InfoItem label="Small → Mid"     value={`${summary.small_to_mid_months} months`} />
            )}
            {summary.mid_to_large_months && (
              <InfoItem label="Mid → Large"     value={`${summary.mid_to_large_months} months`} />
            )}
            <InfoItem label="Trend" value={<span className="text-blue-400">{summary.trend_label ?? '—'}</span>} />
          </div>
        </div>
      )}

      {/* Similar Companies */}
      {company.similar_companies.length > 0 && (
        <div className="card">
          <h2 className="section-title">Similar Companies in Same Sector</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {company.similar_companies.map(s => (
              <Link
                key={s.isin}
                href={`/company/${s.isin}`}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-blue-400">
                    {s.company_name ?? s.isin}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{s.nse_symbol ?? s.isin}</p>
                </div>
                <div className="text-right">
                  <CategoryBadge category={s.category} size="sm" />
                  <p className="text-xs text-slate-400 font-mono mt-1">#{s.market_cap_rank}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card border-yellow-900/30 bg-yellow-950/10">
        <p className="text-xs text-yellow-700 leading-relaxed">
          This platform provides market-cap ladder trend analysis based on SEBI/AMFI categorisation data.
          It is <strong>not investment advice</strong>, stock recommendation, or valuation analysis.
        </p>
      </div>
    </div>
  );
}
