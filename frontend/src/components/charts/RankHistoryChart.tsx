'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TimelineRow, CapCategory } from '@/types';

interface Props {
  timeline: TimelineRow[];
}

const CAT_COLORS: Record<CapCategory, string> = {
  'Large Cap': '#22c55e',
  'Mid Cap':   '#eab308',
  'Small Cap': '#a855f7',
};

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { category: CapCategory };
}

function CustomDot({ cx, cy, payload }: DotProps) {
  if (!cx || !cy || !payload) return null;
  const color = CAT_COLORS[payload.category] ?? '#64748b';
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0f172a" strokeWidth={2} />;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: TimelineRow }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  const color = CAT_COLORS[d.category] ?? '#64748b';
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-slate-200 mb-1">{d.period_label}</p>
      <p style={{ color }}>● {d.category}</p>
      <p className="text-slate-300">Rank: <strong>#{d.market_cap_rank}</strong></p>
      {d.average_market_cap && (
        <p className="text-slate-400">
          Avg MCap: ₹{(d.average_market_cap / 1000).toFixed(0)}K Cr
        </p>
      )}
    </div>
  );
}

export function RankHistoryChart({ timeline }: Props) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No timeline data available
      </div>
    );
  }

  // Recharts renders rank 1 at top when domain is inverted
  const maxRank = Math.max(...timeline.map(t => t.market_cap_rank), 300);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={timeline} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="period_label"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#334155' }}
        />
        <YAxis
          reversed
          domain={[1, maxRank + 50]}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#334155' }}
          label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Category boundary lines */}
        <ReferenceLine y={100}  stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5}
          label={{ value: 'Large', position: 'right', fontSize: 10, fill: '#22c55e' }} />
        <ReferenceLine y={250}  stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5}
          label={{ value: 'Mid', position: 'right', fontSize: 10, fill: '#eab308' }} />

        <Line
          type="monotone"
          dataKey="market_cap_rank"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
