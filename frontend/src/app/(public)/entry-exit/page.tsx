'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getEntryExit, getPeriods } from '@/lib/api';
import { LadderMovement, NiftyPeriod } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { MovementBadge } from '@/components/ui/MovementBadge';
import { StabilityBadge } from '@/components/ui/StabilityBadge';
import { RankChangePill } from '@/components/ui/RankChangePill';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportToCsv } from '@/lib/utils';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';

type TabId = 'large-entry' | 'large-exit' | 'mid-entry' | 'mid-exit' | 'small-entry' | 'small-exit';

const TABS: { id: TabId; label: string; category: string; type: 'entry' | 'exit' }[] = [
  { id: 'large-entry', label: 'Large Cap Entry', category: 'Large Cap', type: 'entry' },
  { id: 'large-exit',  label: 'Large Cap Exit',  category: 'Large Cap', type: 'exit'  },
  { id: 'mid-entry',   label: 'Mid Cap Entry',   category: 'Mid Cap',   type: 'entry' },
  { id: 'mid-exit',    label: 'Mid Cap Exit',    category: 'Mid Cap',   type: 'exit'  },
  { id: 'small-entry', label: 'Small Cap Entry', category: 'Small Cap', type: 'entry' },
  { id: 'small-exit',  label: 'Small Cap Exit',  category: 'Small Cap', type: 'exit'  },
];

export default function EntryExitPage() {
  const [activeTab, setActiveTab] = useState<TabId>('large-entry');
  const [data, setData]           = useState<LadderMovement[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [periods, setPeriods]     = useState<NiftyPeriod[]>([]);
  const [selectedPeriod, setPeriod] = useState('');

  useEffect(() => {
    getPeriods().then(ps => {
      setPeriods(ps);
      if (ps[0]) setPeriod(ps[0].id);
    }).catch(() => {});
  }, []);

  const tab = TABS.find(t => t.id === activeTab)!;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEntryExit({
        period_id: selectedPeriod || undefined,
        category: tab.category,
        type: tab.type,
        limit: 200,
      });
      setData(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedPeriod, tab]);

  useEffect(() => { if (selectedPeriod || periods.length === 0) load(); }, [load, selectedPeriod, periods]);

  const handleExport = () => {
    const rows = data.map(m => ({
      company:          m.companies?.company_name ?? m.company_id,
      isin:             m.companies?.isin ?? '',
      nse:              m.companies?.nse_symbol ?? '',
      from_category:    m.from_category ?? 'New Listing',
      to_category:      m.to_category ?? '',
      from_rank:        m.from_rank ?? '',
      to_rank:          m.to_rank ?? '',
      rank_change:      m.rank_change ?? '',
      movement:         m.movement_type ?? '',
      from_period:      (m.from_period as { period_label?: string } | undefined)?.period_label ?? '',
      to_period:        (m.to_period as { period_label?: string } | undefined)?.period_label ?? '',
    }));
    exportToCsv(rows, `nifty-${activeTab}.csv`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Entry / Exit Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Companies changing market-cap categories</p>
      </div>

      {/* Period selector + tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={selectedPeriod}
          onChange={e => setPeriod(e.target.value)}
          className="select text-sm"
        >
          <option value="">Latest Period</option>
          {periods.map(p => (
            <option key={p.id} value={p.id}>{p.period_label}</option>
          ))}
        </select>

        <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm ml-auto">
          <Download className="w-3.5 h-3.5" />Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors border ${
              activeTab === t.id
                ? 'bg-blue-600/20 text-blue-400 border-blue-600/40'
                : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {t.type === 'entry'
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-500">{total} companies</p>
      )}

      {/* Table */}
      {loading ? (
        <PageLoader />
      ) : data.length === 0 ? (
        <EmptyState title={`No companies found for ${tab.label}`} />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Previous Category</th>
                <th>Current Category</th>
                <th>Prev Rank</th>
                <th>Curr Rank</th>
                <th>Rank Δ</th>
                <th>Movement</th>
                <th>Prev Period</th>
                <th>Curr Period</th>
                <th>Trend</th>
                <th>Stability</th>
              </tr>
            </thead>
            <tbody>
              {data.map(m => {
                const summary = m.company_ladder_summary?.[0];
                const fromP = m.from_period as { period_label?: string } | undefined;
                const toP   = m.to_period   as { period_label?: string } | undefined;
                return (
                  <tr key={m.id}>
                    <td>
                      <Link
                        href={`/company/${m.companies?.isin ?? ''}`}
                        className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                      >
                        {m.companies?.company_name ?? '—'}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono">
                        {m.companies?.nse_symbol ?? ''}
                      </div>
                    </td>
                    <td>
                      {m.from_category ? (
                        <CategoryBadge category={m.from_category as string} size="sm" />
                      ) : (
                        <span
                          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}
                        >
                          New Listing
                        </span>
                      )}
                    </td>
                    <td><CategoryBadge category={m.to_category as string} size="sm" /></td>
                    <td className="font-mono text-slate-400 text-xs">
                      {m.from_rank ? `#${m.from_rank}` : '—'}
                    </td>
                    <td className="font-mono text-slate-300 font-semibold text-xs">
                      {m.to_rank ? `#${m.to_rank}` : '—'}
                    </td>
                    <td><RankChangePill change={m.rank_change} /></td>
                    <td><MovementBadge movementType={m.movement_type} /></td>
                    <td className="text-xs text-slate-500">{fromP?.period_label ?? '—'}</td>
                    <td className="text-xs text-slate-400">{toP?.period_label ?? '—'}</td>
                    <td className="text-xs text-slate-400">{summary?.trend_label ?? '—'}</td>
                    <td><StabilityBadge status={summary?.stability_status} size="sm" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
