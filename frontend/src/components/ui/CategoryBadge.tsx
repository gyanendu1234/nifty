import { CapCategory } from '@/types';

interface Props {
  category: CapCategory | string | null | undefined;
  size?: 'sm' | 'md';
}

export function CategoryBadge({ category, size = 'md' }: Props) {
  if (!category) return <span className="text-slate-500 text-xs">—</span>;

  const classes: Record<string, string> = {
    'Large Cap': 'badge-large',
    'Mid Cap':   'badge-mid',
    'Small Cap': 'badge-small',
  };

  const cls = classes[category] ?? 'badge-stable';
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : '';

  return <span className={`${cls} ${sizeClass}`}>{category}</span>;
}
