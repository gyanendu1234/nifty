export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div
      className={`${dim} rounded-full animate-spin`}
      style={{
        border: '2px solid rgba(148,163,184,0.15)',
        borderTopColor: '#3b82f6',
        boxShadow: '0 0 12px rgba(59,130,246,0.3)',
      }}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="flex flex-col items-center gap-4 anim-fade-in">
        <div className="relative">
          <LoadingSpinner size="lg" />
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'rgba(59,130,246,0.08)' }}
          />
        </div>
        <p className="text-sm text-slate-500 tracking-wide">Loading data…</p>
      </div>
    </div>
  );
}
