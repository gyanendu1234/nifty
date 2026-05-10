'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getPeriods, getCompare } from '@/lib/api';
import { NiftyPeriod, CompareRow, ComparePeriod } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import {
  GitCompare, TrendingUp, TrendingDown, Minus,
  BarChart2, TableIcon, Check, ArrowUp, ArrowDown,
  Search, X, Plus,
} from 'lucide-react';

const LINE_COLORS = [
  '#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6',
  '#14b8a6','#f97316','#06b6d4','#a3e635','#e879f9',
  '#fb923c','#34d399','#60a5fa','#fbbf24','#c084fc',
  '#2dd4bf','#f472b6','#4ade80','#38bdf8','#facc15',
];

const N_OPTIONS = [5, 10, 15, 20, 25, 30];
const PERIOD_OPTIONS = [4, 6, 8, 'all'] as const;
type PeriodCount = 4 | 6 | 8 | 'all';

type Tab = 'table' | 'chart';
type SelectionMode = 'top' | 'bottom';

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-600">—</span>;
  if (value > 0)
    return <span className="inline-flex items-center gap-0.5 text-green-400 font-semibold tabular-nums"><TrendingUp className="w-3 h-3" />+{value}</span>;
  if (value < 0)
    return <span className="inline-flex items-center gap-0.5 text-red-400 font-semibold tabular-nums"><TrendingDown className="w-3 h-3" />{value}</span>;
  return <span className="inline-flex items-center gap-0.5 text-slate-500 tabular-nums"><Minus className="w-3 h-3" />0</span>;
}

// ── Tooltip ──
type TPayload = { name: string; value: number; color: string; cy?: number };

