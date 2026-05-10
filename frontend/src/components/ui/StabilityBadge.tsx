import { getStabilityColor } from '@/lib/utils';

interface Props {
  status: string | null | undefined;
  size?: 'sm' | 'md';
}

export function StabilityBadge({ status, size = 'md' }: Props) {
  if (!status) return <span className="text-slate-500 text-xs">—</span>;

  const colorClass = getStabilityColor(status);
  const sizeClass  = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${colorClass} ${sizeClass}`}>
      {status}
    </span>
  );
}
