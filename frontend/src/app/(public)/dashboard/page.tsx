import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { DashboardContent } from './DashboardContent';

export const revalidate = 300;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between anim-fade-up">
        <div>
          <h1 className="page-title">Market Cap Ladder Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Nifty half-yearly categorisation trends — Large Cap, Mid Cap, Small Cap movements
          </p>
        </div>
      </div>

      <Suspense fallback={<PageLoader />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
