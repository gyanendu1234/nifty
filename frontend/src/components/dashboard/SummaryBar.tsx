'use client';

import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Users, Target, AlertTriangle, Award,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { DashboardSummary } from '@/types';

interface Props {
  summary: DashboardSummary;
}

// Helper: build ladder URL with pre-applied filters
function ladder(params: Record<string, string | boolean>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `/ladder?${qs}`;
}

export function SummaryBar({ summary }: Props) {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="anim-fade-up">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Total Companies" value={summary.total_companies.toLocaleString()} icon={Users}  iconColor="text-blue-400"   animIndex={0} href="/ladder" />
          <KPICard label="Large Cap"  value={summary.large_cap_count}  sub="Rank 1–100"   icon={Award}   iconColor="text-green-400"  animIndex={1} href={ladder({ category: 'Large Cap' })} />
          <KPICard label="Mid Cap"    value={summary.mid_cap_count}    sub="Rank 101–250" icon={Target}   iconColor="text-yellow-400" animIndex={2} href={ladder({ category: 'Mid Cap' })} />
          <KPICard label="Small Cap"  value={summary.small_cap_count}  sub="Rank 251+"    icon={Users}    iconColor="text-purple-400" animIndex={3} href={ladder({ category: 'Small Cap' })} />
        </div>
      </div>

      {/* Entry / Exit */}
      <div className="anim-fade-up-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
          Category Changes – {summary.latest_period_label}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Entering Large" value={summary.entering_large_cap} trend="up"   icon={ArrowUpRight}   iconColor="text-green-400"  animIndex={0} href={ladder({ is_category_entry: true, entered_category: 'Large Cap' })} />
          <KPICard label="Exiting Large"  value={summary.exiting_large_cap}  trend="down" icon={ArrowDownRight} iconColor="text-red-400"    animIndex={1} href={ladder({ is_category_exit:  true, exited_category:  'Large Cap' })} />
          <KPICard label="Entering Mid"   value={summary.entering_mid_cap}   trend="up"   icon={ArrowUpRight}   iconColor="text-yellow-400" animIndex={2} href={ladder({ is_category_entry: true, entered_category: 'Mid Cap' })} />
          <KPICard label="Exiting Mid"    value={summary.exiting_mid_cap}    trend="down" icon={ArrowDownRight} iconColor="text-orange-400" animIndex={3} href={ladder({ is_category_exit:  true, exited_category:  'Mid Cap' })} />
          <KPICard label="Entering Small" value={summary.entering_small_cap} trend="down" icon={ArrowDownRight} iconColor="text-purple-400" animIndex={4} href={ladder({ is_category_entry: true, entered_category: 'Small Cap' })} />
          <KPICard label="Exiting Small"  value={summary.exiting_small_cap}  trend="up"   icon={ArrowUpRight}   iconColor="text-teal-400"   animIndex={5} href={ladder({ is_category_exit:  true, exited_category:  'Small Cap' })} />
        </div>
      </div>

      {/* Movement Flow */}
      <div className="anim-fade-up-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Movement Flow</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Small → Mid"  value={summary.small_to_mid}  trend="up"   icon={TrendingUp}   iconColor="text-green-400" animIndex={0} href={ladder({ movement_type: 'Small → Mid' })} />
          <KPICard label="Mid → Large"  value={summary.mid_to_large}  trend="up"   icon={TrendingUp}   iconColor="text-green-400" animIndex={1} href={ladder({ movement_type: 'Mid → Large' })} />
          <KPICard label="Large → Mid"  value={summary.large_to_mid}  trend="down" icon={TrendingDown} iconColor="text-red-400"   animIndex={2} href={ladder({ movement_type: 'Large → Mid' })} />
          <KPICard label="Mid → Small"  value={summary.mid_to_small}  trend="down" icon={TrendingDown} iconColor="text-red-400"   animIndex={3} href={ladder({ movement_type: 'Mid → Small' })} />
        </div>
      </div>

      {/* Boundary Alerts */}
      <div className="anim-fade-up-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Boundary Watch</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard label="Near Large Upgrade"   value={summary.near_large_cap_upgrade}   sub="Rank 101–125" icon={AlertTriangle} iconColor="text-yellow-400" highlight animIndex={0} href={ladder({ near_boundary: 'near-large-upgrade' })} />
          <KPICard label="Near Large Downgrade" value={summary.near_large_cap_downgrade} sub="Rank 90–100"  icon={AlertTriangle} iconColor="text-orange-400" highlight animIndex={1} href={ladder({ near_boundary: 'near-large-downgrade' })} />
          <KPICard label="Near Mid Upgrade"     value={summary.near_mid_cap_upgrade}     sub="Rank 251–300" icon={AlertTriangle} iconColor="text-teal-400"   highlight animIndex={2} href={ladder({ near_boundary: 'near-mid-upgrade' })} />
          <KPICard label="Near Mid Downgrade"   value={summary.near_mid_cap_downgrade}   sub="Rank 225–250" icon={AlertTriangle} iconColor="text-purple-400" highlight animIndex={3} href={ladder({ near_boundary: 'near-mid-downgrade' })} />
        </div>
      </div>
    </div>
  );
}
