'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown,
  Search, ChevronUp, ChevronDown, Clock,
} from 'lucide-react';
import { getNseLive } from '@/lib/api';
import { NseIndexData, NseStock } from '@/types';

const INDEX_GROUPS = [
  {
    label: 'Broad Market',
    indices: [
      { key: 'NIFTY 50',              label: 'NIFTY 50'              },
      { key: 'NIFTY NEXT 50',         label: 'NIFTY Next 50'         },
      { key: 'NIFTY 100',             label: 'NIFTY 100'             },
      { key: 'NIFTY 200',             label: 'NIFTY 200'             },
      { key: 'NIFTY 500',             label: 'NIFTY 500'             },
      { key: 'NIFTY MIDCAP 50',       label: 'NIFTY MidCap 50'       },
      { key: 'NIFTY MIDCAP 100',      label: 'NIFTY MidCap 100'      },
      { key: 'NIFTY MIDCAP 150',      label: 'NIFTY MidCap 150'      },
      { key: 'NIFTY SMLCAP 50',       label: 'NIFTY SmallCap 50'     },
      { key: 'NIFTY SMLCAP 100',      label: 'NIFTY SmallCap 100'    },
      { key: 'NIFTY SMLCAP 250',      label: 'NIFTY SmallCap 250'    },
      { key: 'NIFTY LARGEMIDCAP 250', label: 'NIFTY LargeMidCap 250' },
      { key: 'NIFTY MIDSMALLCAP 400', label: 'NIFTY MidSmallCap 400' },
    ],
  },
  {
    label: 'Sectoral',
    indices: [
      { key: 'NIFTY BANK',              label: 'NIFTY Bank'               },
      { key: 'NIFTY AUTO',              label: 'NIFTY Auto'               },
      { key: 'NIFTY IT',                label: 'NIFTY IT'                 },
      { key: 'NIFTY FMCG',              label: 'NIFTY FMCG'               },
      { key: 'NIFTY PHARMA',            label: 'NIFTY Pharma'             },
      { key: 'NIFTY METAL',             label: 'NIFTY Metal'              },
      { key: 'NIFTY MEDIA',             label: 'NIFTY Media'              },
      { key: 'NIFTY REALTY',            label: 'NIFTY Realty'             },
      { key: 'NIFTY PRIVATE BANK',      label: 'NIFTY Private Bank'       },
      { key: 'NIFTY PSU BANK',          label: 'NIFTY PSU Bank'           },
      { key: 'NIFTY FIN SERVICE',       label: 'NIFTY Financial Services' },
      { key: 'NIFTY OIL AND GAS',       label: 'NIFTY Oil & Gas'          },
      { key: 'NIFTY CONSUMER DURABLES', label: 'NIFTY Consumer Durables'  },
    ],
  },
  {
    label: 'Thematic',
    indices: [
      { key: 'NIFTY CPSE',              label: 'NIFTY CPSE'              },
      { key: 'NIFTY ENERGY',            label: 'NIFTY Energy'            },
      { key: 'NIFTY INFRA',             label: 'NIFTY Infra'             },
      { key: 'NIFTY MNC',               label: 'NIFTY MNC'               },
      { key: 'NIFTY PSE',               label: 'NIFTY PSE'               },
      { key: 'NIFTY SERV SECTOR',       label: 'NIFTY Services Sector'   },
      { key: 'NIFTY INDIA CONSUMPTION', label: 'NIFTY India Consumption' },
      { key: 'NIFTY COMMODITIES',       label: 'NIFTY Commodities'       },
      { key: 'NIFTY SME EMERGE',        label: 'NIFTY SME Emerge'        },
    ],
  },
  {
    label: 'Factor / Strategy',
    indices: [
      { key: 'NIFTY50 EQUAL WEIGHT',            label: 'NIFTY50 Equal Weight'        },
      { key: 'NIFTY100 EQUAL WEIGHT',           label: 'NIFTY100 Equal Weight'       },
      { key: 'NIFTY ALPHA 50',                  label: 'NIFTY Alpha 50'              },
      { key: 'NIFTY HIGH BETA 50',              label: 'NIFTY High Beta 50'          },
      { key: 'NIFTY LOW VOLATILITY 50',         label: 'NIFTY Low Volatility 50'     },
      { key: 'NIFTY100 LOW VOLATILITY 30',      label: 'NIFTY100 Low Volatility 30'  },
      { key: 'NIFTY DIVIDEND OPPORTUNITIES 50', label: 'NIFTY Dividend Opps 50'      },
      { key: 'NIFTY200 QUALITY 30',             label: 'NIFTY200 Quality 30'         },
      { key: 'NIFTY100 QUALITY 30',             label: 'NIFTY100 Quality 30'         },
      { key: 'NIFTY500 VALUE 50',               label: 'NIFTY500 Value 50'           },
      { key: 'NIFTY100 ALPHA 30',               label: 'NIFTY100 Alpha 30'           },
      { key: 'NIFTY MIDCAP 150 QUALITY 50',     label: 'NIFTY MidCap 150 Quality 50' },
    ],
  },
];

