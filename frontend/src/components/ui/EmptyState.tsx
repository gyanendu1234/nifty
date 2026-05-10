import { Search } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No data found',
  description = 'Try adjusting your filters or upload AMFI data to get started.',
  icon,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
        {icon ?? <Search className="w-5 h-5 text-slate-500" />}
      </div>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="text-xs text-slate-600 mt-1 max-w-sm">{description}</p>
    </div>
  );
}
