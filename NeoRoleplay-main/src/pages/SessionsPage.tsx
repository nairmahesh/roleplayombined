// pitchiq/frontend/src/pages/SessionsPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sessionsApi } from '@/lib/api';
import { Session, FRAMEWORK_INFO, DIFFICULTY_CONFIG } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { Phone, Monitor, Download } from 'lucide-react';
import clsx from 'clsx';

export function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    sessionsApi.list({ status: 'COMPLETED', limit: 50 }).then(d => setSessions(d.sessions)).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.framework === filter);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">All Sessions</h2>
          <p className="text-sm text-white/65 mt-0.5">{sessions.length} completed sessions</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-base w-auto text-xs py-1.5 px-3"
          >
            <option value="all">All Frameworks</option>
            {Object.keys(FRAMEWORK_INFO).map(fw => (
              <option key={fw} value={fw}>{FRAMEWORK_INFO[fw as keyof typeof FRAMEWORK_INFO].label}</option>
            ))}
          </select>
          <button className="btn-ghost gap-1.5 text-xs"><Download size={12} /> Export</button>
        </div>
      </div>

      <div className="card">
        <div className="hidden md:grid text-[11px] font-semibold text-white/30 uppercase tracking-wider px-5 py-3 border-b border-white/[0.06]"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 100px' }}>
          <div>Session</div><div>Framework</div><div>Duration</div><div>Date</div><div className="text-right">Score</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-white/65 text-sm">No sessions yet. <button onClick={() => navigate('/practice')} className="text-accent hover:underline">Start your first one →</button></p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((session, i) => {
              const score = session.totalScore;
              const scoreColor = score == null ? 'text-white/30' : score >= 80 ? 'text-accent-3' : score >= 65 ? 'text-accent-5' : 'text-accent-4';
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/sessions/${session.id}/feedback`)}
                  className="cursor-pointer hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Mobile card view */}
                  <div className="md:hidden flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base flex-shrink-0">
                        {session.type === 'PHONE_CALL' ? '📞' : '💻'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate group-hover:text-white transition-colors">
                          {session.scenarioConfig?.displayName || session.persona?.name || 'Unknown Persona'}
                        </div>
                        <div className="text-[11px] text-white/30">
                          {FRAMEWORK_INFO[session.framework]?.label}
                        </div>
                      </div>
                    </div>
                    <div className={clsx('font-display text-[16px] font-bold flex-shrink-0', scoreColor)}>
                      {score ?? '—'}
                    </div>
                  </div>
                  {/* Desktop grid row */}
                  <div className="hidden md:grid items-center px-5 py-3.5" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 100px' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base flex-shrink-0">
                        {session.type === 'PHONE_CALL' ? '📞' : '💻'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate group-hover:text-white transition-colors">
                          {session.scenarioConfig?.displayName || session.persona?.name || 'Unknown Persona'}
                        </div>
                        <div className="text-[11px] text-white/30">
                          {session.scenarioConfig?.displayTitle || session.persona?.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-[12.5px] text-white/60">{FRAMEWORK_INFO[session.framework]?.label}</div>
                    <div className="text-[12.5px] text-white/65 font-mono">
                      {session.durationSeconds ? `${Math.floor(session.durationSeconds/60)}:${String(session.durationSeconds%60).padStart(2,'0')}` : '—'}
                    </div>
                    <div className="text-[12px] text-white/65">
                      {session.endedAt ? formatDistanceToNow(new Date(session.endedAt), { addSuffix: true }) : '—'}
                    </div>
                    <div className={clsx('font-display text-[16px] font-bold text-right', scoreColor)}>
                      {score ?? '—'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
