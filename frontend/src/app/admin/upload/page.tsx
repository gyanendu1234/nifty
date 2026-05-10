'use client';

import { useState, useRef } from 'react';
import { getAdminToken } from '@/components/admin/AdminGate';
import { uploadNiftyFile } from '@/lib/api';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface UploadResult {
  period_id: string;
  rows_parsed: number;
  companies_upserted: number;
  snapshots_inserted: number;
  movements_inserted: number;
  errors: string[];
}

export default function AdminUploadPage() {
  const [file, setFile]           = useState<File | null>(null);
  const [periodLabel, setPeriod]  = useState('');
  const [periodDate, setPeriodDate] = useState('');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<UploadResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !periodLabel || !periodDate) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = getAdminToken();
      if (!token) throw new Error('Admin token missing');

      const fd = new FormData();
      fd.append('file', file);
      fd.append('period_label', periodLabel);
      fd.append('period_end_date', periodDate);
      if (notes) fd.append('notes', notes);

      const res = await uploadNiftyFile(fd, token);
      setResult(res.data as UploadResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill period label from date
  const handleDateChange = (val: string) => {
    setPeriodDate(val);
    if (val) {
      const d = new Date(val);
      const mon = d.toLocaleString('en-IN', { month: 'short' });
      const yr  = d.getFullYear();
      setPeriod(`${mon} ${yr}`);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Upload Nifty File</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload the half-yearly Large/Mid/Small Cap categorisation Excel file
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            file
              ? 'border-green-600/50 bg-green-900/10'
              : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-8 h-8 text-green-400" />
              <p className="text-sm font-medium text-green-400">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-slate-500" />
              <p className="text-sm text-slate-400">Drag & drop Excel file or click to browse</p>
              <p className="text-xs text-slate-600">.xlsx or .xls format</p>
            </div>
          )}
        </div>

        {/* Period Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Period End Date *</label>
            <input
              type="date"
              value={periodDate}
              onChange={e => handleDateChange(e.target.value)}
              required
              className="input w-full"
            />
            <p className="text-xs text-slate-600 mt-1">e.g. 2024-12-31 for Dec 2024</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Period Label *</label>
            <input
              type="text"
              value={periodLabel}
              onChange={e => setPeriod(e.target.value)}
              placeholder="Jun 2025"
              required
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes about this upload..."
            rows={2}
            className="input w-full resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg p-3">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || !periodLabel || !periodDate || loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload &amp; Process
            </>
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="card border-green-700/40 bg-green-900/10">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-semibold text-green-400">Upload Successful</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Rows Parsed:</span> <span className="text-slate-200 font-semibold">{result.rows_parsed.toLocaleString()}</span></div>
            <div><span className="text-slate-500">Companies:</span> <span className="text-slate-200 font-semibold">{result.companies_upserted.toLocaleString()}</span></div>
            <div><span className="text-slate-500">Snapshots:</span> <span className="text-slate-200 font-semibold">{result.snapshots_inserted.toLocaleString()}</span></div>
            <div><span className="text-slate-500">Movements:</span> <span className="text-slate-200 font-semibold">{result.movements_inserted.toLocaleString()}</span></div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1 text-xs text-yellow-400 mb-2">
                <AlertCircle className="w-3 h-3" />
                {result.errors.length} non-fatal errors
              </div>
              <div className="max-h-32 overflow-y-auto text-xs text-yellow-600 space-y-0.5">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guide */}
      <div className="card-sm border-slate-700/50 bg-slate-900/50">
        <h4 className="text-xs font-semibold text-slate-400 mb-2">Expected File Format</h4>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>Standard half-yearly Large/Mid/Small Cap categorisation Excel</li>
          <li>Columns: Sr.No, Company Name, ISIN, NSE Symbol, BSE Code, Avg Market Cap</li>
          <li>ISIN used as primary matching key</li>
          <li>Category determined by rank: 1–100 = Large, 101–250 = Mid, 251+ = Small</li>
        </ul>
      </div>
    </div>
  );
}
