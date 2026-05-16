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

  const rankStyle = (rank: number) => {
    if (rank === 1) return 'text-accent-5';
    if (rank === 2) return 'text-[#aaa]';
    if (rank === 3) return 'text-[#cd7f32]';
    return 'text-white/30';
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold flex items-center gap-2"><Trophy size={18} className="text-accent-5" /> Leaderboard</h2>
        <div className="flex gap-2">
          {(['all', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-all ${period === p ? 'bg-accent border-accent text-white' : 'border-white/10 text-white/65 hover:text-white'}`}
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
              <div className="py-12 text-center text-white/30 text-sm">No sessions completed yet.</div>
            ) : leaders.map((entry, i) => (
              <motion.div
                key={entry.user.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-4 px-5 py-3.5 ${entry.user.id === user?.id ? 'bg-accent/[0.05]' : 'hover:bg-white/[0.02]'} transition-colors`}
              >
                <span className={`font-display text-[15px] font-bold w-5 text-center flex-shrink-0 ${rankStyle(entry.rank)}`}>
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {entry.user.firstName[0]}{entry.user.lastName[0]}
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium flex items-center gap-2">
                    {entry.user.firstName} {entry.user.lastName}
                    {entry.user.id === user?.id && <span className="text-[10px] text-accent font-semibold">You</span>}
                  </div>
                  <div className="text-[11px] text-white/30">{entry.sessionCount} sessions</div>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="progress-bar">
                    <div className="progress-fill bg-accent" style={{ width: `${entry.avgScore}%` }} />
                  </div>
                </div>
                <div className="font-display text-[16px] font-bold text-accent-3 w-10 text-right">{entry.avgScore}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-center mb-6">
            <div className="font-display text-5xl font-black text-accent mb-1">
              #{myRank || '—'}
            </div>
            <div className="text-sm text-white/65">Your current rank</div>
            {myRank > 0 && <div className="text-xs text-accent-3 mt-1">Top {Math.round((myRank / leaders.length) * 100)}%</div>}
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-[10px] bg-accent/[0.08] border border-accent/[0.15]">
              <div className="text-[11px] font-semibold text-accent mb-1">To reach next rank</div>
              <p className="text-[12px] text-white/60">Complete 3 more sessions with 75+ score</p>
            </div>
            <div className="p-3 rounded-[10px] bg-white/[0.04] border border-white/[0.07]">
              <div className="text-[11px] font-semibold text-white/65 mb-1">Your best score</div>
              <div className="font-display text-xl font-bold">—</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
