'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getLadder, getPeriods } from '@/lib/api';
import { LadderTableRow, LadderFilters, NiftyPeriod } from '@/types';
import { LadderTable } from '@/components/tables/LadderTable';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { CompanyDrawer } from '@/components/ui/CompanyDrawer';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const LIMIT_OPTIONS = [10, 25, 50, 100];

function parseUrlFilters(params: URLSearchParams): LadderFilters {
  const filters: LadderFilters = { limit: 50, offset: 0 };
  const category       = params.get('category');
  const movement_type  = params.get('movement_type');
  const near_boundary  = params.get('near_boundary');
  const trend_label    = params.get('trend_label');
  const is_entry       = params.get('is_category_entry');
  const entered        = params.get('entered_category');
  const is_exit        = params.get('is_category_exit');
  const exited         = params.get('exited_category');

  if (category)      filters.category = category;
  if (movement_type) filters.movement_type = movement_type;
  if (near_boundary) filters.near_boundary = near_boundary;
  if (trend_label)   filters.trend_label = trend_label;
  if (is_entry === 'true') { filters.is_category_entry = true; }
  if (entered)       filters.entered_category = entered;
  if (is_exit === 'true')  { filters.is_category_exit = true; }
  if (exited)        filters.exited_category = exited;
  return filters;
}

export default function LadderPage() {
  const searchParams = useSearchParams();

  const [data, setData]             = useState<LadderTableRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [periods, setPeriods]       = useState<NiftyPeriod[]>([]);
  const [filters, setFilters]       = useState<LadderFilters>(() => parseUrlFilters(searchParams));
  const [search, setSearch]         = useState('');
  const [drawerIsin, setDrawerIsin] = useState<string | null>(null);

  useEffect(() => {
    getPeriods().then(setPeriods).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLadder({ ...filters, search: search || undefined });
      setData(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => { load(); }, [load]);

  const page        = Math.floor((filters.offset ?? 0) / (filters.limit ?? 50)) + 1;
  const total_pages = Math.ceil(total / (filters.limit ?? 50));

  return (
    <div className="space-y-4 anim-fade-up">
      <div>
        <h1 className="page-title">Ladder Movements</h1>
        <p className="text-sm text-slate-500 mt-1">
          Full company ladder — sorted by current rank with movement history
        </p>
      </div>

      {/* Search row */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search company or ISIN…"
            value={search}
            onChange={e => { setSearch(e.target.value); setFilters(f => ({ ...f, offset: 0 })); }}
            className="input pl-9 w-64 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">Per page</span>
          <select
            value={filters.limit ?? 50}
            onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value, 10), offset: 0 }))}
            className="select text-xs"
          >
            {LIMIT_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Horizontal filter bar */}
      <FilterPanel filters={filters} onChange={setFilters} periods={periods} />

      <LadderTable
        data={data}
        loading={loading}
        total={total}
        onCompanyClick={setDrawerIsin}
      />

      {/* Pagination */}
      {total_pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 text-xs">
            Page {page} of {total_pages} ({total.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setFilters(f => ({ ...f, offset: (f.offset ?? 0) - (f.limit ?? 50) }))}
              className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />Prev
            </button>
            <button
              disabled={page >= total_pages}
              onClick={() => setFilters(f => ({ ...f, offset: (f.offset ?? 0) + (f.limit ?? 50) }))}
              className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <CompanyDrawer isin={drawerIsin} onClose={() => setDrawerIsin(null)} />
    </div>
  );
}
