import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore, usePageCache } from '@/lib/store';
import { sessionsApi, usersApi } from '@/lib/api';
import { Session, User, FRAMEWORK_INFO } from '@/types';
import { TrendingUp, Target, Clock, Trophy, Users, BarChart3, Activity } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyPoint { date: string; sessions: number; avgScore: number | null }
interface FrameworkPoint { name: string; score: number; sessions: number }
interface RepRow { id: string; name: string; sessions: number; avgScore: number; trend: 'up' | 'down' | 'flat' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return '#06D6A0';
  if (score >= 65) return '#FFD166';
  return '#FF6B6B';
}

function StatCard({ label, value, sub, icon: Icon, color, delay = 0 }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative overflow-hidden rounded-[14px] border p-4"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{label}</span>
        <Icon size={14} style={{ color: 'var(--text3)' }} />
      </div>
      <div className="font-display text-[28px] font-bold leading-none mb-1" style={{ color: 'var(--text)' }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </motion.div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border px-3 py-2 text-[11px] shadow-lg" style={{ background: 'var(--bg2)', borderColor: 'var(--border2)', color: 'var(--text)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: 'var(--text3)' }}>{p.name}:</span>
          <span className="font-medium">{p.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface AnalyticsCache { sessions: Session[]; users: User[] }

export function AnalyticsPage() {
  const { user } = useAuthStore(s => ({ user: s.user }));
  const navigate = useNavigate();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';
  const { getCache, setCache } = usePageCache();

  const cached = getCache<AnalyticsCache>('analytics');
  const [sessions, setSessions] = useState<Session[]>(cached?.sessions ?? []);
  const [users, setUsers] = useState<User[]>(cached?.users ?? []);
  const [loading, setLoading] = useState(!cached);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    Promise.all([
      isAdmin ? sessionsApi.listAll({ status: 'COMPLETED', limit: 500 }) : sessionsApi.list({ status: 'COMPLETED', limit: 500 }),
      isAdmin ? usersApi.list() : Promise.resolve([]),
    ]).then(([sd, ud]) => {
      const s = sd.sessions;
      const u = Array.isArray(ud) ? ud : [];
      setSessions(s);
      setUsers(u);
      setCache('analytics', { sessions: s, users: u });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin]);

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = startOfDay(subDays(new Date(), days));

  const filtered = useMemo(
    () => sessions.filter(s => s.endedAt && new Date(s.endedAt) >= cutoff),
    [sessions, period]
  );

  // ── Daily trend ───────────────────────────────────────────────────────────

  const dailyData: DailyPoint[] = useMemo(() => {
    const interval = eachDayOfInterval({ start: cutoff, end: new Date() });
    return interval.map(day => {
      const label = format(day, period === '7d' ? 'EEE' : 'MMM d');
      const dayStart = startOfDay(day).getTime();
      const dayEnd = dayStart + 86400000;
      const daySessions = filtered.filter(s => {
        const t = s.endedAt ? new Date(s.endedAt).getTime() : 0;
        return t >= dayStart && t < dayEnd;
      });
      const scored = daySessions.filter(s => s.totalScore != null);
      const avgScore = scored.length
        ? Math.round(scored.reduce((a, s) => a + (s.totalScore ?? 0), 0) / scored.length)
        : null;
      return { date: label, sessions: daySessions.length, avgScore };
    });
  }, [filtered, period]);

  // ── Framework performance ─────────────────────────────────────────────────

  const frameworkData: FrameworkPoint[] = useMemo(() => {
    const map: Record<string, { total: number; count: number; sessions: number }> = {};
    filtered.forEach(s => {
      if (!s.frameworkScores?.length) return;
      s.frameworkScores.forEach(fs => {
        if (!map[fs.component]) map[fs.component] = { total: 0, count: 0, sessions: 0 };
        map[fs.component].total += fs.score;
        map[fs.component].count++;
      });
    });
    filtered.forEach(s => {
      if (s.framework && FRAMEWORK_INFO[s.framework]) {
        FRAMEWORK_INFO[s.framework].components.forEach(c => {
          if (map[c]) map[c].sessions++;
        });
      }
    });
    return Object.entries(map).map(([name, v]) => ({
      name: name.length > 14 ? name.slice(0, 13) + '…' : name,
      score: v.count ? Math.round(v.total / v.count) : 0,
      sessions: v.sessions,
    })).sort((a, b) => b.score - a.score);
  }, [filtered]);

  // ── Radar chart data (top 6 framework components) ─────────────────────────

  const radarData = useMemo(() => {
    return frameworkData.slice(0, 6).map(f => ({ subject: f.name, score: f.score }));
  }, [frameworkData]);

  // ── Rep leaderboard ───────────────────────────────────────────────────────

  const repRows: RepRow[] = useMemo(() => {
    if (!isAdmin) return [];
    const map: Record<string, { name: string; scores: number[]; sessions: number }> = {};
    filtered.forEach(s => {
      if (!s.user) return;
      const id = s.user.id;
      if (!map[id]) map[id] = { name: `${s.user.firstName} ${s.user.lastName}`, scores: [], sessions: 0 };
      map[id].sessions++;
      if (s.totalScore != null) map[id].scores.push(s.totalScore);
    });
    return Object.entries(map)
      .map(([id, v]) => ({
        id,
        name: v.name,
        sessions: v.sessions,
        avgScore: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : 0,
        trend: 'flat' as const,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [filtered, isAdmin]);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalSessions = filtered.length;
  const scored = filtered.filter(s => s.totalScore != null);
  const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + (s.totalScore ?? 0), 0) / scored.length) : 0;
  const passRate = scored.length ? Math.round((scored.filter(s => (s.totalScore ?? 0) >= 70).length / scored.length) * 100) : 0;
  const avgDuration = filtered.filter(s => s.durationSeconds).length
    ? Math.round(filtered.filter(s => s.durationSeconds).reduce((a, s) => a + (s.durationSeconds ?? 0), 0) / filtered.filter(s => s.durationSeconds).length / 60)
    : 0;

  if (loading) return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-[14px] bg-white/[0.04] border border-white/[0.06]" />)}
      </div>
      <div className="h-64 rounded-[14px] bg-white/[0.04] border border-white/[0.06]" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold" style={{ color: 'var(--text)' }}>Performance Analytics</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            {isAdmin ? 'Team-wide performance data' : 'Your personal performance breakdown'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx('px-3 py-1.5 rounded-[8px] border text-[12px] font-medium transition-all', period === p ? 'border-accent bg-accent/10 text-accent' : 'border-border2 text-text2 hover:bg-white/[0.04]')}
              style={period !== p ? { borderColor: 'var(--border2)', color: 'var(--text2)' } : {}}
            >
              {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Sessions" value={totalSessions} sub={`last ${days} days`} icon={Activity} color="var(--accent)" />
        <StatCard label="Avg Score" value={avgScore || '—'} sub="/100 overall" icon={Target} color="#06D6A0" delay={0.06} />
        <StatCard label="Pass Rate" value={`${passRate}%`} sub="score ≥ 70" icon={Trophy} color="#FFD166" delay={0.12} />
        <StatCard label="Avg Duration" value={avgDuration ? `${avgDuration}m` : '—'} sub="per session" icon={Clock} color="var(--accent5)" delay={0.18} />
      </div>

      {/* Daily trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-[14px] border p-5"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Activity Over Time</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>Sessions completed per day</p>
          </div>
          <TrendingUp size={16} style={{ color: 'var(--text3)' }} />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dailyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="grad-sessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-score" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06D6A0" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#06D6A0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="sessions" name="Sessions" stroke="var(--accent)" strokeWidth={2} fill="url(#grad-sessions)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Framework performance + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="rounded-[14px] border p-5"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={14} style={{ color: 'var(--text3)' }} />
            <p className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Framework Scores</p>
          </div>
          {frameworkData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-[12px]" style={{ color: 'var(--text3)' }}>No scored sessions in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={frameworkData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="score" name="Avg Score" radius={[0, 4, 4, 0]}
                  fill="var(--accent)"
                  label={{ position: 'right', fontSize: 10, fill: 'var(--text3)', formatter: (v: number) => v }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Radar chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
          className="rounded-[14px] border p-5"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Activity size={14} style={{ color: 'var(--text3)' }} />
            <p className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Skills Radar</p>
          </div>
          {radarData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-[12px]" style={{ color: 'var(--text3)' }}>No data yet — complete sessions to unlock</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'var(--text3)' }} />
                <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Score distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="rounded-[14px] border p-5"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Score Distribution</p>
          <p className="text-[11px]" style={{ color: 'var(--text3)' }}>{scored.length} scored sessions</p>
        </div>
        {scored.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-[12px]" style={{ color: 'var(--text3)' }}>No scored sessions yet</div>
        ) : (
          <div className="flex flex-col gap-2">
            {[
              { label: 'Excellent (85–100)', range: [85, 100], color: '#06D6A0' },
              { label: 'Good (70–84)', range: [70, 84], color: '#86efac' },
              { label: 'Average (55–69)', range: [55, 69], color: '#FFD166' },
              { label: 'Needs Work (<55)', range: [0, 54], color: '#FF6B6B' },
            ].map(({ label, range, color }) => {
              const count = scored.filter(s => (s.totalScore ?? 0) >= range[0] && (s.totalScore ?? 0) <= range[1]).length;
              const pct = scored.length ? Math.round((count / scored.length) * 100) : 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[11px] w-40 flex-shrink-0" style={{ color: 'var(--text3)' }}>{label}</span>
                  <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: color, opacity: 0.8 }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold w-10 text-right" style={{ color }}>{pct}%</span>
                  <span className="text-[10px] w-6 text-right" style={{ color: 'var(--text3)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Rep leaderboard (admin/manager only) */}
      {isAdmin && repRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}
          className="rounded-[14px] border overflow-hidden"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Users size={14} style={{ color: 'var(--text3)' }} />
              <p className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Rep Performance</p>
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{repRows.length} reps</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {repRows.map((rep, i) => (
              <motion.div
                key={rep.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.04 }}
                className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-white/[0.025] transition-colors"
                onClick={() => navigate('/sessions')}
              >
                <span className="text-[12px] font-bold w-6 text-center flex-shrink-0" style={{
                  color: i === 0 ? '#FFD166' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : 'var(--text3)'
                }}>
                  {i < 3 ? ['#1', '#2', '#3'][i] : `#${i + 1}`}
                </span>
                <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-[11px] font-bold text-accent flex-shrink-0">
                  {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{rep.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{rep.sessions} session{rep.sessions !== 1 ? 's' : ''}</div>
                </div>
                {/* Score bar */}
                <div className="hidden sm:flex items-center gap-2 w-32">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${rep.avgScore}%`, background: scoreColor(rep.avgScore) }} />
                  </div>
                </div>
                <span className="font-display text-[16px] font-bold flex-shrink-0" style={{ color: scoreColor(rep.avgScore) }}>
                  {rep.avgScore}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent sessions shortcut */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
        className="flex justify-center"
      >
        <button
          onClick={() => navigate('/sessions')}
          className="text-[12px] font-medium hover:underline transition-all"
          style={{ color: 'var(--text3)' }}
        >
          View full session history →
        </button>
      </motion.div>
    </div>
  );
}
