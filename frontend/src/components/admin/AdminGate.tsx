'use client';

import { useEffect, useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'nifty_admin_token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function clearAdminToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasToken(Boolean(getAdminToken()));
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!hasToken) {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) {
        setError('Token is required');
        return;
      }
      localStorage.setItem(STORAGE_KEY, trimmed);
      setHasToken(true);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Admin Access</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your admin token to continue</p>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Admin Token</label>
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste token from backend .env"
                  autoFocus
                  className="input w-full font-mono"
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Continue
              </button>
            </form>
          </div>

          <p className="text-xs text-slate-600 text-center mt-4">
            Token is stored locally in your browser only.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
