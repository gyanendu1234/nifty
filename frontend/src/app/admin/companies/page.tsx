'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAdminToken } from '@/components/admin/AdminGate';
import { getCompanies, saveCompanyTags } from '@/lib/api';
import { Company } from '@/types';
import { SECTOR_LIST } from '@/lib/utils';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Search, Save, Tag, Building2 } from 'lucide-react';

interface EditState {
  companyId: string;
  tags: string;
  saving: boolean;
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [msg, setMsg]             = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCompanies({ search: search || undefined, limit: 50 });
      setCompanies(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [load]);

  const saveTags = async () => {
    if (!editState) return;
    setEditState(prev => prev ? { ...prev, saving: true } : null);

    const token = getAdminToken();
    if (!token) return;

    const tags = editState.tags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      await saveCompanyTags(editState.companyId, tags, token);
      setMsg('Sector tags saved');
      setEditState(null);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
      setEditState(prev => prev ? { ...prev, saving: false } : null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Companies</h1>
        <p className="text-sm text-slate-500 mt-1">Manage company sector tags and primary sector</p>
      </div>

      {msg && (
        <div className="text-sm text-blue-400 bg-blue-900/20 border border-blue-900/30 rounded-lg p-3">
          {msg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search company or ISIN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-72"
          />
        </div>
        <span className="text-xs text-slate-500">{total.toLocaleString()} companies</span>
      </div>

      {loading ? <PageLoader /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>ISIN</th>
                <th>NSE</th>
                <th>Primary Sector</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => {
                const isEditing = editState?.companyId === c.id;
                const tags = c.company_sector_tags?.map(t => t.sector_tag) ?? [];
                return (
                  <tr key={c.id}>
                    <td className="font-medium text-slate-200">{c.company_name ?? '—'}</td>
                    <td className="font-mono text-xs text-slate-400">{c.isin}</td>
                    <td className="font-mono text-xs text-slate-400">{c.nse_symbol ?? '—'}</td>
                    <td>
                      <span className="text-xs text-slate-400">{c.sector_primary ?? '—'}</span>
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editState.tags}
                          onChange={e => setEditState(prev => prev ? { ...prev, tags: e.target.value } : null)}
                          placeholder="Tag1, Tag2, Tag3"
                          className="input text-xs w-48"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {tags.length > 0
                            ? tags.map(t => (
                                <span key={t} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))
                            : <span className="text-slate-600 text-xs">none</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveTags}
                            disabled={editState.saving}
                            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />Save
                          </button>
                          <button
                            onClick={() => setEditState(null)}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditState({
                            companyId: c.id,
                            tags: tags.join(', '),
                            saving: false,
                          })}
                          className="text-slate-500 hover:text-blue-400 transition-colors"
                          title="Edit tags"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
