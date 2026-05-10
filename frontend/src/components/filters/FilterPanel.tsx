'use client';

import { useState, useRef, useEffect } from 'react';
import { LadderFilters } from '@/types';
import { MOVEMENT_TYPES, STABILITY_STATUSES, RANK_RANGES, NEAR_BOUNDARIES } from '@/lib/utils';
import { ChevronDown, X } from 'lucide-react';

interface Props {
  filters: LadderFilters;
  onChange: (filters: LadderFilters) => void;
  periods: { id: string; period_label: string }[];
}

function Chip({
  label, active, onClear, children,
}: {
  label: string;
  active?: boolean;
  onClear?: () => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
          active
            ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500'
        }`}
      >
        <span>{label}</span>
        {active && onClear ? (
          <X
            className="w-3 h-3 hover:text-white"
            onClick={e => { e.stopPropagation(); onClear(); setOpen(false); }}
          />
        ) : (
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-40">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Opt({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
        selected
          ? 'bg-blue-600/30 text-blue-300'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

export function FilterPanel({ filters, onChange, periods }: Props) {
  const set = (key: keyof LadderFilters, value: unknown) =>
    onChange({ ...filters, [key]: value ?? undefined, offset: 0 });

  const clear = () => onChange({ limit: filters.limit });

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => !['limit', 'offset', 'sort_by', 'sort_dir'].includes(k) && v !== undefined && v !== ''
  ).length;

  const periodLabel = filters.to_period_id
    ? (periods.find(p => p.id === filters.to_period_id)?.period_label ?? 'Period')
    : 'Latest';

  const entryExitLabel = (() => {
    if (filters.is_category_entry && filters.entered_category)
      return `Enter ${filters.entered_category.replace(' Cap', '')}`;
    if (filters.is_category_exit && filters.exited_category)
      return `Exit ${filters.exited_category.replace(' Cap', '')}`;
    return undefined;
  })();

  const nearLabel = filters.near_boundary
    ? NEAR_BOUNDARIES.find(b => b.value === filters.near_boundary)?.label.split('(')[0].trim()
    : undefined;

  const rankLabel = (() => {
    if (filters.rank_min == null && filters.rank_max == null) return undefined;
    return RANK_RANGES.find(r => r.min === filters.rank_min && r.max === filters.rank_max)?.label;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* Period */}
      <Chip label={periodLabel} active={!!filters.to_period_id} onClear={() => set('to_period_id', undefined)}>
        {close => (
          <div className="space-y-0.5 max-h-60 overflow-y-auto min-w-[150px]">
            <Opt label="Latest Period" selected={!filters.to_period_id} onClick={() => { set('to_period_id', undefined); close(); }} />
            {periods.map(p => (
              <Opt key={p.id} label={p.period_label} selected={filters.to_period_id === p.id} onClick={() => { set('to_period_id', p.id); close(); }} />
            ))}
          </div>
        )}
      </Chip>

      {/* Category */}
      <Chip label={filters.category ?? 'Category'} active={!!filters.category} onClear={() => set('category', undefined)}>
        {close => (
          <div className="space-y-0.5 min-w-[120px]">
            {(['Large Cap', 'Mid Cap', 'Small Cap'] as const).map(cat => (
              <Opt key={cat} label={cat} selected={filters.category === cat}
                onClick={() => { set('category', filters.category === cat ? undefined : cat); close(); }} />
            ))}
          </div>
        )}
      </Chip>

      {/* Entry / Exit */}
      <Chip
        label={entryExitLabel ?? 'Entry / Exit'}
        active={!!entryExitLabel}
        onClear={() => onChange({ ...filters, is_category_entry: undefined, entered_category: undefined, is_category_exit: undefined, exited_category: undefined, offset: 0 })}
      >
        {close => (
          <div className="space-y-0.5 min-w-[170px]">
            {[
              { label: 'Entering Large Cap', entry: true,  cat: 'Large Cap' },
              { label: 'Exiting Large Cap',  entry: false, cat: 'Large Cap' },
              { label: 'Entering Mid Cap',   entry: true,  cat: 'Mid Cap'   },
              { label: 'Exiting Mid Cap',    entry: false, cat: 'Mid Cap'   },
              { label: 'Entering Small Cap', entry: true,  cat: 'Small Cap' },
              { label: 'Exiting Small Cap',  entry: false, cat: 'Small Cap' },
            ].map(opt => {
              const sel = opt.entry
                ? !!(filters.is_category_entry && filters.entered_category === opt.cat)
                : !!(filters.is_category_exit && filters.exited_category === opt.cat);
              return (
                <Opt key={opt.label} label={opt.label} selected={sel} onClick={() => {
                  if (opt.entry) {
                    onChange({ ...filters, is_category_entry: sel ? undefined : true, entered_category: sel ? undefined : opt.cat, is_category_exit: undefined, exited_category: undefined, offset: 0 });
                  } else {
                    onChange({ ...filters, is_category_exit: sel ? undefined : true, exited_category: sel ? undefined : opt.cat, is_category_entry: undefined, entered_category: undefined, offset: 0 });
                  }
                  close();
                }} />
              );
            })}
          </div>
        )}
      </Chip>

      {/* Movement */}
      <Chip label={filters.movement_type ?? 'Movement'} active={!!filters.movement_type} onClear={() => set('movement_type', undefined)}>
        {close => (
          <div className="space-y-0.5 min-w-[140px]">
            {MOVEMENT_TYPES.map(t => (
              <Opt key={t} label={t} selected={filters.movement_type === t}
                onClick={() => { set('movement_type', filters.movement_type === t ? undefined : t); close(); }} />
            ))}
          </div>
        )}
      </Chip>

      {/* Stability */}
      <Chip label={filters.stability_status ?? 'Stability'} active={!!filters.stability_status} onClear={() => set('stability_status', undefined)}>
        {close => (
          <div className="space-y-0.5 min-w-[170px]">
            {STABILITY_STATUSES.map(s => (
              <Opt key={s} label={s} selected={filters.stability_status === s}
                onClick={() => { set('stability_status', filters.stability_status === s ? undefined : s); close(); }} />
            ))}
          </div>
        )}
      </Chip>

      {/* Near Boundary */}
      <Chip label={nearLabel ?? 'Near Boundary'} active={!!filters.near_boundary} onClear={() => set('near_boundary', undefined)}>
        {close => (
          <div className="space-y-0.5 min-w-[280px]">
            {NEAR_BOUNDARIES.map(b => (
              <Opt key={b.value} label={b.label} selected={filters.near_boundary === b.value}
                onClick={() => { set('near_boundary', filters.near_boundary === b.value ? undefined : b.value); close(); }} />
            ))}
          </div>
        )}
      </Chip>

      {/* Rank Range */}
      <Chip label={rankLabel ?? 'Rank'} active={!!rankLabel} onClear={() => onChange({ ...filters, rank_min: undefined, rank_max: undefined, offset: 0 })}>
        {close => (
          <div className="space-y-0.5 min-w-[130px]">
            {RANK_RANGES.map(r => {
              const sel = filters.rank_min === r.min && filters.rank_max === r.max;
              return (
                <Opt key={r.label} label={r.label} selected={sel}
                  onClick={() => { onChange({ ...filters, rank_min: sel ? undefined : r.min, rank_max: sel ? undefined : r.max, offset: 0 }); close(); }} />
              );
            })}
          </div>
        )}
      </Chip>

      {/* Clear all */}
      {activeCount > 0 && (
        <button onClick={clear} className="flex items-center gap-1 h-8 px-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-3 h-3" />Clear all
        </button>
      )}
    </div>
  );
}
