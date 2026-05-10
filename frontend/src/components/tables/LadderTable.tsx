'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { LadderTableRow } from '@/types';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { MovementBadge } from '@/components/ui/MovementBadge';
import { StabilityBadge } from '@/components/ui/StabilityBadge';
import { RankChangePill } from '@/components/ui/RankChangePill';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportToCsv } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, ExternalLink } from 'lucide-react';

const col = createColumnHelper<LadderTableRow>();

interface Props {
  data: LadderTableRow[];
  loading?: boolean;
  total?: number;
  onCompanyClick?: (isin: string) => void;
}

export function LadderTable({ data, loading, total, onCompanyClick }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => [
    col.accessor('current_rank', {
      header: 'Rank',
      cell: info => (
        <span className="font-mono text-slate-300 font-semibold">
          #{info.getValue() ?? '—'}
        </span>
      ),
      size: 60,
    }),
    col.accessor('company_name', {
      header: 'Company',
      cell: info => {
        const row = info.row.original;
        return (
          <div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCompanyClick?.(row.isin)}
                className="text-blue-400 hover:text-blue-300 font-medium hover:underline text-left"
              >
                {info.getValue() ?? row.isin}
              </button>
              <Link
                href={`/company/${row.isin}`}
                title="Open full page"
                className="text-slate-600 hover:text-slate-400 shrink-0"
              >
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {row.nse_symbol ?? row.isin}
            </span>
          </div>
        );
      },
      minSize: 160,
    }),
    col.accessor('current_category', {
      header: 'Category',
      cell: info => <CategoryBadge category={info.getValue()} />,
    }),
    col.accessor('rank_change', {
      header: 'Rank Δ',
      cell: info => <RankChangePill change={info.getValue()} />,
    }),
    col.accessor('movement_type', {
      header: 'Movement',
      cell: info => (
        <MovementBadge movementType={info.getValue()} />
      ),
    }),
    col.accessor('stability_status', {
      header: 'Stability',
      cell: info => <StabilityBadge status={info.getValue()} size="sm" />,
    }),
    col.accessor('trend_label', {
      header: 'Trend',
      cell: info => (
        <span className="text-xs text-slate-400 whitespace-nowrap">{info.getValue() ?? '—'}</span>
      ),
    }),
    col.accessor('ladder_score', {
      header: 'Score',
      cell: info => {
        const v = info.getValue();
        return v != null ? (
          <span className="text-xs font-semibold text-blue-400">{v}</span>
        ) : <span className="text-slate-600">—</span>;
      },
    }),
  ], [onCompanyClick]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const handleExport = () => {
    const rows = data.map(r => ({
      company: r.company_name ?? r.isin,
      isin: r.isin,
      nse: r.nse_symbol ?? '',
      current_category: r.current_category ?? '',
      current_rank: r.current_rank ?? '',
      rank_change: r.rank_change ?? '',
      movement_type: r.movement_type ?? '',
      stability: r.stability_status ?? '',
      trend: r.trend_label ?? '',
      ladder_score: r.ladder_score ?? '',
    }));
    exportToCsv(rows, 'nifty-ladder-movements.csv');
  };

  if (!loading && data.length === 0) {
    return <EmptyState title="No companies match current filters" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          {loading ? ' ' : total ? `${total.toLocaleString()} companies` : `${data.length} companies`}
        </p>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-xs">
          <Download className="w-3 h-3" />Export CSV
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-400" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="w-3 h-3 text-blue-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-600" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
