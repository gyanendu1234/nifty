'use client';

import { useEffect, useState } from 'react';
import { getAdminToken } from '@/components/admin/AdminGate';
import { getAdminPeriods, deletePeriod, reprocessPeriod, recalculateMovements } from '@/lib/api';
import { NiftyPeriod } from '@/types';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { CheckCircle, XCircle, Clock, RefreshCw, Trash2, RotateCcw } from 'lucide-react';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':  return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'failed':     return <XCircle     className="w-4 h-4 text-red-400"   />;
    case 'processing': return <RefreshCw   className="w-4 h-4 text-blue-400 animate-spin" />;
    default:           return <Clock       className="w-4 h-4 text-slate-500" />;
  }
}

export default function AdminPeriodsPage() {
  const [periods, setPeriods] = useState<NiftyPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      if (!token) return;
      const res = await getAdminPeriods(token);
      setPeriods(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const withToken = async (fn: (token: string) => Promise<void>) => {
    const token = getAdminToken();
    if (!token) return;
    await fn(token);
  };

  const handleReprocess = async (id: string) => {
    setBusy(id);
    setMsg(null);
    await withToken(async (token) => {
      try {
        await reprocessPeriod(id, token);
        setMsg('Reprocessed successfully');
        load();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Reprocess failed');
      }
    });
    setBusy(null);
  };

  const handleRecalculate = async (id: string) => {
    setBusy(`recalc-${id}`);
    setMsg(null);
    await withToken(async (token) => {
      try {
        await recalculateMovements(id, token);
        setMsg('Movements recalculated');
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Recalculate failed');
      }
    });
    setBusy(null);
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete period "${label}" and all its data? This cannot be undone.`)) return;
    setBusy(`del-${id}`);
    await withToken(async (token) => {
      try {
        await deletePeriod(id, token);
        setMsg(`Deleted ${label}`);
        load();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Delete failed');
      }
    });
    setBusy(null);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Nifty Periods</h1>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      {msg && (
        <div className="text-sm text-blue-400 bg-blue-900/20 border border-blue-900/30 rounded-lg p-3">
          {msg}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Snapshots</th>
              <th>Source File</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.id}>
                <td className="font-semibold text-slate-200">{p.period_label}</td>
                <td className="font-mono text-slate-400 text-xs">{p.period_end_date}</td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={p.import_status} />
                    <span className={`text-xs capitalize ${
                      p.import_status === 'completed' ? 'text-green-400' :
                      p.import_status === 'failed'    ? 'text-red-400'   :
                      p.import_status === 'processing'? 'text-blue-400'  : 'text-slate-500'
                    }`}>
                      {p.import_status}
                    </span>
                  </div>
                  {p.import_error && (
                    <p className="text-xs text-red-400 mt-1 max-w-xs truncate">{p.import_error}</p>
                  )}
                </td>
                <td className="font-mono text-xs text-slate-400">
                  {p.snapshot_count?.toLocaleString() ?? '—'}
                </td>
                <td className="text-xs text-slate-500 max-w-xs truncate">
                  {p.source_file_name ?? '—'}
                </td>
                <td className="text-xs text-slate-500">
                  {new Date(p.uploaded_at).toLocaleDateString('en-IN')}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReprocess(p.id)}
                      disabled={busy === p.id}
                      title="Reprocess file"
                      className="text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-40"
                    >
                      {busy === p.id
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <RotateCcw className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleRecalculate(p.id)}
                      disabled={busy === `recalc-${p.id}`}
                      title="Recalculate movements"
                      className="text-slate-500 hover:text-yellow-400 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-4 h-4 ${busy === `recalc-${p.id}` ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.period_label)}
                      disabled={busy === `del-${p.id}`}
                      title="Delete period"
                      className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-8">
                  No periods uploaded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
