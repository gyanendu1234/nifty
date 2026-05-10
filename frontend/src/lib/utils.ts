import { CapCategory } from '@/types';

export function formatCrore(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)}L Cr`;
  if (value >= 1_000)   return `₹${(value / 1_000).toFixed(2)}K Cr`;
  return `₹${value.toFixed(2)} Cr`;
}

export function formatRankChange(change: number | null | undefined): string {
  if (change == null) return '—';
  if (change > 0) return `+${change}`;
  return String(change);
}

export function getCategoryColor(category: CapCategory | string | null): {
  bg: string;
  text: string;
  border: string;
} {
  switch (category) {
    case 'Large Cap':
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    case 'Mid Cap':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    case 'Small Cap':
      return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

export function getDirectionColor(direction: string | null): {
  bg: string;
  text: string;
  icon: string;
} {
  switch (direction) {
    case 'up':
      return { bg: 'bg-green-50', text: 'text-green-700', icon: '↑' };
    case 'down':
      return { bg: 'bg-red-50', text: 'text-red-700', icon: '↓' };
    case 'stable':
      return { bg: 'bg-gray-50', text: 'text-gray-600', icon: '→' };
    case 'volatile':
      return { bg: 'bg-orange-50', text: 'text-orange-700', icon: '↕' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-500', icon: '—' };
  }
}

export function getStabilityColor(status: string | null): string {
  switch (status) {
    case 'Confirmed Upgrade':
    case 'Downgrade Recovered':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'Borderline Upgrade':
      return 'text-teal-700 bg-teal-50 border-teal-200';
    case 'Upgrade Reversed':
    case 'Confirmed Downgrade':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'Borderline Downgrade':
      return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'Volatile':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'Stable':
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getTrendColor(label: string | null): string {
  if (!label) return 'text-gray-500';
  if (label.includes('Climber') || label === 'Stable Large Cap') return 'text-green-700';
  if (label.includes('Falling') || label.includes('Decliner')) return 'text-red-700';
  if (label.includes('Borderline')) return 'text-yellow-700';
  if (label.includes('Reversed')) return 'text-orange-700';
  return 'text-gray-600';
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h];
          if (val == null) return '';
          const s = String(val);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const SECTOR_LIST = [
  'Agriculture', 'Airlines', 'Aluminium', 'Asset Management Companies',
  'Automobiles', 'Auto Ancillaries', 'Banking', 'Banks - Private', 'Banks - PSU',
  'Cement', 'Chemicals', 'Defence', 'Diagnostics', 'Drones', 'Engineering',
  'Electric Vehicle', 'Electric Vehicle Battery', 'Energy', 'ESG', 'Ethanol',
  'Fertilizers', 'Fintech', 'FMCG', 'Food', 'Green Hydrogen', 'Hotels',
  'Infrastructure', 'Insurance', 'Investment and Finance', 'InvIT',
  'IT - Large', 'IT - Others', 'Logistics', 'Media', 'Metals', 'Mining',
  'Big Tech India', 'Indian Pharma', 'MNC Pharma', 'PSU', 'Paint', 'Paper',
  'Plastic', 'Power', 'Rating Agencies', 'Real Estate', 'REITs',
  'Renewable Energy', 'Retailing', 'Semiconductor', 'Shipping', 'Steel',
  'Sugar', 'Supply Chain', 'Telecom', 'Textiles', 'Travel Support Services',
];

export const MOVEMENT_TYPES = [
  'Small → Mid', 'Mid → Large', 'Small → Large',
  'Large → Mid', 'Mid → Small', 'Large → Small',
  'No Change',
];

export const STABILITY_STATUSES = [
  'Confirmed Upgrade', 'Borderline Upgrade', 'Upgrade Reversed',
  'Confirmed Downgrade', 'Borderline Downgrade', 'Downgrade Recovered',
  'Stable', 'Volatile',
];

export const TREND_LABELS = [
  'Strong Confirmed Climber', 'Rapid Climber', 'Slow Consistent Climber',
  'Borderline Large Cap', 'Upgrade Reversed', 'Stable Large Cap',
  'Stable Mid Cap', 'Stable Small Cap', 'Falling Large Cap', 'Falling Mid Cap',
  'Confirmed Decliner', 'Volatile / Unclear',
];

export const RANK_RANGES = [
  { label: 'Rank 1–50',       min: 1,    max: 50   },
  { label: 'Rank 51–100',     min: 51,   max: 100  },
  { label: 'Rank 101–150',    min: 101,  max: 150  },
  { label: 'Rank 151–250',    min: 151,  max: 250  },
  { label: 'Rank 251–500',    min: 251,  max: 500  },
  { label: 'Rank 501–1000',   min: 501,  max: 1000 },
  { label: 'Rank 1000+',      min: 1001, max: 99999 },
];

export const NEAR_BOUNDARIES = [
  { value: 'near-large-upgrade',   label: 'Near Large Cap Upgrade (Rank 101–125)' },
  { value: 'near-large-downgrade', label: 'Near Large Cap Downgrade (Rank 90–100)' },
  { value: 'near-mid-upgrade',     label: 'Near Mid Cap Upgrade (Rank 251–300)' },
  { value: 'near-mid-downgrade',   label: 'Near Mid Cap Downgrade (Rank 225–250)' },
  { value: 'deep-large',           label: 'Deep Large Cap (Rank 1–75)' },
  { value: 'deep-mid',             label: 'Deep Mid Cap (Rank 126–225)' },
  { value: 'deep-small',           label: 'Deep Small Cap (Rank 301+)' },
];
