import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  change: number | null | undefined;
}

export function RankChangePill({ change }: Props) {
  if (change == null) return <span className="text-slate-500 text-xs">—</span>;

  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400">
        <TrendingUp className="w-3 h-3" />+{change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
        <TrendingDown className="w-3 h-3" />{change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
      <Minus className="w-3 h-3" />0
    </span>
  );
}
