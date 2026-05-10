'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSector } from '@/lib/api';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { StabilityBadge } from '@/components/ui/StabilityBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface TrendPoint {
  period_label: string;
  large_cap: number;
  mid_cap: number;
  small_cap: number;
  total: number;
}

interface SectorData {
  sector: string;
  companies: unknown[];
  trend_history: TrendPoint[];
}

export default function SectorDetailPage({ params }: { params: { sector: string } }) {
  const sector = decodeURIComponent(params.sector);
  const [data, setData]       = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSector(sector)
      .then(res => setData(res.data as SectorData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sector]);

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState title="Sector not found" />;

  const companies = data.companies as Array<{
    isin: string;
    company_name_raw: string | null;
    market_cap_rank: number | null;
    category: string;
    companies?: { company_name: string | null; nse_symbol: string | null };
    company_ladder_summary?: Array<{ stability_status: string | null; trend_label: string | null }> | null;
  }>;

  return (
    <div className="space-y-6">
      <Link href="/sectors" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300">
        <ArrowLeft className="w-3.5 h-3.5" />All Sectors
      </Link>

      <div>
        <h1 className="page-title">{sector}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {companies.length} companies tracked in this sector
        </p>
      </div>

      {/* Trend chart */}
      {data.trend_history.length > 0 && (
        <div className="card">
          <h2 className="section-title">Cap Category Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.trend_history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="period_label" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="large_cap" stackId="a" fill="#22c55e" name="Large Cap" />
              <Bar dataKey="mid_cap"   stackId="a" fill="#eab308" name="Mid Cap" />
              <Bar dataKey="small_cap" stackId="a" fill="#a855f7" name="Small Cap" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Company list */}
      <div className="card">
        <h2 className="section-title">Companies</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>NSE</th>
                <th>Rank</th>
                <th>Category</th>
                <th>Stability</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const summary = c.company_ladder_summary?.[0];
                return (
                  <tr key={c.isin}>
                    <td>
                      <Link
                        href={`/company/${c.isin}`}
                        className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                      >
                        {c.companies?.company_name ?? c.company_name_raw ?? c.isin}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-slate-400">
                      {c.companies?.nse_symbol ?? '—'}
                    </td>
                    <td className="font-mono text-slate-300 font-semibold text-xs">
                      {c.market_cap_rank ? `#${c.market_cap_rank}` : '—'}
                    </td>
                    <td><CategoryBadge category={c.category} size="sm" /></td>
                    <td><StabilityBadge status={summary?.stability_status} size="sm" /></td>
                    <td className="text-xs text-slate-400">{summary?.trend_label ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
