// pitchiq/frontend/src/pages/LeaderboardPage.tsx

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, ChevronLeft, BarChart3, Clock, Target, Star, TrendingUp } from 'lucide-react';
import { analyticsApi, sessionsApi } from '@/lib/api';
import { LeaderboardEntry, Session } from '@/types';
import { useAuthStore, usePageCache } from '@/lib/store';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function scoreColor(score: number) {
  if (score >= 80) return '#06D6A0';
  if (score >= 65) return '#FFD166';
  return '#FF6B6B';
}

interface UserDetailProps {
  entry: LeaderboardEntry;
  onBack: () => void;
}

function UserDetail({ entry, onBack }: UserDetailProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionsApi.listAll({ userId: entry.user.id }).then(r => {
      setSessions(r.sessions.slice(0, 10));
    }).finally(() => setLoading(false));
  }, [entry.user.id]);

  const initials = `${entry.user.firstName[0]}${entry.user.lastName[0]}`;
  const color = scoreColor(entry.avgScore);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-5"
    >
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:text-white"
          style={{ color: 'var(--text3)' }}
        >
          <ChevronLeft size={15} />
          Leaderboard
        </button>
        <span style={{ color: 'var(--border2)' }}>/</span>
        <span className="text-[12px]" style={{ color: 'var(--text2)' }}>{entry.user.firstName} {entry.user.lastName}</span>
      </div>

      {/* Profile card */}
      <div className="card p-5">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold flex-shrink-0"
            style={{ background: `${color}22`, color, border: `2px solid ${color}44` }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-[18px] font-bold" style={{ color: 'var(--text)' }}>
              {entry.user.firstName} {entry.user.lastName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="tag flex items-center gap-1">
                <Trophy size={9} /> Rank #{entry.rank}
              </span>
              <span className="tag">{entry.sessionCount} sessions</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-display text-[32px] font-black leading-none" style={{ color }}>
              {entry.avgScore}
            </div>
            <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text3)' }}>avg score</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Target, label: 'Avg Score', value: entry.avgScore, color },
            { icon: BarChart3, label: 'Sessions', value: entry.sessionCount, color: 'var(--accent)' },
            { icon: Star, label: 'Rank', value: `#${entry.rank}`, color: entry.rank <= 3 ? '#FFD166' : 'var(--text2)' },
          ].map(({ icon: Icon, label, value, color: c }) => (
            <div key={label} className="flex flex-col items-center p-3 rounded-[10px]" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <Icon size={13} className="mb-1" style={{ color: c }} />
              <div className="font-display text-[16px] font-bold leading-none mb-0.5" style={{ color: c }}>{value}</div>
              <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Session history */}
      <div className="card">
        <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>Recent Sessions</span>
        </div>
        {loading ? (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-white/[0.06] flex-shrink-0" />
                <div className="flex-1 h-4 bg-white/[0.06] rounded" />
                <div className="w-12 h-5 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center" style={{ color: 'var(--text3)' }}>
            <BarChart3 size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-[13px]">No completed sessions yet</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {sessions.map((s, i) => {
              const sc = s.totalScore ?? null;
              const c = sc != null ? scoreColor(sc) : 'var(--text3)';
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: `${c}18`, color: c }}
                  >
                    {sc ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
                      {s.scenarioConfig?.displayName || s.persona?.name || s.framework}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.durationSeconds != null && (
                        <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text3)' }}>
                          <Clock size={9} /> {fmt(s.durationSeconds * 1000)}
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {sc != null && (
                    <div className="flex-shrink-0">
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${sc}%`, background: c }} />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function LeaderboardPage() {
  const user = useAuthStore(s => s.user);
  const { getLeaderboardCache, setLeaderboardCache } = usePageCache();
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);

  const cachedInit = getLeaderboardCache<LeaderboardEntry[]>(period);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>(cachedInit ?? []);
  const [loading, setLoading] = useState(!cachedInit);

  useEffect(() => {
    const cached = getLeaderboardCache<LeaderboardEntry[]>(period);
    if (cached) { setLeaders(cached); setLoading(false); }
    else setLoading(true);
    analyticsApi.leaderboard(period).then(d => {
      setLeaders(d);
      setLeaderboardCache(period, d);
    }).finally(() => setLoading(false));
  }, [period]);

  const myRank = leaders.findIndex(l => l.user.id === user?.id) + 1;
  const myEntry = leaders.find(l => l.user.id === user?.id);

  const rankStyle = (rank: number) => {
    if (rank === 1) return 'text-accent-5';
    if (rank === 2) return 'text-[#aaa]';
    if (rank === 3) return 'text-[#cd7f32]';
    return 'text-white/55';
  };

  if (selectedEntry) {
    return (
      <AnimatePresence mode="wait">
        <UserDetail key={selectedEntry.user.id} entry={selectedEntry} onBack={() => setSelectedEntry(null)} />
      </AnimatePresence>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl font-bold flex items-center gap-2"><Trophy size={18} className="text-accent-5" /> Leaderboard</h2>
        <div className="flex gap-2">
          {(['all', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-all ${period === p ? 'bg-accent border-accent text-white' : 'border-white/10 text-white/80 hover:text-white'}`}
            >
              {p === 'all' ? 'All Time' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 card">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <span className="font-display text-[14px] font-bold">Company Rankings</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                  <div className="w-5 h-4 bg-white/[0.06] rounded" />
                  <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
                  <div className="flex-1 h-4 bg-white/[0.06] rounded" />
                  <div className="w-10 h-5 bg-white/[0.06] rounded" />
                </div>
              ))
            ) : leaders.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-4 text-center px-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.2)' }}>
                  <Trophy size={22} style={{ color: '#FFD166' }} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text2)' }}>No sessions completed yet</p>
                  <p className="text-[12px]" style={{ color: 'var(--text3)' }}>Complete your first practice session to appear on the leaderboard.</p>
                </div>
                {user && (
                  <div className="w-full p-4 rounded-[12px] border mt-2 flex items-center gap-3" style={{ background: 'rgba(91,111,255,0.06)', borderColor: 'rgba(91,111,255,0.2)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: 'rgba(91,111,255,0.18)', color: 'var(--accent)' }}>
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{user.firstName} {user.lastName}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text3)' }}>You · 0 sessions</div>
                    </div>
                    <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                  </div>
                )}
              </div>
            ) : leaders.map((entry, i) => (
              <motion.button
                key={entry.user.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 text-left transition-colors group ${entry.user.id === user?.id ? 'bg-accent/[0.05]' : 'hover:bg-white/[0.03]'}`}
              >
                <span className={`font-display text-[13px] font-bold w-5 text-center flex-shrink-0 ${rankStyle(entry.rank)}`}>
                  #{entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {entry.user.firstName[0]}{entry.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium flex items-center gap-2 flex-wrap">
                    <span className="truncate">{entry.user.firstName} {entry.user.lastName}</span>
                    {entry.user.id === user?.id && <span className="text-[10px] text-accent font-semibold flex-shrink-0">You</span>}
                  </div>
                  <div className="text-[11px] text-white/55">{entry.sessionCount} sessions</div>
                </div>
                <div className="w-24 hidden sm:block flex-shrink-0">
                  <div className="progress-bar">
                    <div className="progress-fill bg-accent" style={{ width: `${entry.avgScore}%` }} />
                  </div>
                </div>
                <div className="font-display text-[16px] font-bold text-accent-3 w-10 text-right flex-shrink-0">{entry.avgScore}</div>
                <ChevronLeft size={12} className="rotate-180 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-center mb-6">
            <div className="font-display text-5xl font-black text-accent mb-1">
              #{myRank || '—'}
            </div>
            <div className="text-sm text-white/80">Your current rank</div>
            {myRank > 0 && leaders.length > 0 && (
              <div className="text-xs text-accent-3 mt-1">Top {Math.round((myRank / leaders.length) * 100)}%</div>
            )}
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-[10px] bg-accent/[0.08] border border-accent/[0.15]">
              <div className="text-[11px] font-semibold text-accent mb-1">To reach next rank</div>
              <p className="text-[12px] text-white/75">Complete 3 more sessions with 75+ score</p>
            </div>
            <div className="p-3 rounded-[10px] bg-white/[0.04] border border-white/[0.07]">
              <div className="text-[11px] font-semibold text-white/80 mb-1">Your best score</div>
              <div className="font-display text-xl font-bold">{myEntry?.avgScore ?? '—'}</div>
            </div>
            {myEntry && (
              <button
                onClick={() => setSelectedEntry(myEntry)}
                className="w-full py-2 rounded-[10px] text-[12px] font-semibold border transition-all hover:bg-accent/[0.12]"
                style={{ borderColor: 'rgba(91,111,255,0.25)', color: 'var(--accent)' }}
              >
                View my sessions
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
