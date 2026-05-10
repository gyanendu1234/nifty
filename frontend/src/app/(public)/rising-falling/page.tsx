'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { getTrends } from '@/lib/api';
import { TrendRow, TrendPeriod } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import {
  ChevronLeft, ChevronRight, Minus, ArrowUp, ArrowDown,
  BarChart2, TableIcon, TrendingUp, Check,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const LINE_COLORS = [
  '#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6',
  '#14b8a6','#f97316','#06b6d4','#a3e635','#e879f9',
  '#fb923c','#34d399','#60a5fa','#fbbf24','#c084fc',
  '#2dd4bf','#f472b6','#4ade80','#38bdf8','#facc15',
];

type Direction = 'all' | 'improving' | 'declining';
type Tab = 'table' | 'chart';

const CAP_OPTS: { label: string; value: string }[] = [
  { label: 'All',       value: '' },
  { label: 'Large Cap', value: 'Large Cap' },
  { label: 'Mid Cap',   value: 'Mid Cap' },
  { label: 'Small Cap', value: 'Small Cap' },
];

const MIN_CHANGE_OPTS = [
  { label: 'Any', value: 0 },
  { label: '±10', value: 10 },
  { label: '±25', value: 25 },
  { label: '±50', value: 50 },
  { label: '±100', value: 100 },
];

const PERIOD_OPTS = [4, 6, 8] as const;
const LIMIT       = 100;

// ── Category cell styles ──────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Large Cap': { bg: 'rgba(34,197,94,0.10)',  text: '#4ade80', border: 'rgba(34,197,94,0.25)'  },
  'Mid Cap':   { bg: 'rgba(234,179,8,0.10)',  text: '#facc15', border: 'rgba(234,179,8,0.25)'  },
  'Small Cap': { bg: 'rgba(168,85,247,0.10)', text: '#c084fc', border: 'rgba(168,85,247,0.25)' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TrackBar({ improved, declined, stable }: { improved: number; declined: number; stable: number }) {
  const total = improved + declined + stable || 1;
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 64 }}>
      <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px">
        <div className="rounded-l-full"
          style={{ width: `${(improved / total) * 100}%`, background: 'rgba(34,197,94,0.7)' }}
          title={`${improved} improved`}
        />
        <div style={{ width: `${(stable / total) * 100}%`, background: 'rgba(148,163,184,0.25)' }}
          title={`${stable} stable`}
        />
        <div className="rounded-r-full"
          style={{ width: `${(declined / total) * 100}%`, background: 'rgba(239,68,68,0.7)' }}
          title={`${declined} declined`}
        />
      </div>
      <span className="text-[9px] text-slate-600 tabular-nums">
        {improved}↑ {stable}— {declined}↓
      </span>
    </div>
  );
}

function RankCell({ rank, category }: { rank: number | null; category: string | null }) {
  if (rank === null) return (
    <td className="text-center px-2 py-2"><span className="text-slate-700 text-xs">—</span></td>
  );
  const style = CAT_STYLE[category ?? ''] ?? { bg: 'rgba(100,116,139,0.08)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)' };
  return (
    <td className="text-center px-1.5 py-2">
      <span
        className="inline-block font-mono text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded"
        style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
      >
        {rank}
      </span>
    </td>
  );
}

function NetChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-slate-600">—</span>;
  if (change === 0) return (
    <span className="inline-flex items-center gap-0.5 text-slate-500 font-mono text-xs font-semibold">
      <Minus className="w-3 h-3" />0
    </span>
  );
  const rising = change > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-sm font-bold tabular-nums"
      style={{ color: rising ? '#4ade80' : '#f87171' }}
    >
      {rising ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
      {Math.abs(change)}
    </span>
  );
}

