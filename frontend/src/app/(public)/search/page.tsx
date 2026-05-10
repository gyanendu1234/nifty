'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, X, ExternalLink } from 'lucide-react';
import { getCompanies, getCompany } from '@/lib/api';
import { CompanyDetail } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { StabilityBadge } from '@/components/ui/StabilityBadge';
import { RankHistoryChart } from '@/components/charts/RankHistoryChart';
import { PageLoader } from '@/components/ui/LoadingSpinner';

type Suggest = {
  isin: string;
  company_name: string | null;
  nse_symbol: string | null;
};

const RECENT_KEY = 'nifty:search:recent';
const RECENT_MAX = 6;

function loadRecent(): Suggest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Suggest[]) : [];
  } catch { return []; }
}
function saveRecent(list: Suggest[]) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch {}
}

export default function SearchPage() {
  const [query, setQuery]               = useState('');
  const [suggest, setSuggest]           = useState<Suggest[]>([]);
  const [open, setOpen]                 = useState(false);
  const [highlight, setHighlight]       = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedIsin, setSelectedIsin] = useState<string | null>(null);
  const [company, setCompany]           = useState<CompanyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const [recent, setRecent]             = useState<Suggest[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load recent on mount
  useEffect(() => { setRecent(loadRecent()); }, []);

  // Autofocus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced fetch suggestions
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setSuggest([]); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await getCompanies({ search: q, limit: 10 });
        const rows = (res.data ?? []).map((c) => ({
          isin: c.isin,
          company_name: c.company_name,
          nse_symbol: c.nse_symbol,
        }));
        setSuggest(rows);
        setHighlight(0);
      } catch {
        setSuggest([]);
      } finally {
        setSearchLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside closes dropdown
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Fetch detail when an ISIN is selected
  useEffect(() => {
    if (!selectedIsin) return;
    setLoadingDetail(true);
    setError(null);
    getCompany(selectedIsin.toUpperCase())
      .then(setCompany)
      .catch(e => setError(e.message ?? 'Failed to load company'))
      .finally(() => setLoadingDetail(false));
  }, [selectedIsin]);

  function pick(s: Suggest) {
    setSelectedIsin(s.isin);
    setQuery(s.company_name ?? s.isin);
    setOpen(false);
    // Save to recent (dedupe)
    setRecent(prev => {
      const next = [s, ...prev.filter(r => r.isin !== s.isin)].slice(0, RECENT_MAX);
      saveRecent(next);
      return next;
    });
  }

  function clearAll() {
    setQuery('');
    setSelectedIsin(null);
    setCompany(null);
    setSuggest([]);
    setError(null);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggest.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggest.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + suggest.length) % suggest.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggest[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const summary = useMemo(() => company?.company_ladder_summary?.[0], [company]);
  const latest  = useMemo(() => company?.timeline?.[company.timeline.length - 1], [company]);
  const start   = useMemo(() => company?.timeline?.[0], [company]);
  const netRankChange = (start && latest)
    ? (start.market_cap_rank ?? 0) - (latest.market_cap_rank ?? 0)
    : null;

  return (
    <div className="space-y-5 anim-fade-up">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <SearchIcon className="w-6 h-6 text-pink-400" />
          Search Company
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Type a company name, NSE symbol, or ISIN to see its full rank trajectory across all half-yearly periods.
        </p>
      </div>

      {/* Search input */}
      <div ref={wrapperRef} className="relative max-w-2xl">
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(148,163,184,0.18)',
            boxShadow: open ? '0 0 0 3px rgba(244,114,182,0.18)' : 'none',
            transition: 'box-shadow 150ms ease',
          }}
        >
          <SearchIcon className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. Reliance, INFY, INE002A01018…"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none"
          />
          {query && (
            <button onClick={clearAll} className="cursor-pointer text-slate-500 hover:text-slate-200 transition-colors" aria-label="Clear">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (query.trim() ? suggest.length > 0 || searchLoading : recent.length > 0) && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-30"
            style={{
              background: 'rgba(10,14,26,0.98)',
              border: '1px solid rgba(148,163,184,0.18)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(14px)',
            }}
          >
            {!query.trim() && recent.length > 0 && (
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800/60">
                Recent
              </div>
            )}
            {searchLoading && suggest.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-500">Searching…</div>
            )}
            {(query.trim() ? suggest : recent).map((s, i) => {
              const isHighlighted = query.trim() && i === highlight;
              return (
                <button
                  key={s.isin}
                  onMouseDown={e => { e.preventDefault(); pick(s); }}
                  onMouseEnter={() => query.trim() && setHighlight(i)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                  style={{
                    background: isHighlighted ? 'rgba(244,114,182,0.12)' : 'transparent',
                    borderBottom: '1px solid rgba(148,163,184,0.06)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 truncate">{s.company_name ?? s.isin}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {s.nse_symbol ?? '—'} · {s.isin}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">↵</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Initial empty state */}
      {!selectedIsin && !loadingDetail && (
        <div className="card-glass p-10 flex flex-col items-center text-center space-y-2 anim-fade-in">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(244,114,182,0.15) 0%, rgba(244,114,182,0.05) 100%)',
              border: '1px solid rgba(244,114,182,0.25)',
            }}
          >
            <SearchIcon className="w-7 h-7 text-pink-400" />
          </div>
          <p className="text-slate-300">Pick a company to see its rank journey.</p>
          <p className="text-xs text-slate-500">All 12 half-yearly periods · category transitions highlighted</p>
        </div>
      )}

      {/* Loading detail */}
      {loadingDetail && <PageLoader />}

      {/* Error */}
      {error && (
        <div className="card-glass p-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Company result */}
      {company && !loadingDetail && (
        <div className="space-y-4 anim-fade-in">

          {/* Summary card */}
          <div className="card-glass p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-100 leading-tight">
                  {company.company_name ?? company.isin}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                  <span className="font-mono">{company.isin}</span>
                  {company.nse_symbol && (
                    <span className="bg-slate-800/70 px-2 py-0.5 rounded font-mono text-slate-300">
                      NSE: {company.nse_symbol}
                    </span>
                  )}
                  {company.bse_symbol && (
                    <span className="bg-slate-800/70 px-2 py-0.5 rounded font-mono text-slate-300">
                      BSE: {company.bse_symbol}
                    </span>
                  )}
                  <Link
                    href={`/company/${company.isin}`}
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Full page <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* KPI strip */}
              <div className="flex flex-wrap gap-2">
                {latest?.category && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}>
                    <p className="text-[10px] uppercase text-slate-500 tracking-wider">Current</p>
                    <div className="mt-1"><CategoryBadge category={latest.category} /></div>
                  </div>
                )}
                {latest?.market_cap_rank != null && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}>
                    <p className="text-[10px] uppercase text-slate-500 tracking-wider">Latest Rank</p>
                    <p className="text-lg font-bold text-slate-100 font-mono tabular-nums">#{latest.market_cap_rank}</p>
                  </div>
                )}
                {netRankChange != null && (
                  <div className="rounded-lg px-3 py-2" style={{
                    background: netRankChange > 0 ? 'rgba(34,197,94,0.1)' : netRankChange < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.06)',
                    border: '1px solid ' + (netRankChange > 0 ? 'rgba(34,197,94,0.25)' : netRankChange < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.12)'),
                  }}>
                    <p className="text-[10px] uppercase text-slate-500 tracking-wider">Net Move</p>
                    <p className={`text-lg font-bold font-mono tabular-nums ${
                      netRankChange > 0 ? 'text-green-400' : netRankChange < 0 ? 'text-red-400' : 'text-slate-300'
                    }`}>
                      {netRankChange > 0 ? '↑' : netRankChange < 0 ? '↓' : '·'} {Math.abs(netRankChange)}
                    </p>
                  </div>
                )}
                {summary?.ladder_score != null && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.12)' }}>
                    <p className="text-[10px] uppercase text-slate-500 tracking-wider">Score</p>
                    <p className="text-lg font-bold text-blue-400 tabular-nums">{summary.ladder_score}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Trend / Stability badges */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/60">
              {summary?.trend_label && (
                <span className="px-2.5 py-1 rounded-md text-xs bg-slate-800/70 text-slate-300 border border-slate-700/50">
                  {summary.trend_label}
                </span>
              )}
              {summary?.stability_status && <StabilityBadge status={summary.stability_status} />}
              {summary?.movement_path && (
                <span className="text-xs text-slate-500 font-mono">{summary.movement_path}</span>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="card-glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">Rank progression</h3>
              <p className="text-xs text-slate-500">Lower # = better · {company.timeline.length} periods</p>
            </div>
            <RankHistoryChart timeline={company.timeline} />
          </div>

          {/* Period table */}
          <div className="card-glass p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Period-by-period</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500 tracking-wider">
                    <th className="text-left py-2 pr-4">Period</th>
                    <th className="text-left py-2 pr-4">Category</th>
                    <th className="text-right py-2 pr-4">Rank</th>
                    <th className="text-right py-2">Move</th>
                  </tr>
                </thead>
                <tbody>
                  {company.timeline.map((t, i) => {
                    const prev = i > 0 ? company.timeline[i - 1] : null;
                    const move = prev ? (prev.market_cap_rank ?? 0) - (t.market_cap_rank ?? 0) : null;
                    return (
                      <tr key={t.period_label} className="border-t border-slate-800/40">
                        <td className="py-2 pr-4 text-slate-300">{t.period_label}</td>
                        <td className="py-2 pr-4"><CategoryBadge category={t.category} size="sm" /></td>
                        <td className="py-2 pr-4 text-right font-mono tabular-nums text-slate-200">#{t.market_cap_rank}</td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {move == null ? <span className="text-slate-600">—</span>
                            : move > 0 ? <span className="text-green-400">↑{move}</span>
                            : move < 0 ? <span className="text-red-400">↓{Math.abs(move)}</span>
                            : <span className="text-slate-500">0</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
