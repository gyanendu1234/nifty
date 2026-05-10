'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: boolean;
  animIndex?: number;
  href?: string;
}

const ICON_GLOW: Record<string, string> = {
  'text-blue-400':   'rgba(59,130,246,0.5)',
  'text-green-400':  'rgba(34,197,94,0.5)',
  'text-yellow-400': 'rgba(234,179,8,0.5)',
  'text-red-400':    'rgba(239,68,68,0.5)',
  'text-purple-400': 'rgba(168,85,247,0.5)',
  'text-orange-400': 'rgba(249,115,22,0.5)',
  'text-teal-400':   'rgba(45,212,191,0.5)',
};

function CardInner({
  label, value, sub,
  icon: Icon, iconColor = 'text-blue-400',
  trend, cardRef, onMouseMove, onMouseLeave, animClass, highlight,
}: {
  label: string; value: number | string; sub?: string;
  icon?: LucideIcon; iconColor?: string; trend?: 'up' | 'down' | 'neutral';
  cardRef: React.RefObject<HTMLDivElement>;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  animClass: string;
  highlight?: boolean;
}) {
  const glowColor = ICON_GLOW[iconColor] ?? 'rgba(59,130,246,0.4)';

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`${highlight ? 'kpi-card-highlight' : 'kpi-card'} ${animClass}`}
      style={{ transition: 'transform 220ms cubic-bezier(0.34,1.4,0.64,1), box-shadow 220ms ease, border-color 220ms ease' }}
    >
      <div className="flex items-start justify-between">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor} shrink-0`}
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(148,163,184,0.12)',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.4), 0 0 10px ${glowColor}`,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 mt-1">
        <span
          className={`kpi-value ${
            trend === 'up'   ? 'text-green-400' :
            trend === 'down' ? 'text-red-400'   : ''
          }`}
        >
          {value}
        </span>
      </div>

      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export function KPICard({
  label, value, sub,
  icon: Icon, iconColor = 'text-blue-400',
  trend, highlight, animIndex = 0, href,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null!) as React.RefObject<HTMLDivElement>;
  const animClass = `anim-fade-up-${Math.min(animIndex, 6)}`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${y * -12}deg) rotateY(${x * 12}deg) translateY(-4px) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = '';
  };

  const inner = (
    <CardInner
      label={label} value={value} sub={sub}
      icon={Icon} iconColor={iconColor}
      trend={trend} cardRef={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animClass={animClass}
      highlight={highlight}
    />
  );

  if (href) {
    return (
      <Link href={href} className="block cursor-pointer group">
        {inner}
      </Link>
    );
  }

  return inner;
}
