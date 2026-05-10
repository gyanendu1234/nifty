import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <p className="text-6xl font-bold text-slate-700 mb-4">404</p>
        <h1 className="text-xl font-semibold text-slate-300 mb-2">Page Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">The page you're looking for doesn't exist.</p>
        <Link href="/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
