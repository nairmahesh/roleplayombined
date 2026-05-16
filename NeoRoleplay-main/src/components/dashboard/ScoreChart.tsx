// pitchiq/frontend/src/components/dashboard/ScoreChart.tsx
// Line chart showing score progression over time

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { format } from 'date-fns';
import { Session } from '@/types';

interface Props {
  sessions: Session[];
  passThreshold?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value;
  const color = score >= 80 ? '#06D6A0' : score >= 65 ? '#FFD166' : '#FF6B6B';
  return (
    <div className="bg-bg-2 border border-white/10 rounded-[10px] px-3 py-2.5 shadow-lg">
      <div className="text-[11px] text-white/65 mb-1">{label}</div>
      <div className="font-display text-xl font-bold" style={{ color }}>{score}</div>
      <div className="text-[10px] text-white/30 mt-0.5">{payload[0]?.payload?.persona}</div>
    </div>
  );
}

export function ScoreChart({ sessions, passThreshold = 70 }: Props) {
  const data = sessions
    .filter(s => s.totalScore != null && s.endedAt)
    .sort((a, b) => new Date(a.endedAt!).getTime() - new Date(b.endedAt!).getTime())
    .slice(-20) // Last 20 sessions
    .map(s => ({
      date: format(new Date(s.endedAt!), 'MMM d'),
      score: s.totalScore,
      persona: s.persona?.name,
      framework: s.framework,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/25 text-sm">
        Complete sessions to see your score trend
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5B6FFF" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#5B6FFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'rgba(240,242,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: 'rgba(240,242,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 25, 50, 75, 100]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
        <ReferenceLine
          y={passThreshold}
          stroke="rgba(255,209,102,0.3)"
          strokeDasharray="4 4"
          label={{ value: `Pass ${passThreshold}`, fill: 'rgba(255,209,102,0.5)', fontSize: 9, position: 'insideTopRight' }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#5B6FFF"
          strokeWidth={2}
          fill="url(#scoreGrad)"
          dot={{ fill: '#5B6FFF', r: 3, strokeWidth: 0 }}
          activeDot={{ fill: '#fff', r: 4, stroke: '#5B6FFF', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
