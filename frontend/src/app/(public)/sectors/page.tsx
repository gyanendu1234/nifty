'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSectors } from '@/lib/api';
import { SectorSummary } from '@/types';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function SectorBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-12 text-right font-mono ${color}`}>{count}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 w-8">{pct}%</span>
    </div>
  );
}

export default function SectorsPage() {
  const [data, setData]       = useState<SectorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSectors()
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Sector Trends</h1>
        <p className="text-sm text-slate-500 mt-1">
          Market-cap distribution and ladder movement by sector
        </p>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No sector data available" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map(s => (
            <Link
              key={s.sector_primary}
              href={`/sectors/${encodeURIComponent(s.sector_primary)}`}
              className="card hover:border-slate-600 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                  {s.sector_primary}
                </h3>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {s.total_companies}
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                <SectorBar label="L" count={s.large_cap_count} total={s.total_companies} color="text-green-400" />
                <SectorBar label="M" count={s.mid_cap_count}   total={s.total_companies} color="text-yellow-400" />
                <SectorBar label="S" count={s.small_cap_count} total={s.total_companies} color="text-purple-400" />
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>{s.moving_up} up</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-red-400">
                  <TrendingDown className="w-3 h-3" />
                  <span>{s.moving_down} down</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                  <span>{s.entering_large} entering L</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