type StatMode =
  | 'all'
  | 'gainers_today' | 'losers_today'
  | 'gainers_30d'   | 'losers_30d'
  | 'gainers_1y'    | 'losers_1y'
  | 'only_buyers'   | 'only_sellers'
  | 'most_active'   | 'near52h'      | 'near52l';

type SortKey = 'symbol' | 'lastPrice' | 'pChange' | 'totalTradedVolume' | 'perChange30d' | 'perChange365d';
type SortDir = 'asc' | 'desc';

const STAT_DEFAULTS: Record<StatMode, { sortKey: SortKey; sortDir: SortDir }> = {
  all:           { sortKey: 'pChange',           sortDir: 'desc' },
  gainers_today: { sortKey: 'pChange',           sortDir: 'desc' },
  losers_today:  { sortKey: 'pChange',           sortDir: 'asc'  },
  gainers_30d:   { sortKey: 'perChange30d',      sortDir: 'desc' },
  losers_30d:    { sortKey: 'perChange30d',      sortDir: 'asc'  },
  gainers_1y:    { sortKey: 'perChange365d',     sortDir: 'desc' },
  losers_1y:     { sortKey: 'perChange365d',     sortDir: 'asc'  },
  only_buyers:   { sortKey: 'pChange',           sortDir: 'desc' },
  only_sellers:  { sortKey: 'pChange',           sortDir: 'asc'  },
  most_active:   { sortKey: 'totalTradedVolume', sortDir: 'desc' },
  near52h:       { sortKey: 'pChange',           sortDir: 'desc' },
  near52l:       { sortKey: 'pChange',           sortDir: 'asc'  },
};

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtVol(v: number) {
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  return v.toLocaleString('en-IN');
}
function fmtTime(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
function rangePos(s: NseStock) {
  const r = s.yearHigh - s.yearLow;
  return r <= 0 ? 50 : Math.min(100, Math.max(0, ((s.lastPrice - s.yearLow) / r) * 100));
}
function fmtVal(v: number) {
  if (v >= 1e11) return `₹${(v / 1e11).toFixed(1)}KCr`;
  if (v >= 1e9)  return `₹${(v / 1e9).toFixed(1)}BCr`;
  if (v >= 1e7)  return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5)  return `₹${(v / 1e5).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}
function stockChartUrl(stock: NseStock, mode: StatMode): string | undefined {
  if (mode === 'gainers_30d' || mode === 'losers_30d') return stock.chart30dPath;
  if (mode === 'gainers_1y'  || mode === 'losers_1y')  return stock.chart365dPath;
  return stock.chartTodayPath;
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  right?: boolean;
}

function SortHeader({ label, sortKey, current, dir, onSort, right }: SortHeaderProps) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors duration-150 ${
        active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
      } ${right ? 'ml-auto' : ''}`}
    >
      {label}
      {active
        ? dir === 'desc'
          ? <ChevronDown className="w-3 h-3" />
          : <ChevronUp   className="w-3 h-3" />
        : <ChevronDown className="w-3 h-3 opacity-25" />}
    </button>
  );
}

