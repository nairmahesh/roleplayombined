// pitchiq/frontend/src/pages/LeaderboardPage.tsx

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal } from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { LeaderboardEntry } from '@/types';
import { useAuthStore } from '@/lib/store';

export function LeaderboardPage() {
  const user = useAuthStore(s => s.user);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsApi.leaderboard(period).then(setLeaders).finally(() => setLoading(false));
  }, [period]);

  const myRank = leaders.findIndex(l => l.user.id === user?.id) + 1;
  const myEntry = leaders.find(l => l.user.id === user?.id);

  const rankStyle = (rank: number) => {
    if (rank === 1) return 'text-accent-5';
    if (rank === 2) return 'text-[#888]';
    if (rank === 3) return 'text-[#B87333]';
    return '';
  };

  const rankInlineStyle = (rank: number): React.CSSProperties =>
    rank > 3 ? { color: 'var(--text3)' } : {};

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl font-bold flex items-center gap-2"><Trophy size={18} className="text-accent-5" /> Leaderboard</h2>
        <div className="flex gap-2">
          {(['all', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-all ${period === p ? 'bg-accent border-accent text-white' : ''}`}
              style={period !== p ? { borderColor: 'var(--border2)', color: 'var(--text2)' } : undefined}
            >
              {p === 'all' ? 'All Time' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 card">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="font-display text-[14px] font-bold">Company Rankings</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
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
              <div className="py-12 text-center text-sm" style={{ color: 'var(--text3)' }}>No sessions completed yet.</div>
            ) : leaders.map((entry, i) => (
              <motion.div
                key={entry.user.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 transition-colors ${entry.user.id === user?.id ? 'bg-accent/[0.05]' : ''}`}
                style={entry.user.id !== user?.id ? undefined : undefined}
                onMouseEnter={e => { if (entry.user.id !== user?.id) e.currentTarget.style.background = 'rgba(128,128,128,0.04)'; }}
                onMouseLeave={e => { if (entry.user.id !== user?.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  className={`font-display text-[13px] font-bold w-5 text-center flex-shrink-0 ${rankStyle(entry.rank)}`}
                  style={rankInlineStyle(entry.rank)}
                >
                  #{entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {entry.user.firstName[0]}{entry.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium flex items-center gap-2 flex-wrap" style={{ color: 'var(--text)' }}>
                    <span className="truncate">{entry.user.firstName} {entry.user.lastName}</span>
                    {entry.user.id === user?.id && <span className="text-[10px] text-accent font-semibold flex-shrink-0">You</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{entry.sessionCount} sessions</div>
                </div>
                <div className="w-24 hidden sm:block flex-shrink-0">
                  <div className="progress-bar">
                    <div className="progress-fill bg-accent" style={{ width: `${entry.avgScore}%` }} />
                  </div>
                </div>
                <div className="font-display text-[16px] font-bold text-accent-3 w-10 text-right flex-shrink-0">{entry.avgScore}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-center mb-6">
            <div className="font-display text-5xl font-black text-accent mb-1">
              #{myRank || '—'}
            </div>
            <div className="text-sm" style={{ color: 'var(--text2)' }}>Your current rank</div>
            {myRank > 0 && <div className="text-xs text-accent-3 mt-1">Top {Math.round((myRank / leaders.length) * 100)}%</div>}
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-[10px] bg-accent/[0.08] border border-accent/[0.15]">
              <div className="text-[11px] font-semibold text-accent mb-1">To reach next rank</div>
              <p className="text-[12px]" style={{ color: 'var(--text2)' }}>Complete 3 more sessions with 75+ score</p>
            </div>
            <div className="p-3 rounded-[10px] border" style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text2)' }}>Your avg score</div>
              <div
                className="font-display text-xl font-bold"
                style={{ color: myEntry ? (myEntry.avgScore >= 80 ? 'var(--accent3)' : myEntry.avgScore >= 65 ? 'var(--accent5)' : 'var(--accent4)') : 'var(--text3)' }}
              >
                {myEntry ? myEntry.avgScore : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