function ChartTooltip({
  active, payload, label,
  focusedLine, periodMeta, rowsByName,
}: {
  active?: boolean;
  payload?: TPayload[];
  label?: string;
  focusedLine: string | null;
  periodMeta: ComparePeriod[];
  rowsByName: Map<string, CompareRow>;
}) {
  if (!active || !payload?.length) return null;

  const period = periodMeta.find(p => p.label === label);
  const valid  = payload.filter(p => p.value != null);
  if (!valid.length) return null;

  // When a line is directly hovered, show it prominently at top, rest compact below
  const focused = focusedLine ? valid.find(p => p.name === focusedLine) : null;
  const sorted  = [...valid].sort((a, b) => (a.value ?? 9999) - (b.value ?? 9999));

  return (
    <div
      className="rounded-xl text-xs"
      style={{
        background: 'rgba(10,14,26,0.97)',
        border: '1px solid rgba(148,163,184,0.18)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
        backdropFilter: 'blur(14px)',
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      {/* Header */}
      <p className="text-slate-400 text-[10px] font-medium px-3 pt-2.5 pb-2 border-b border-slate-700/40">
        {label}
      </p>

      {/* Focused company — prominent */}
      {focused && (
        <div className="px-3 py-2 border-b border-slate-700/40" style={{ background: `${focused.color}12` }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: focused.color }} />
            <span className="text-slate-100 font-semibold truncate">{focused.name}</span>
          </div>
          <div className="pl-4 flex items-center gap-2">
            <span className="font-mono font-bold text-white text-sm">#{focused.value}</span>
            {period && rowsByName.get(focused.name)?.ranks[period.id]?.category && (
              <CategoryBadge category={rowsByName.get(focused.name)!.ranks[period.id].category} size="sm" />
            )}
          </div>
        </div>
      )}

      {/* All companies at this period, sorted by rank */}
      <div className="px-2 py-1.5 space-y-0.5 max-h-52 overflow-y-auto">
        {sorted.map(item => {
          const isFocused = item.name === focusedLine;
          return (
            <div
              key={item.name}
              className="flex items-center gap-2 px-1.5 py-1 rounded-md"
              style={{ background: isFocused ? `${item.color}18` : 'transparent' }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              <span
                className="flex-1 truncate"
                style={{ color: isFocused ? '#f1f5f9' : '#94a3b8' }}
              >
                {item.name}
              </span>
              <span
                className="font-mono font-semibold tabular-nums shrink-0"
                style={{ color: isFocused ? '#fff' : '#cbd5e1' }}
              >
                #{item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Company selector + search panel ──
function CompanyPanel({
  allCandidates, displayedSet, pinnedIds, activeIds, lastPeriodId,
  searchQ, setSearchQ, searchOpen, setSearchOpen, searchResults, searchRef,
  toggleCompany, pinCompany, unpinCompany,
}: {
  allCandidates: CompareRow[];
  displayedSet: Set<string>;
  pinnedIds: Set<string>;
  activeIds: Set<string>;
  lastPeriodId: string | undefined;
  searchQ: string;
  setSearchQ: (v: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  searchResults: CompareRow[];
  searchRef: React.RefObject<HTMLDivElement>;
  toggleCompany: (id: string) => void;
  pinCompany: (row: CompareRow) => void;
  unpinCompany: (id: string) => void;
}) {
  return (
    <div className="card-glass p-4 space-y-3 anim-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Companies
          <span className="ml-2 font-normal text-slate-500 normal-case">
            {activeIds.size} / {allCandidates.length} visible
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = new Set(allCandidates.map(r => r.company_id));
              // trigger via a custom event isn't possible here; caller handles it
            }}
            className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
          >
            All
          </button>
        </div>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(148,163,184,0.06)',
            border: '1px solid rgba(148,163,184,0.15)',
          }}
        >
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search to add a company…"
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
          />
          {searchQ && (
            <button onClick={() => { setSearchQ(''); setSearchOpen(false); }} className="cursor-pointer">
              <X className="w-3 h-3 text-slate-500 hover:text-slate-300" />
            </button>
          )}
        </div>

        {searchOpen && searchQ && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30"
            style={{
              background: 'rgba(10,14,26,0.98)',
              border: '1px solid rgba(148,163,184,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {searchResults.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500 text-center">No additional companies found</p>
            ) : (
              searchResults.map(row => {
                const rank     = lastPeriodId ? row.ranks[lastPeriodId]?.rank : null;
                const isPinned = pinnedIds.has(row.company_id);
                return (
                  <button
                    key={row.company_id}
                    onClick={() => isPinned ? unpinCompany(row.company_id) : pinCompany(row)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs cursor-pointer transition-colors text-left"
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 truncate">{row.company_name ?? row.isin}</p>
                      {row.nse_symbol && <p className="text-slate-500 font-mono text-[10px]">{row.nse_symbol}</p>}
                    </div>
                    {rank != null && <span className="text-slate-400 font-mono text-[10px] shrink-0">#{rank}</span>}
                    <span className={isPinned ? 'text-red-400' : 'text-blue-400'}>
                      {isPinned ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Company grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 max-h-52 overflow-y-auto">
        {allCandidates.map((row, idx) => {
          const active   = activeIds.has(row.company_id);
          const color    = LINE_COLORS[idx % LINE_COLORS.length];
          const rank     = lastPeriodId ? row.ranks[lastPeriodId]?.rank : null;
          const isPinned = pinnedIds.has(row.company_id) && !displayedSet.has(row.company_id);
          return (
            <div
              key={row.company_id}
              className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg group transition-all duration-150"
              style={{
                background: active ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.02)',
                border:     active ? `1px solid ${color}40` : '1px solid transparent',
                opacity:    active ? 1 : 0.38,
              }}
            >
              <button
                onClick={() => toggleCompany(row.company_id)}
                className="w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center cursor-pointer flex-none transition-all"
                style={{
                  background: active ? color : 'transparent',
                  border: `2px solid ${color}`,
                }}
              >
                {active && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/company/${row.isin}`}
                  className="text-[10px] text-slate-300 hover:text-blue-300 cursor-pointer truncate block transition-colors leading-tight"
                  title={row.company_name ?? row.isin}
                >
                  {row.company_name ?? row.isin}
                </Link>
                {rank != null && <span className="text-[9px] text-slate-500 font-mono">#{rank}</span>}
              </div>
              {isPinned && (
                <button
                  onClick={e => { e.stopPropagation(); unpinCompany(row.company_id); }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(239,68,68,0.85)' }}
                  title="Remove"
                >
                  <X className="w-2 h-2 text-white" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──
export default function ComparePage() {
  const [periods, setPeriods]         = useState<NiftyPeriod[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [periodCount, setPeriodCount] = useState<PeriodCount>(4);
  const [category, setCategory]       = useState('');
  const [n, setN]                     = useState(10);
  const [selectionMode, setMode]      = useState<SelectionMode>('top');
  const [tab, setTab]                 = useState<Tab>('table');
  const [data, setData]               = useState<CompareRow[]>([]);
  const [periodMeta, setPeriodMeta]   = useState<ComparePeriod[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [activeIds, setActiveIds]     = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds]     = useState<Set<string>>(new Set());
  const [searchQ, setSearchQ]             = useState('');
  const [searchOpen, setSearchOpen]       = useState(false);
  const [searchResults, setSearchResults] = useState<CompareRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hoveredLine, setHoveredLine]     = useState<string | null>(null);
  const searchRef  = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load completed periods once
  useEffect(() => {
    getPeriods().then(p => {
      const done = p
        .filter(x => x.import_status === 'completed')
        .sort((a, b) => a.period_end_date.localeCompare(b.period_end_date));
      setPeriods(done);
    }).catch(() => {});
  }, []);

  // Update selected whenever periods list or periodCount changes
  useEffect(() => {
    if (periods.length === 0) return;
    const slice = periodCount === 'all' ? periods : periods.slice(-(periodCount as number));
    setSelected(new Set(slice.map(x => x.id)));
  }, [periods, periodCount]);

  const load = useCallback(async () => {
    if (selected.size < 1) { setData([]); return; }
    setLoading(true);
    try {
      const res = await getCompare({
        period_ids: Array.from(selected).join(','),
        category:   category || undefined,
        limit:      200,
        offset:     0,
      });
      setData(res.data);
      setPeriodMeta(res.periods);
      setTotal(res.meta.total);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selected, category]);

  useEffect(() => { load(); }, [load]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchRef]);

  const lastPeriodId = periodMeta[periodMeta.length - 1]?.id;

  const sortedData = useMemo(() => {
    if (!lastPeriodId) return data;
    return [...data].sort(
      (a, b) => (a.ranks[lastPeriodId]?.rank ?? 9999) - (b.ranks[lastPeriodId]?.rank ?? 9999)
    );
  }, [data, lastPeriodId]);

  const displayedData = useMemo(
    () => selectionMode === 'top' ? sortedData.slice(0, n) : sortedData.slice(-n),
    [sortedData, selectionMode, n]
  );

  const displayedSet = useMemo(
    () => new Set(displayedData.map(r => r.company_id)),
    [displayedData]
  );

  // Pinned rows: added via search, not overlapping with displayedData
  const pinnedRows = useMemo(
    () => data.filter(r => pinnedIds.has(r.company_id) && !displayedSet.has(r.company_id)),
    [data, pinnedIds, displayedSet]
  );

  const allCandidates = useMemo(
    () => [...displayedData, ...pinnedRows],
    [displayedData, pinnedRows]
  );

  // Reset active IDs when displayed slice changes; keep previously-pinned ones active
  useEffect(() => {
    setActiveIds(prev => {
      const next = new Set(displayedData.map(r => r.company_id));
      for (const id of prev) { if (pinnedIds.has(id)) next.add(id); }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedData]);

  const visibleRows = useMemo(
    () => allCandidates.filter(r => activeIds.has(r.company_id)),
    [allCandidates, activeIds]
  );

  const rowsByName = useMemo(() => {
    const m = new Map<string, CompareRow>();
    for (const r of allCandidates) m.set(r.company_name ?? r.isin, r);
    return m;
  }, [allCandidates]);

  // Debounced server-side search — finds ANY company, not just the loaded 200
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQ.trim() || selected.size === 0) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await getCompare({
          period_ids: Array.from(selected).join(','),
          search: searchQ.trim(),
          limit: 10,
        });
        // Merge new rows into data so they carry rank info when pinned
        setData(prev => {
          const existing = new Set(prev.map(r => r.company_id));
          const fresh = res.data.filter(r => !existing.has(r.company_id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        setSearchResults(res.data.filter(r => !displayedSet.has(r.company_id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ, selected]);

  const toggleCompany = useCallback((id: string) =>
    setActiveIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }), []);

  const pinCompany = useCallback((row: CompareRow) => {
    setPinnedIds(prev => new Set([...prev, row.company_id]));
    setActiveIds(prev => new Set([...prev, row.company_id]));
    setSearchQ('');
    setSearchOpen(false);
  }, []);

  const unpinCompany = useCallback((id: string) => {
    setPinnedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setActiveIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const selectAll  = useCallback(() => setActiveIds(new Set(allCandidates.map(r => r.company_id))), [allCandidates]);
  const selectNone = useCallback(() => setActiveIds(new Set()), []);

  const chartData = useMemo(() =>
    periodMeta.map(p => {
      const pt: Record<string, unknown> = { period: p.label };
      for (const row of visibleRows) {
        pt[row.company_name ?? row.isin] = row.ranks[p.id]?.rank ?? null;
      }
      return pt;
    }),
    [periodMeta, visibleRows]
  );

  const renderTooltip = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ active, payload, label }: any) => (
      <ChartTooltip
        active={active}
        payload={payload}
        label={label}
        focusedLine={hoveredLine}
        periodMeta={periodMeta}
        rowsByName={rowsByName}
      />
    ),
    [hoveredLine, periodMeta, rowsByName]
  );

  const hasTwoPlus = periodMeta.length >= 2;

  return (
    <div className="space-y-5 anim-fade-up">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-blue-400" />
          Multi-Period Compare
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {periodCount === 'all' ? periods.length : Math.min(periodCount, periods.length)} of {periods.length} periods · {total} companies tracked
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-5">

        {/* ── Left: controls ── */}
        <div className="space-y-4">
          <div className="card-glass p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Display</p>

            {/* Top / Bottom toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(148,163,184,0.15)' }}>
              {(['top', 'bottom'] as SelectionMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold cursor-pointer transition-all duration-150"
                  style={{
                    background: selectionMode === mode
                      ? mode === 'top' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'
                      : 'transparent',
                    color: selectionMode === mode
                      ? mode === 'top' ? '#4ade80' : '#f87171'
                      : '#64748b',
                    borderRight: mode === 'top' ? '1px solid rgba(148,163,184,0.15)' : 'none',
                  }}
                >
                  {mode === 'top' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {mode === 'top' ? 'Top' : 'Bottom'}
                </button>
              ))}
            </div>

            {/* N options */}
            <div className="grid grid-cols-3 gap-1.5">
              {N_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => setN(v)}
                  className="py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                  style={{
                    background: n === v ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.06)',
                    border:     n === v ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                    color:      n === v ? '#93c5fd' : '#64748b',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Category</label>
              <select
                className="select w-full text-sm"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                <option value="Large Cap">Large Cap</option>
                <option value="Mid Cap">Mid Cap</option>
                <option value="Small Cap">Small Cap</option>
              </select>
            </div>

            {/* Period count */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Periods</label>
              <div className="grid grid-cols-4 gap-1.5">
                {PERIOD_OPTIONS.map(v => (
                  <button
                    key={v}
                    onClick={() => setPeriodCount(v)}
                    className="py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                    style={{
                      background: periodCount === v ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.06)',
                      border:     periodCount === v ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                      color:      periodCount === v ? '#93c5fd' : '#64748b',
                    }}
                  >
                    {v === 'all' ? 'All' : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary stats */}
          {hasTwoPlus && !loading && visibleRows.length > 0 && (
            <div className="card-glass p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg p-2" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-green-400 font-semibold text-base tabular-nums">
                    {visibleRows.filter(r => (r.rank_delta ?? 0) > 0).length}
                  </p>
                  <p className="text-slate-400">Improved</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-red-400 font-semibold text-base tabular-nums">
                    {visibleRows.filter(r => (r.rank_delta ?? 0) < 0).length}
                  </p>
                  <p className="text-slate-400">Declined</p>
                </div>
                <div className="rounded-lg p-2 col-span-2" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.1)' }}>
                  <p className="text-slate-300 font-semibold text-base tabular-nums">{total}</p>
                  <p className="text-slate-400">Total tracked</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: results ── */}
        <div className="space-y-4 min-w-0">
          {/* Tab switcher */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg w-fit"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.1)' }}
          >
            {([['table', TableIcon, 'Table'], ['chart', BarChart2, 'Trend Chart']] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                style={{
                  background: tab === id ? 'rgba(59,130,246,0.2)' : 'transparent',
                  border:     tab === id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  color:      tab === id ? '#93c5fd' : '#64748b',
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {loading && <PageLoader />}

          {/* TABLE TAB */}
          {!loading && visibleRows.length > 0 && tab === 'table' && (
            <div className="table-container anim-fade-in">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-slate-800/70 z-10">Company</th>
                    {periodMeta.map(p => (
                      <th key={p.id} className="text-center whitespace-nowrap">{p.label}</th>
                    ))}
                    {hasTwoPlus && <th className="text-center">Δ</th>}
                    <th>Journey</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, i) => (
                    <tr key={row.isin}>
                      <td
                        className="sticky left-0 z-10"
                        style={{ background: i % 2 === 0 ? 'rgba(15,23,42,0.95)' : 'rgba(22,30,49,0.95)' }}
                      >
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
                      {periodMeta.map(p => {
                        const entry = row.ranks[p.id];
                        return (
                          <td key={p.id} className="text-center">
                            {entry ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-mono font-semibold text-slate-200 tabular-nums">#{entry.rank}</span>
                                <CategoryBadge category={entry.category} size="sm" />
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">n/a</span>
                            )}
                          </td>
                        );
                      })}
                      {hasTwoPlus && (
                        <td className="text-center"><Delta value={row.rank_delta} /></td>
                      )}
                      <td>
                        <span className="text-slate-400 text-xs">{row.movement_path ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CHART TAB */}
          {!loading && chartData.length > 0 && tab === 'chart' && (
            <div className="card-glass anim-fade-in p-5" style={{ minHeight: 480 }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-200">
                  Rank progression —{' '}
                  <span style={{ color: selectionMode === 'top' ? '#4ade80' : '#f87171' }}>
                    {selectionMode === 'top' ? 'Top' : 'Bottom'} {n}
                  </span>
                  {visibleRows.length < allCandidates.length && (
                    <span className="text-slate-500 font-normal ml-1">({visibleRows.length} visible)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">Lower # = better</p>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                    tickLine={false}
                  />
                  <YAxis
                    reversed
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                    tickLine={false}
                    tickFormatter={v => `#${v}`}
                    width={44}
                  />
                  <ReferenceLine y={100} stroke="rgba(34,197,94,0.3)" strokeDasharray="4 3"
                    label={{ value: 'Large/Mid', fill: '#4ade80', fontSize: 10, position: 'insideTopLeft' }} />
                  <ReferenceLine y={250} stroke="rgba(168,85,247,0.3)" strokeDasharray="4 3"
                    label={{ value: 'Mid/Small', fill: '#c084fc', fontSize: 10, position: 'insideTopLeft' }} />
                  <Tooltip content={renderTooltip} />
                  {visibleRows.map(row => {
                    const idx    = allCandidates.findIndex(d => d.company_id === row.company_id);
                    const color  = LINE_COLORS[idx % LINE_COLORS.length];
                    const name   = row.company_name ?? row.isin;
                    const active = hoveredLine === null || hoveredLine === name;
                    return (
                      <Line
                        key={row.isin}
                        type="monotone"
                        dataKey={name}
                        stroke={color}
                        strokeWidth={hoveredLine === name ? 3 : hoveredLine ? 1 : 2}
                        strokeOpacity={active ? 1 : 0.2}
                        dot={{ r: hoveredLine === name ? 5 : 3, strokeWidth: 0, fill: color }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: '#0f172a', fill: color }}
                        connectNulls
                        onMouseEnter={() => setHoveredLine(name)}
                        onMouseLeave={() => setHoveredLine(null)}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Company selector — below chart/table */}
          {!loading && allCandidates.length > 0 && (
            <div className="card-glass p-4 space-y-3 anim-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Companies
                  <span className="ml-2 font-normal text-slate-500 normal-case">
                    {activeIds.size} / {allCandidates.length} visible
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll}  className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">All</button>
                  <span className="text-slate-700">·</span>
                  <button onClick={selectNone} className="text-[10px] text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">None</button>
                </div>
              </div>

              {/* Search to add */}
              <div ref={searchRef} className="relative">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)' }}
                >
                  <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search to add a company…"
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
                  />
                  {searchQ && (
                    <button onClick={() => { setSearchQ(''); setSearchOpen(false); }} className="cursor-pointer">
                      <X className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                    </button>
                  )}
                </div>
                {searchOpen && searchQ && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30"
                    style={{
                      background: 'rgba(10,14,26,0.98)',
                      border: '1px solid rgba(148,163,184,0.15)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    }}
                  >
                    {searchLoading ? (
                      <p className="px-3 py-3 text-xs text-slate-500 text-center">Searching…</p>
                    ) : searchResults.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-500 text-center">No companies found</p>
                    ) : (
                      searchResults.map(row => {
                        const rank     = lastPeriodId ? row.ranks[lastPeriodId]?.rank : null;
                        const isPinned = pinnedIds.has(row.company_id);
                        return (
                          <button
                            key={row.company_id}
                            onClick={() => isPinned ? unpinCompany(row.company_id) : pinCompany(row)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs cursor-pointer transition-colors text-left"
                            style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.1)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-200 truncate">{row.company_name ?? row.isin}</p>
                              {row.nse_symbol && (
                                <p className="text-slate-500 font-mono text-[10px]">{row.nse_symbol}</p>
                              )}
                            </div>
                            {rank != null && (
                              <span className="text-slate-400 font-mono text-[10px] shrink-0">#{rank}</span>
                            )}
                            <span className={isPinned ? 'text-red-400' : 'text-blue-400'}>
                              {isPinned ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Company chips grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 max-h-52 overflow-y-auto">
                {allCandidates.map((row, idx) => {
                  const active   = activeIds.has(row.company_id);
                  const color    = LINE_COLORS[idx % LINE_COLORS.length];
                  const rank     = lastPeriodId ? row.ranks[lastPeriodId]?.rank : null;
                  const isPinned = pinnedIds.has(row.company_id) && !displayedSet.has(row.company_id);
                  return (
                    <div
                      key={row.company_id}
                      className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg group transition-all duration-150"
                      style={{
                        background: active ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.02)',
                        border:     active ? `1px solid ${color}40` : '1px solid transparent',
                        opacity:    active ? 1 : 0.38,
                      }}
                    >
                      <button
                        onClick={() => toggleCompany(row.company_id)}
                        className="w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center cursor-pointer flex-none transition-all"
                        style={{
                          background: active ? color : 'transparent',
                          border: `2px solid ${color}`,
                        }}
                      >
                        {active && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/company/${row.isin}`}
                          className="text-[10px] text-slate-300 hover:text-blue-300 cursor-pointer truncate block transition-colors leading-tight"
                          title={row.company_name ?? row.isin}
                        >
                          {row.company_name ?? row.isin}
                        </Link>
                        {rank != null && <span className="text-[9px] text-slate-500 font-mono">#{rank}</span>}
                      </div>
                      {isPinned && (
                        <button
                          onClick={e => { e.stopPropagation(); unpinCompany(row.company_id); }}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(239,68,68,0.85)' }}
                          title="Remove"
                        >
                          <X className="w-2 h-2 text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && visibleRows.length === 0 && allCandidates.length > 0 && (
            <div className="card-glass flex flex-col items-center justify-center py-12 text-center space-y-2">
              <GitCompare className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400">All companies hidden — use the panel below to select some</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
