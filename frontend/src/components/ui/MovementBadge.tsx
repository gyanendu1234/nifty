import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface Props {
  direction?: string | null;
  movementType?: string | null;
  size?: 'sm' | 'md';
}

export function MovementBadge({ direction, movementType, size = 'md' }: Props) {
  const text = movementType ?? direction ?? '—';

  if (direction === 'up' || (movementType && movementType.includes('→') && isUpward(movementType))) {
    return (
      <span className={`badge-up ${size === 'sm' ? 'text-[10px]' : ''}`}>
        <TrendingUp className="w-3 h-3" />
        {text}
      </span>
    );
  }

  if (direction === 'down' || (movementType && movementType.includes('→') && isDownward(movementType))) {
    return (
      <span className={`badge-down ${size === 'sm' ? 'text-[10px]' : ''}`}>
        <TrendingDown className="w-3 h-3" />
        {text}
      </span>
    );
  }

  if (direction === 'volatile') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-900/40 text-orange-400">
        <Activity className="w-3 h-3" />
        {text}
      </span>
    );
  }

  return (
    <span className={`badge-stable ${size === 'sm' ? 'text-[10px]' : ''}`}>
      <Minus className="w-3 h-3" />
      {text}
    </span>
  );
}

function isUpward(t: string) {
  return t === 'Small → Mid' || t === 'Mid → Large' || t === 'Small → Large';
}

function isDownward(t: string) {
  return t === 'Large → Mid' || t === 'Mid → Small' || t === 'Large → Small';
}
