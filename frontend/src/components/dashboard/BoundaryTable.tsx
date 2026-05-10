'use client';

import Link from 'next/link';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { AlertTriangle } from 'lucide-react';

interface BoundaryRow {
  isin: string;
  company_name_raw: string | null;
  market_cap_rank: number;
  category: string;
  companies?: { company_name: string | null; nse_symbol: string | null; sector_primary: string | null };
}

interface BoundaryData {
  near_large_cap_upgrade?: BoundaryRow[];
  near_large_cap_downgrade?: BoundaryRow[];
  near_mid_cap_upgrade?: BoundaryRow[];
  near_mid_cap_downgrade?: BoundaryRow[];
}

interface Props {
  data: unknown;
}

const SECTION_STYLES: Record<string, { glow: string; bar: string }> = {
  yellow: { glow: '0 0 20px rgba(234,179,8,0.1)',   bar: 'rgba(234,179,8,0.7)'   },
  red:    { glow: '0 0 20px rgba(239,68,68,0.1)',   bar: 'rgba(239,68,68,0.7)'   },
  teal:   { glow: '0 0 20px rgba(45,212,191,0.1)',  bar: 'rgba(45,212,191,0.7)'  },
  orange: { glow: '0 0 20px rgba(249,115,22,0.1)',  bar: 'rgba(249,115,22,0.7)'  },
};

function BoundarySection({
  title,
  rows,
  iconColor,
  accentKey,
  animIndex = 0,
}: {
  title: string;
  rows: BoundaryRow[];
  iconColor: string;
  accentKey: string;
  animIndex?: number;
}) {
  if (!rows || rows.length === 0) return null;
  const style = SECTION_STYLES[accentKey] ?? SECTION_STYLES.yellow;

  return (
    <div
      className={`relative rounded-xl p-5 border border-slate-800/80 anim-fade-up-${Math.min(animIndex, 6)}`}
      style={{
        background: 'rgba(15,23,42,0.7)',
        backdropFilter: 'blur(8px)',
        boxShadow: `var(--shadow-lg), ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        transition: 'box-shadow 220ms ease, border-color 220ms ease',
      }}
    >
      {/* Colored top bar */}
      <div
        className="absolute top-0 left-6 right-6 h-px rounded-full"
        style={{ background: style.bar, opacity: 0.4 }}
      />

      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">{rows.length} companies</span>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>NSE</th>
              <th>Rank</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.isin}>
                <td>
                  <Link
                    href={`/company/${row.isin}`}
                    className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors cursor-pointer"
                  >
                    {row.companies?.company_name ?? row.company_name_raw ?? row.isin}
                  </Link>
                </td>
                <td className="font-mono text-slate-400 text-xs">
                  {row.companies?.nse_symbol ?? '—'}
                </td>
                <td className="font-mono text-slate-300 font-semibold tabular-nums">
                  #{row.market_cap_rank}
                </td>
                <td>
                  <CategoryBadge category={row.category as string} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BoundaryTable({ data }: Props) {
  if (!data) return null;
  const d = data as BoundaryData;

  return (
    <div className="space-y-4 anim-fade-up-4">
      <h2 className="section-title flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        Boundary Watch
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BoundarySection title="Near Large Cap Upgrade (Rank 101–125)"   rows={d.near_large_cap_upgrade   ?? []} iconColor="text-yellow-400" accentKey="yellow" animIndex={0} />
        <BoundarySection title="Near Large Cap Downgrade (Rank 90–100)"  rows={d.near_large_cap_downgrade ?? []} iconColor="text-red-400"    accentKey="red"    animIndex={1} />
        <BoundarySection title="Near Mid Cap Upgrade (Rank 251–300)"     rows={d.near_mid_cap_upgrade     ?? []} iconColor="text-teal-400"   accentKey="teal"   animIndex={2} />
        <BoundarySection title="Near Mid Cap Downgrade (Rank 225–250)"   rows={d.near_mid_cap_downgrade   ?? []} iconColor="text-orange-400" accentKey="orange" animIndex={3} />
      </div>
    </div>
  );
}