function Pill({
  active, onClick, children, activeColor = '#3b82f6',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150"
      style={{
        background: active ? `${activeColor}22` : 'rgba(15,23,42,0.6)',
        border:     active ? `1px solid ${activeColor}55` : '1px solid rgba(148,163,184,0.12)',
        color:      active ? activeColor : '#64748b',
      }}
    >
      {children}
    </button>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

type TPayload = { name: string; value: number; color: string };

function TrendTooltip({
  active, payload, label, focusedLine,
}: {
  active?: boolean; payload?: TPayload[]; label?: string; focusedLine: string | null;
}) {
  if (!active || !payload?.length || !focusedLine) return null;
  const item = payload.find(p => p.name === focusedLine);
  if (!item || item.value == null) return null;

  return (
    <div
      className="rounded-xl text-xs"
      style={{
        background: 'rgba(10,14,26,0.97)',
        border: `1px solid ${item.color}50`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
        backdropFilter: 'blur(14px)',
        minWidth: 160,
      }}
    >
      <p className="text-slate-500 text-[10px] font-medium px-3 pt-2 pb-1.5 border-b border-slate-800">
        {label}
      </p>
      <div className="px-3 py-2.5" style={{ background: `${item.color}10` }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 flex-none" style={{ background: item.color }} />
          <span className="text-slate-200 font-semibold truncate">{item.name}</span>
        </div>
        <span className="font-mono font-bold text-white text-base pl-4.5 tabular-nums">#{item.value}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RankTrendsPage() {
  const [tab,        setTab]        = useState<Tab>('table');
  const [direction,  setDirection]  = useState<Direction>('all');
  const [category,   setCategory]   = useState('');
  const [minChange,  setMinChange]  = useState(0);
  const [nPeriods,   setNPeriods]   = useState(6);
  const [offset,     setOffset]     = useState(0);
  const [netSortDir, setNetSortDir] = useState<'desc' | 'asc'>('desc');

  // Chart state
  const [chartN,         setChartN]         = useState(5);
  const [activeChartIds, setActiveChartIds] = useState<Set<string>>(new Set());
  const [hoveredLine,    setHoveredLine]    = useState<string | null>(null);

  const [rows,    setRows]    = useState<TrendRow[]>([]);
  const [periods, setPeriods] = useState<TrendPeriod[]>([]);
  const [meta,    setMeta]    = useState({ total: 0, improved: 0, declined: 0, stable: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTrends({
        periods:    nPeriods,
        direction,
        min_change: minChange,
        category:   category || undefined,
        limit:      LIMIT,
        offset,
      });
      setRows(res.data);
      setPeriods(res.periods);
      setMeta(m => ({ ...m, ...res.meta }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [direction, category, minChange, nPeriods, offset]);

  useEffect(() => { load(); }, [load]);

  // Reset chart active ids whenever rows or chartN changes
  useEffect(() => {
    setActiveChartIds(new Set(rows.slice(0, chartN).map(r => r.company_id)));
  }, [rows, chartN]);

  const go = (fn: () => void) => { fn(); setOffset(0); };

  // Client-side sort for Net Move column
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a.net_rank_change ?? (netSortDir === 'desc' ? -Infinity : Infinity);
      const bv = b.net_rank_change ?? (netSortDir === 'desc' ? -Infinity : Infinity);
      return netSortDir === 'desc' ? bv - av : av - bv;
    });
  }, [rows, netSortDir]);

  const totalPages = Math.ceil(meta.total / LIMIT);
  const page       = Math.floor(offset / LIMIT) + 1;

  // Color map: company_id → color (stable across renders)
  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r, i) => m.set(r.company_id, LINE_COLORS[i % LINE_COLORS.length]));
    return m;
  }, [rows]);

  // Companies visible in chart
  const visibleChartRows = useMemo(
    () => rows.filter(r => activeChartIds.has(r.company_id)),
    [rows, activeChartIds],
  );

  // Recharts data: one point per period
  const chartData = useMemo(() => periods.map(p => {
    const point: Record<string, number | string> = { label: p.label };
    for (const row of visibleChartRows) {
      const rank = row.ranks[p.id]?.rank;
      if (rank != null) point[row.company_name ?? row.isin] = rank;
    }
    return point;
  }), [periods, visibleChartRows]);

  // Smart Y-axis: tight domain around actual data; sparse ticks in empty cap zones
  const chartYAxis = useMemo(() => {
    const allRanks = visibleChartRows
      .flatMap(r => Object.values(r.ranks).map(v => v.rank))
      .filter((r): r is number => r != null);
    if (!allRanks.length) {
      return { domain: [1, 300] as [number, number], ticks: [1, 50, 100, 150, 200, 250, 300] as number[] };
    }
    const minR = Math.min(...allRanks);
    const maxR = Math.max(...allRanks);
    const dataSpan = Math.max(maxR - minR, 1);
    const pad = Math.max(15, Math.round(dataSpan * 0.08));
    const domMin = Math.max(1, minR - pad);
    const domMax = maxR + pad;
    const step = dataSpan <= 80 ? 10 : dataSpan <= 150 ? 20 : dataSpan <= 300 ? 25 : dataSpan <= 500 ? 50 : 100;
    const tickSet = new Set<number>();
    // Always include cap zone boundaries if they fall within domain
    if (100 >= domMin && 100 <= domMax) tickSet.add(100);
    if (250 >= domMin && 250 <= domMax) tickSet.add(250);
    // Dense ticks across the data range
    const first = Math.ceil(domMin / step) * step;
    for (let t = first; t <= domMax; t += step) tickSet.add(t);
    return {
      domain: [domMin, domMax] as [number, number],
      ticks: Array.from(tickSet).sort((a, b) => a - b),
    };
  }, [visibleChartRows]);

  const toggleChartCompany = (id: string) => {
    setActiveChartIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 anim-fade-up">

      {/* ── Header ── */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-blue-400" />
          Rank Trends
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Rank progression for every company across the last {nPeriods} periods — no labels, just raw numbers.
          Positive net change = rank improved (number fell = better position).
        </p>
      </div>

      {/* ── Filters ── */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.1)' }}
      >
        {/* Row 1: direction + category */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider w-16 shrink-0">Direction</span>
            <div className="flex gap-1">
              <Pill active={direction === 'all'}       onClick={() => go(() => setDirection('all'))}       activeColor="#64748b">All</Pill>
              <Pill active={direction === 'improving'} onClick={() => go(() => setDirection('improving'))} activeColor="#22c55e">
                <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" />Improving</span>
              </Pill>
              <Pill active={direction === 'declining'} onClick={() => go(() => setDirection('declining'))} activeColor="#ef4444">
                <span className="flex items-center gap-1"><ArrowDown className="w-3 h-3" />Declining</span>
              </Pill>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider w-16 shrink-0">Category</span>
            <div className="flex gap-1">
              {CAP_OPTS.map(o => {
                const col = o.value === 'Large Cap' ? '#22c55e' : o.value === 'Mid Cap' ? '#eab308' : o.value === 'Small Cap' ? '#a855f7' : '#64748b';
                return (
                  <Pill key={o.value} active={category === o.value} onClick={() => go(() => setCategory(o.value))} activeColor={col}>
                    {o.label}
                  </Pill>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: min change + periods */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider w-16 shrink-0">Min move</span>
            <div className="flex gap-1">
              {MIN_CHANGE_OPTS.map(o => (
                <Pill key={o.value} active={minChange === o.value} onClick={() => go(() => setMinChange(o.value))} activeColor="#3b82f6">
                  {o.label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider w-16 shrink-0">Periods</span>
            <div className="flex gap-1">
              {PERIOD_OPTS.map(n => (
                <Pill key={n} active={nPeriods === n} onClick={() => go(() => setNPeriods(n))} activeColor="#6366f1">
                  Last {n}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Period legend ── */}
      {periods.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="uppercase tracking-wider text-slate-600">Periods shown →</span>
          {periods.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              <span className="font-mono text-slate-600">{i + 1}.</span>
              <span>{p.label}</span>
            </span>
          ))}
          <div className="flex items-center gap-3 ml-auto">
            {[
              { label: 'Large Cap', color: '#4ade80', bg: 'rgba(34,197,94,0.1)' },
              { label: 'Mid Cap',   color: '#facc15', bg: 'rgba(234,179,8,0.1)'  },
              { label: 'Small Cap', color: '#c084fc', bg: 'rgba(168,85,247,0.1)' },
            ].map(c => (
              <span key={c.label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `1px solid ${c.color}40` }} />
                <span style={{ color: c.color }}>{c.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.1)', width: 'fit-content' }}
      >
        <button
          onClick={() => setTab('table')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150"
          style={{
            background: tab === 'table' ? 'rgba(59,130,246,0.15)' : 'transparent',
            border:     tab === 'table' ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            color:      tab === 'table' ? '#93c5fd' : '#64748b',
          }}
        >
          <TableIcon className="w-3.5 h-3.5" />Table
        </button>
        <button
          onClick={() => setTab('chart')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150"
          style={{
            background: tab === 'chart' ? 'rgba(59,130,246,0.15)' : 'transparent',
            border:     tab === 'chart' ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            color:      tab === 'chart' ? '#93c5fd' : '#64748b',
          }}
        >
          <TrendingUp className="w-3.5 h-3.5" />Chart
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <PageLoader />
      ) : (
        <>
          {/* ─── Table tab ─────────────────────────────────────────────────────── */}
          {tab === 'table' && (
            <>
              <div className="table-container anim-fade-in overflow-x-auto">
                <table className="data-table" style={{ minWidth: `${600 + periods.length * 72}px` }}>
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th>Company</th>
                      <th className="text-center">Category</th>
                      {periods.map((p, i) => {
                        const parts = p.label.split(' ');
                        const mon   = (parts[0] ?? '').toUpperCase().slice(0, 3);
                        const yr    = parts[1] ?? '';
                        return (
                          <th key={p.id} className="text-center" style={{ minWidth: 66 }}>
                            <span className="block text-[10px] text-slate-500 font-medium">P{i + 1}</span>
                            <span className="block text-[11px] text-slate-300 font-semibold">{mon}</span>
                            <span className="block text-[10px] text-slate-500 font-normal">{yr}</span>
                          </th>
                        );
                      })}
                      <th
                        className="text-center cursor-pointer select-none hover:text-slate-200 transition-colors"
                        onClick={() => setNetSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                        title="Click to sort"
                      >
                        <span className="inline-flex items-center justify-center gap-1">
                          Net Move
                          {netSortDir === 'desc'
                            ? <ArrowDown className="w-3 h-3 text-blue-400" />
                            : <ArrowUp   className="w-3 h-3 text-blue-400" />}
                        </span>
                      </th>
                      <th className="text-center">Track Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, idx) => (
                      <tr key={row.isin} className="group">
                        <td className="text-slate-600 text-xs tabular-nums font-mono">
                          {offset + idx + 1}
                        </td>
                        <td>
                          <Link
                            href={`/company/${row.isin}`}
                            className="text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer block leading-tight"
                          >
                            {row.company_name ?? row.isin}
                          </Link>
                          {row.nse_symbol && (
                            <span className="text-slate-500 text-[10px] font-mono">{row.nse_symbol}</span>
                          )}
                        </td>
                        <td className="text-center">
                          <CategoryBadge category={row.current_category} size="sm" />
                        </td>
                        {periods.map(p => {
                          const slot = row.ranks[p.id] ?? { rank: null, category: null };
                          return <RankCell key={p.id} rank={slot.rank} category={slot.category} />;
                        })}
                        <td className="text-center">
                          <NetChangeBadge change={row.net_rank_change} />
                        </td>
                        <td className="text-center">
                          <TrackBar
                            improved={row.periods_improved}
                            declined={row.periods_declined}
                            stable={row.periods_stable}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedRows.length === 0 && (
                <div
                  className="rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3"
                  style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)' }}
                >
                  <BarChart2 className="w-10 h-10 text-slate-700" />
                  <p className="text-slate-400">No companies match the current filters.</p>
                  <p className="text-slate-600 text-sm">
                    Try lowering the min move threshold or widening the category or direction filter.
                  </p>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 text-xs">
                  {meta.total.toLocaleString()} companies · page {page} of {totalPages || 1}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                      className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />Prev
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setOffset(o => o + LIMIT)}
                      className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-40"
                    >
                      Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── Chart tab ──────────────────────────────────────────────────────── */}
          {tab === 'chart' && (
            <div className="space-y-4 anim-fade-in">
              {/* Company selector */}
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Companies
                    <span className="ml-2 font-normal text-slate-500 normal-case">
                      {activeChartIds.size} visible
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500">Show top</span>
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45].map(n => (
                      <button
                        key={n}
                        onClick={() => setChartN(n)}
                        className="px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition-all"
                        style={{
                          background: chartN === n ? 'rgba(99,102,241,0.2)' : 'rgba(148,163,184,0.06)',
                          border:     chartN === n ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(148,163,184,0.1)',
                          color:      chartN === n ? '#a5b4fc' : '#64748b',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto">
                  {rows.slice(0, chartN).map(row => {
                    const active = activeChartIds.has(row.company_id);
                    const color  = colorMap.get(row.company_id) ?? '#3b82f6';
                    return (
                      <div
                        key={row.company_id}
                        onClick={() => toggleChartCompany(row.company_id)}
                        className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                        style={{
                          background: active ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.02)',
                          border:     active ? `1px solid ${color}40` : '1px solid transparent',
                          opacity:    active ? 1 : 0.38,
                        }}
                      >
                        <button
                          onClick={e => { e.stopPropagation(); toggleChartCompany(row.company_id); }}
                          className="w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center cursor-pointer flex-none"
                          style={{ background: active ? color : 'transparent', border: `2px solid ${color}` }}
                        >
                          {active && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-slate-300 truncate leading-tight">
                            {row.company_name ?? row.isin}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <CategoryBadge category={row.current_category} size="sm" />
                            <span className="text-[9px] text-slate-500 font-mono tabular-nums">
                              #{row.latest_rank}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Line chart */}
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)' }}
              >
                {visibleChartRows.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                    No companies selected. Toggle companies above to show trends.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: Math.max(periods.length * 110 + 120, 480) }}>
                      <ResponsiveContainer width="100%" height={520}>
                        <LineChart data={chartData} margin={{ top: 10, right: 80, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.8)" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#334155' }}
                          />
                          <YAxis
                            reversed
                            domain={chartYAxis.domain}
                            ticks={chartYAxis.ticks}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={{ stroke: '#334155' }}
                            tickFormatter={v => `#${v}`}
                            width={44}
                          />
                          <Tooltip
                            content={(props) => (
                              <TrendTooltip
                                active={props.active}
                                payload={props.payload as TPayload[]}
                                label={props.label as string}
                                focusedLine={hoveredLine}
                              />
                            )}
                          />
                          <ReferenceArea y1={1}   y2={100}                fill="rgba(34,197,94,0.05)"  ifOverflow="hidden" />
                          <ReferenceArea y1={101} y2={250}                fill="rgba(234,179,8,0.04)"  ifOverflow="hidden" />
                          <ReferenceArea y1={251} y2={chartYAxis.domain[1]}  fill="rgba(168,85,247,0.04)" ifOverflow="hidden" />
                          <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5}
                            label={{ value: 'Large/Mid', position: 'insideTopRight', fontSize: 9, fill: '#22c55e' }} />
                          <ReferenceLine y={250} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5}
                            label={{ value: 'Mid/Small', position: 'insideTopRight', fontSize: 9, fill: '#eab308' }} />
                          {visibleChartRows.map(row => {
                            const name      = row.company_name ?? row.isin;
                            const color     = colorMap.get(row.company_id) ?? '#3b82f6';
                            const isFocused = hoveredLine === name;
                            const endLabel  = row.nse_symbol ?? (name.length > 10 ? name.slice(0, 10) + '…' : name);
                            return (
                              <Line
                                key={row.company_id}
                                type="monotone"
                                dataKey={name}
                                stroke={color}
                                strokeWidth={isFocused ? 4.5 : 2.5}
                                strokeOpacity={hoveredLine && !isFocused ? 0.15 : 1}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                dot={(props: any) => {
                                  const { cx, cy, index } = props;
                                  if (cx == null || cy == null) return <g key={`d${index ?? 'x'}`} />;
                                  const r = isFocused ? 5 : 3;
                                  return (
                                    <g key={`d${index}`}>
                                      <circle cx={cx} cy={cy} r={r} fill={color} strokeWidth={0} />
                                      {index === chartData.length - 1 && (
                                        <text x={cx + r + 5} y={cy + 4} fill={color} fontSize={9}
                                          fontWeight={isFocused ? 700 : 600}
                                          style={{ pointerEvents: 'none', userSelect: 'none' } as React.CSSProperties}>
                                          {endLabel}
                                        </text>
                                      )}
                                    </g>
                                  );
                                }}
                                activeDot={{ r: 8 }}
                                connectNulls
                                onMouseEnter={() => setHoveredLine(name)}
                                onMouseLeave={() => setHoveredLine(null)}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
