'use client';

import { useEffect, useState } from 'react';
import { getDashboardSummary, getBoundaryAlerts } from '@/lib/api';
import { DashboardSummary } from '@/types';
import { SummaryBar } from '@/components/dashboard/SummaryBar';
import { BoundaryTable } from '@/components/dashboard/BoundaryTable';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshCw } from 'lucide-react';

export function DashboardContent() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [boundaries, setBoundaries] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([getDashboardSummary(), getBoundaryAlerts()]);
      setSummary(s);
      setBoundaries(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="card">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={load} className="btn-secondary mt-3 flex items-center gap-2 text-sm">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!summary) return <EmptyState title="No data available" description="Upload AMFI files to get started." />;

  return (
    <div className="space-y-8">
      <SummaryBar summary={summary} />
      <BoundaryTable data={boundaries} />
    </div>
  );
}