export default function NseLivePage() {
  const [selectedIndex, setSelectedIndex] = useState('NIFTY 500');
  const [nseData,       setNseData]       = useState<NseIndexData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [cachedAt,      setCachedAt]      = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [statMode,      setStatMode]      = useState<StatMode>('all');
  const [industry,      setIndustry]      = useState('All');
  const [sortKey,       setSortKey]       = useState<SortKey>('pChange');
  const [sortDir,       setSortDir]       = useState<SortDir>('desc');
  const [countdown,     setCountdown]     = useState(300);

  const refreshTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNseLive(selectedIndex);
      setNseData(res.data);
      setCachedAt(res.cached_at);
      setCountdown(300);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch NSE data');
    } finally {
      setLoading(false);
    }
  }, [selectedIndex]);

  useEffect(() => {
    fetchData();
    refreshTimer.current = setInterval(fetchData, 5 * 60 * 1000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [fetchData]);

  useEffect(() => {
    countdownTimer.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => { if (countdownTimer.current) clearInterval(countdownTimer.current); };
  }, [cachedAt]);

  const allStocks = useMemo(
    () => (nseData?.data ?? []).filter(s => s.meta?.isin),
    [nseData],
  );

  const industries = useMemo(() => {
    const s = new Set<string>();
    allStocks.forEach(st => { if (st.meta?.industry) s.add(st.meta.industry); });
    return ['All', ...Array.from(s).sort()];
  }, [allStocks]);

  useEffect(() => setIndustry('All'), [selectedIndex]);

  const handleStatMode = (mode: StatMode) => {
    setStatMode(mode);
    const def = STAT_DEFAULTS[mode];
    setSortKey(def.sortKey);
    setSortDir(def.sortDir);
  };

  const filteredStocks = useMemo(() => {
    let list = allStocks;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.meta?.companyName?.toLowerCase().includes(q),
      );
    }

    switch (statMode) {
      case 'gainers_today': case 'only_buyers':  list = list.filter(s => s.pChange > 0);       break;
      case 'losers_today':  case 'only_sellers': list = list.filter(s => s.pChange < 0);       break;
      case 'gainers_30d':                        list = list.filter(s => s.perChange30d > 0);  break;
      case 'losers_30d':                         list = list.filter(s => s.perChange30d < 0);  break;
      case 'gainers_1y':                         list = list.filter(s => s.perChange365d > 0); break;
      case 'losers_1y':                          list = list.filter(s => s.perChange365d < 0); break;
      case 'near52h':                            list = list.filter(s => s.nearWKH <= 5);      break;
      case 'near52l':                            list = list.filter(s => s.nearWKL <= 5);      break;
    }

    if (industry !== 'All') list = list.filter(s => s.meta?.industry === industry);

    return [...list].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [allStocks, search, statMode, industry, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const meta      = nseData?.metadata;
  const breadth   = nseData?.advance;
  const mktStatus = nseData?.marketStatus;
  const isOpen    = mktStatus?.marketStatus === 'Open';

  const totalB  = breadth
    ? parseInt(breadth.advances) + parseInt(breadth.declines) + parseInt(breadth.unchanged)
    : 0;
  const advPct  = totalB > 0 ? (parseInt(breadth?.advances ?? '0') / totalB) * 100 : 0;
  const decPct  = totalB > 0 ? (parseInt(breadth?.declines ?? '0') / totalB) * 100 : 0;
  const unchPct = totalB > 0 ? (parseInt(breadth?.unchanged ?? '0') / totalB) * 100 : 0;

  const card = {
    background:  'rgba(15,23,42,0.85)',
    borderColor: 'rgba(148,163,184,0.08)',
    boxShadow:   '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
  };

  const selectCls = 'px-3 py-2 rounded-xl text-xs bg-slate-800/60 border border-slate-700/40 text-slate-300 focus:outline-none focus:border-cyan-600/60 transition-colors cursor-pointer';

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">NSE Live</h1>
          </div>
          <p className="text-slate-400 text-sm mt-0.5 pl-7">
            Real-time data from NSE India · 5-min cache
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{fmtTime(countdown)}</span>
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Stats cards ── */}
      {meta && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="md:col-span-2 p-5 rounded-2xl border" style={card}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    isOpen
                      ? 'bg-green-950/60 border border-green-800/40 text-green-400'
                      : 'bg-slate-800/60 border border-slate-700/40 text-slate-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                    {mktStatus?.marketStatus ?? 'Unknown'}
                  </span>
                  <span className="text-slate-500 text-xs">{mktStatus?.tradeDate}</span>
                </div>

                <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
                    {fmt(meta.last)}
                  </span>
                  <span className={`text-xl font-semibold ${meta.percChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {meta.percChange >= 0 ? '+' : ''}{meta.percChange.toFixed(2)}%
                  </span>
                  <span className={`text-sm ${meta.change >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    ({meta.change >= 0 ? '+' : ''}{fmt(meta.change)})
                  </span>
                </div>

                <p className="text-slate-500 text-xs mt-1.5">
                  {meta.indexName} · Prev close {fmt(meta.previousClose)}
                </p>
              </div>

              <div className="text-right text-xs space-y-1.5 shrink-0">
                <div className="text-slate-500">Open <span className="text-slate-300 font-medium">{fmt(meta.open)}</span></div>
                <div className="text-slate-500">High <span className="text-green-400 font-medium">{fmt(meta.high)}</span></div>
                <div className="text-slate-500">Low  <span className="text-red-400 font-medium">{fmt(meta.low)}</span></div>
              </div>
            </div>

            <p className="text-slate-700 text-[11px] mt-3">{nseData?.timestamp}</p>
          </div>

          <div className="p-5 rounded-2xl border" style={card}>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
              Market Breadth
            </p>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-green-400">{breadth?.advances} Advances</span>
                <span className="text-slate-500">{breadth?.unchanged} Unch</span>
                <span className="text-red-400">{breadth?.declines} Declines</span>
              </div>

              <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                <div
                  className="rounded-l-full transition-all duration-700"
                  style={{ width: `${advPct}%`, background: 'linear-gradient(90deg,#22c55e,#16a34a)' }}
                />
                <div style={{ width: `${unchPct}%`, background: '#334155' }} />
                <div
                  className="rounded-r-full transition-all duration-700"
                  style={{ width: `${decPct}%`, background: 'linear-gradient(90deg,#ef4444,#dc2626)' }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-600">
                <span>{advPct.toFixed(0)}%</span>
                <span>{decPct.toFixed(0)}%</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-500 mb-0.5">Visible</div>
                <div className="text-slate-200 font-semibold">{filteredStocks.length} stocks</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">As of</div>
                <div className="text-slate-200 font-semibold">
                  {cachedAt
                    ? new Date(cachedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Market Stats dropdown */}
        <select
          value={statMode}
          onChange={e => handleStatMode(e.target.value as StatMode)}
          className={selectCls}
        >
          <option value="all">All Stocks</option>
          <optgroup label="Gainers">
            <option value="gainers_today">Top Gainers Today</option>
            <option value="gainers_30d">Top Gainers 30d</option>
            <option value="gainers_1y">Top Gainers 1Y</option>
            <option value="only_buyers">Only Buyers</option>
          </optgroup>
          <optgroup label="Losers">
            <option value="losers_today">Top Losers Today</option>
            <option value="losers_30d">Top Losers 30d</option>
            <option value="losers_1y">Top Losers 1Y</option>
            <option value="only_sellers">Only Sellers</option>
          </optgroup>
          <optgroup label="Special">
            <option value="most_active">Most Active Stocks</option>
            <option value="near52h">Near 52W High</option>
            <option value="near52l">Near 52W Low</option>
          </optgroup>
        </select>

        {/* Index / Group dropdown */}
        <select
          value={selectedIndex}
          onChange={e => setSelectedIndex(e.target.value)}
          className={selectCls}
        >
          {INDEX_GROUPS.map(grp => (
            <optgroup key={grp.label} label={grp.label}>
              {grp.indices.map(idx => (
                <option key={idx.key} value={idx.key}>{idx.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol or company…"
            className="pl-9 pr-4 py-2 rounded-xl text-sm bg-slate-800/60 border border-slate-700/40 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-600/60 w-60 transition-colors"
          />
        </div>

        {/* Industry dropdown */}
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className={`${selectCls} max-w-[200px]`}
        >
          {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      {loading && !nseData ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
          <span className="text-sm">Fetching from NSE India…</span>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'rgba(10,14,26,0.9)', borderColor: 'rgba(148,163,184,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                  <th className="text-left px-4 py-3 w-10">
                    <span className="text-xs text-slate-600 font-medium">#</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Symbol" sortKey="symbol" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-slate-500 font-medium">Industry</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Price" sortKey="lastPrice" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Change %" sortKey="pChange" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  </th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">
                    <SortHeader label="Volume" sortKey="totalTradedVolume" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  </th>
                  <th className="text-center px-4 py-3 hidden xl:table-cell">
                    <span className="text-xs text-slate-500 font-medium">52W Range</span>
                  </th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">
                    <SortHeader label="30d %" sortKey="perChange30d" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  </th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">
                    <SortHeader label="1Y %" sortKey="perChange365d" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  </th>
                  <th className="text-center px-4 py-3 hidden 2xl:table-cell">
                    <span className="text-xs text-slate-500 font-medium">Trend</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-500 text-sm">
                      No stocks match the current filters.
                    </td>
                  </tr>
                ) : filteredStocks.map((stock, i) => {
                  const pos      = rangePos(stock);
                  const isGainer = stock.pChange > 0;
                  const isLoser  = stock.pChange < 0;
                  const dotColor = isGainer ? '#22c55e' : isLoser ? '#ef4444' : '#94a3b8';

                  return (
                    <tr
                      key={stock.identifier ?? stock.symbol}
                      className="border-t hover:bg-slate-800/25 transition-colors duration-100"
                      style={{ borderColor: 'rgba(148,163,184,0.04)' }}
                    >
                      <td className="px-4 py-3 text-xs text-slate-600 tabular-nums">{i + 1}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-100 text-sm leading-tight">{stock.symbol}</span>
                          {stock.meta?.isFNOSec && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/40 leading-none">F&O</span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate max-w-[160px] mt-0.5">
                          {stock.meta?.companyName}
                        </div>
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-[11px] text-slate-400 bg-slate-800/50 border border-slate-700/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {stock.meta?.industry ?? '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-slate-100 font-semibold text-sm">{fmt(stock.lastPrice)}</span>
                        <div className="text-slate-600 text-[11px]">
                          {fmt(stock.dayLow)} – {fmt(stock.dayHigh)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
                          isGainer ? 'bg-green-950/60 text-green-400'
                          : isLoser ? 'bg-red-950/60 text-red-400'
                          : 'bg-slate-800/60 text-slate-400'
                        }`}>
                          {isGainer ? <TrendingUp className="w-3 h-3" /> : isLoser ? <TrendingDown className="w-3 h-3" /> : null}
                          {stock.pChange >= 0 ? '+' : ''}{stock.pChange.toFixed(2)}%
                        </span>
                        <div className={`text-[11px] mt-0.5 tabular-nums ${
                          isGainer ? 'text-green-600' : isLoser ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {stock.change >= 0 ? '+' : ''}{fmt(stock.change)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-xs text-slate-400 hidden md:table-cell tabular-nums">
                        <div>{fmtVol(stock.totalTradedVolume)}</div>
                        {stock.totalTradedValue != null && (
                          <div className="text-slate-600 text-[11px] mt-0.5">{fmtVal(stock.totalTradedValue)}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 hidden xl:table-cell">
                        <div className="flex items-center gap-2 w-36 mx-auto">
                          <span className="text-[10px] text-slate-600 tabular-nums w-12 text-right">
                            {stock.yearLow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 relative overflow-visible">
                            <div className="absolute inset-0 rounded-full opacity-20"
                              style={{ background: 'linear-gradient(90deg,#ef4444,#eab308,#22c55e)' }} />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 transition-all duration-300"
                              style={{
                                left:        `calc(${pos}% - 5px)`,
                                background:   dotColor,
                                borderColor: 'rgba(10,14,26,0.9)',
                                boxShadow:   `0 0 6px ${dotColor}80`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-600 tabular-nums w-12">
                            {stock.yearHigh.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-center mt-1 gap-2 text-[10px] tabular-nums">
                          {stock.nearWKH <= 5 && (
                            <span className="text-green-500/80">▲ {stock.nearWKH.toFixed(1)}% to 52H</span>
                          )}
                          {stock.nearWKL <= 5 && (
                            <span className="text-red-500/80">▼ {stock.nearWKL.toFixed(1)}% to 52L</span>
                          )}
                          {stock.nearWKH > 5 && stock.nearWKL > 5 && (
                            <span className="text-slate-700">{pos.toFixed(0)}%</span>
                          )}
                        </div>
                      </td>

                      <td className={`px-4 py-3 text-right text-xs tabular-nums hidden lg:table-cell font-medium ${
                        stock.perChange30d > 0 ? 'text-green-400' : stock.perChange30d < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {stock.perChange30d >= 0 ? '+' : ''}{stock.perChange30d.toFixed(1)}%
                      </td>

                      <td className={`px-4 py-3 text-right text-xs tabular-nums hidden lg:table-cell font-medium ${
                        stock.perChange365d > 0 ? 'text-green-400' : stock.perChange365d < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {stock.perChange365d >= 0 ? '+' : ''}{stock.perChange365d.toFixed(1)}%
                      </td>

                      <td className="px-4 py-3 hidden 2xl:table-cell">
                        {(() => {
                          const url = stockChartUrl(stock, statMode);
                          return url ? (
                            <img
                              src={url}
                              alt={`${stock.symbol} trend`}
                              width={110}
                              height={40}
                              className="opacity-80 hover:opacity-100 transition-opacity"
                              style={{ filter: isGainer ? 'hue-rotate(0deg)' : isLoser ? 'hue-rotate(300deg)' : 'grayscale(60%)' }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : <span className="text-slate-700 text-xs">—</span>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredStocks.length > 0 && (
            <div
              className="px-4 py-2.5 text-[11px] text-slate-600 border-t flex items-center justify-between"
              style={{ borderColor: 'rgba(148,163,184,0.06)' }}
            >
              <span>{filteredStocks.length} stocks · sorted by {sortKey} {sortDir}</span>
              <span>Source: NSE India · Not investment advice</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
