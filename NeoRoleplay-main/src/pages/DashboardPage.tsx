// pitchiq/frontend/src/pages/DashboardPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, Users, Play, Trophy, Lightbulb, AlertTriangle,
  CheckCircle, Flame, Award, Zap,
} from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import {
  DashboardStats,
  DashboardFrameworkStat,
  DashboardRecentSession,
  TeamMemberSummary,
} from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/lib/store';
import clsx from 'clsx';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-accent-3';
  if (score >= 65) return 'text-accent-5';
  return 'text-accent-4';
}

function scoreHex(score: number) {
  if (score >= 80) return '#06D6A0';
  if (score >= 65) return '#FFD166';
  return '#FF6B6B';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Shared components ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: React.ReactNode;
  delay?: number;
}
function StatCard({ label, value, icon: Icon, color, sub, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="stat-card relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">{label}</span>
        <Icon size={14} className="text-white/20 mt-0.5" />
      </div>
      <div className="font-display text-[28px] font-bold tracking-tight leading-none mb-1.5">{value}</div>
      {sub && <div className="text-[11px] text-white/35">{sub}</div>}
    </motion.div>
  );
}

function SessionRow({
  session, showAgent, onClick, delay,
}: {
  session: DashboardRecentSession;
  showAgent?: boolean;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay ?? 0 }}
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors group"
    >
      <span className="text-xl flex-shrink-0">{session.personaEmoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium truncate group-hover:text-white transition-colors">
          {session.sessionType === 'PHONE_CALL' ? '📞' : '💻'} {session.personaName}
          {showAgent && (
            <span className="text-white/65"> · {session.userFirstName} {session.userLastName}</span>
          )}
        </div>
        <div className="text-[11px] text-white/35 mt-0.5">
          {session.endedAt
            ? formatDistanceToNow(new Date(session.endedAt), { addSuffix: true })
            : 'In progress'}
          {session.durationSeconds ? ` · ${Math.round(session.durationSeconds / 60)} min` : ''}
          {' · '}{session.framework}
        </div>
      </div>
      {session.totalScore != null && (
        <div className={clsx('font-display text-[16px] font-bold flex-shrink-0', scoreColor(session.totalScore))}>
          {Math.round(session.totalScore)}
        </div>
      )}
    </motion.div>
  );
}

function FrameworkPerformance({ stats }: { stats: DashboardFrameworkStat[] }) {
  if (!stats.length) return null;
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <span className="font-display text-[14px] font-bold">Framework Performance</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 md:gap-x-10">
        {stats.slice(0, 6).map(stat => {
          const score = Math.round(stat.avgScore ?? 0);
          const fill = scoreHex(score);
          return (
            <div key={stat.component}>
              <div className="flex justify-between items-center mb-1.5 text-[13px]">
                <span className="text-white/70">{stat.component}</span>
                <span className="font-semibold" style={{ color: fill }}>{score}/100</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${score}%`, background: fill }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickPractice({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <span className="font-display text-[14px] font-bold">Quick Practice</span>
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        {[
          { icon: '📞', label: 'Cold Call Blitz', duration: '3 min', color: 'text-accent-4' },
          { icon: '💻', label: 'Discovery Meeting', duration: '10 min', color: 'text-accent-3' },
          { icon: '🎯', label: 'Objection Handling', duration: '7 min', color: 'text-accent-5' },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => navigate('/practice')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.07] hover:border-white/10 transition-all text-left group"
          >
            <span className="text-base">{item.icon}</span>
            <span className="flex-1 text-[13px] font-medium text-white/70 group-hover:text-white transition-colors">{item.label}</span>
            <span className={clsx('text-[11px] font-medium', item.color)}>{item.duration}</span>
          </button>
        ))}
        <button
          onClick={() => navigate('/practice')}
          className="btn-primary w-full justify-center mt-1 py-2 text-[12.5px]"
        >
          + Custom Scenario
        </button>
      </div>
    </div>
  );
}

// ─── Agent view ────────────────────────────────────────────────────────────────

function AgentView({ stats, navigate }: { stats: DashboardStats; navigate: (p: string) => void }) {
  const ae = stats.agentExtra;
  const sorted = [...stats.frameworkStats].sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0));
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="This Week"
          value={ae?.sessionsThisWeek ?? 0}
          icon={Play}
          color="var(--accent)"
          sub={<span>sessions completed</span>}
        />
        <StatCard
          label="Avg Score"
          value={stats.avgScore != null ? Math.round(stats.avgScore) : '—'}
          icon={TrendingUp}
          color="var(--accent3)"
          sub={<span>/100 overall</span>}
          delay={0.07}
        />
        <StatCard
          label="Pass Rate"
          value={`${stats.passRate}%`}
          icon={Trophy}
          color="#7C3AED"
          sub={
            <span className={stats.passRate >= 70 ? 'text-accent-3' : 'text-accent-4'}>
              {stats.passRate >= 70 ? 'Above target' : 'Below target'}
            </span>
          }
          delay={0.14}
        />
        <StatCard
          label="Company Rank"
          value={ae?.rank ? `#${ae.rank}` : '—'}
          icon={Award}
          color="#FFD166"
          sub={
            ae?.streak
              ? (
                <span className="flex items-center gap-1">
                  <Flame size={10} className="text-accent-4" />
                  <span className="text-accent-4">{ae.streak} win streak</span>
                </span>
              )
              : <span>no active streak</span>
          }
          delay={0.21}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <span className="font-display text-[14px] font-bold">My Recent Sessions</span>
            <button onClick={() => navigate('/sessions')} className="text-[12px] text-accent hover:underline">
              View all →
            </button>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {stats.recentSessions.length === 0 ? (
              <div className="px-5 py-10 text-center text-white/30 text-sm">
                No sessions yet.{' '}
                <button onClick={() => navigate('/practice')} className="text-accent hover:underline">
                  Start your first one →
                </button>
              </div>
            ) : stats.recentSessions.map((s, i) => (
              <SessionRow
                key={s.id}
                session={s}
                onClick={() => navigate(`/sessions/${s.id}/feedback`)}
                delay={0.2 + i * 0.06}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <QuickPractice navigate={navigate} />

          <div className="card flex-1">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
              <Lightbulb size={14} className="text-accent-5" />
              <span className="font-display text-[14px] font-bold">Coaching Insights</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {weakest ? (
                <div className="p-3 rounded-[10px] bg-accent-4/[0.08] border border-accent-4/[0.15]">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle size={11} className="text-accent-4" />
                    <span className="text-[11px] font-semibold text-accent-4">Focus Area</span>
                    <span className="ml-auto text-[11px] font-bold text-accent-4">
                      {Math.round(weakest.avgScore ?? 0)}/100
                    </span>
                  </div>
                  <p className="text-[12px] text-white/60 leading-relaxed">
                    <strong className="text-white/80">{weakest.component}</strong> is your lowest-scoring area.
                    Dedicate your next few sessions to improving here.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-[10px] bg-white/[0.04] border border-white/[0.08]">
                  <p className="text-[12px] text-white/65">Complete more sessions to unlock insights.</p>
                </div>
              )}
              {strongest && strongest.component !== weakest?.component && (
                <div className="p-3 rounded-[10px] bg-accent-3/[0.08] border border-accent-3/[0.15]">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle size={11} className="text-accent-3" />
                    <span className="text-[11px] font-semibold text-accent-3">Strength</span>
                    <span className="ml-auto text-[11px] font-bold text-accent-3">
                      {Math.round(strongest.avgScore ?? 0)}/100
                    </span>
                  </div>
                  <p className="text-[12px] text-white/60 leading-relaxed">
                    <strong className="text-white/80">{strongest.component}</strong> is your top skill.
                    Keep leveraging it in your calls.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FrameworkPerformance stats={stats.frameworkStats} />
    </>
  );
}

// ─── Manager view ──────────────────────────────────────────────────────────────

function ManagerView({ stats, navigate }: { stats: DashboardStats; navigate: (p: string) => void }) {
  const me = stats.managerExtra;
  const topPerformer = me?.members[0];
  const inactive = me?.members.filter(m => m.sessionsThisWeek === 0) ?? [];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Sessions"
          value={stats.totalSessions}
          icon={Play}
          color="var(--accent)"
          sub={<span>across the team</span>}
        />
        <StatCard
          label="Team Avg Score"
          value={stats.avgScore != null ? Math.round(stats.avgScore) : '—'}
          icon={TrendingUp}
          color="var(--accent3)"
          sub={<span>/100 average</span>}
          delay={0.07}
        />
        <StatCard
          label="Pass Rate"
          value={`${stats.passRate}%`}
          icon={Trophy}
          color="#7C3AED"
          sub={
            <span className={stats.passRate >= 70 ? 'text-accent-3' : 'text-accent-4'}>
              {stats.passRate >= 70 ? 'On track' : 'Needs attention'}
            </span>
          }
          delay={0.14}
        />
        <StatCard
          label="Team Size"
          value={me?.teamSize ?? 0}
          icon={Users}
          color="var(--accent5)"
          sub={<span>active members</span>}
          delay={0.21}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <span className="font-display text-[14px] font-bold">Team Recent Activity</span>
            <button onClick={() => navigate('/sessions')} className="text-[12px] text-accent hover:underline">
              View all →
            </button>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {stats.recentSessions.length === 0 ? (
              <div className="px-5 py-10 text-center text-white/30 text-sm">No team sessions yet.</div>
            ) : stats.recentSessions.map((s, i) => (
              <SessionRow
                key={s.id}
                session={s}
                showAgent
                onClick={() => navigate(`/sessions/${s.id}/feedback`)}
                delay={0.2 + i * 0.06}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {topPerformer && (
            <div className="card">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                <Trophy size={13} className="text-accent-5" />
                <span className="font-display text-[14px] font-bold">Top Performer</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
                    {topPerformer.firstName[0]}{topPerformer.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold truncate">
                      {topPerformer.firstName} {topPerformer.lastName}
                    </div>
                    <div className="text-[11px] text-white/65">{topPerformer.sessionsThisWeek} sessions this week</div>
                  </div>
                  {topPerformer.avgScore != null && (
                    <div className={clsx('font-display text-[20px] font-bold shrink-0', scoreColor(topPerformer.avgScore))}>
                      {Math.round(topPerformer.avgScore)}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-white/30">{topPerformer.sessionCount} total sessions</div>
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div className="card flex-1">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                <Zap size={13} className="text-accent-4" />
                <span className="font-display text-[14px] font-bold">Needs a Nudge</span>
                <span className="ml-auto text-[11px] text-white/30">{inactive.length} members</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {inactive.slice(0, 5).map((m: TeamMemberSummary, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] font-bold text-white/50 shrink-0">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-white/70 truncate">{m.firstName} {m.lastName}</div>
                      <div className="text-[10.5px] text-white/30">{m.sessionCount} total · 0 this week</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {!topPerformer && inactive.length === 0 && (
            <div className="card p-6 text-center text-white/30 text-sm">No team data yet.</div>
          )}
        </div>
      </div>

      <FrameworkPerformance stats={stats.frameworkStats} />
    </>
  );
}

// ─── Admin view ────────────────────────────────────────────────────────────────

function AdminView({ stats, navigate }: { stats: DashboardStats; navigate: (p: string) => void }) {
  const me = stats.managerExtra;
  const topMembers = me?.members.slice(0, 5) ?? [];
  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Sessions"
          value={stats.totalSessions}
          icon={Play}
          color="var(--accent)"
          sub={<span>company-wide</span>}
        />
        <StatCard
          label="Avg Score"
          value={stats.avgScore != null ? Math.round(stats.avgScore) : '—'}
          icon={TrendingUp}
          color="var(--accent3)"
          sub={<span>/100 overall</span>}
          delay={0.07}
        />
        <StatCard
          label="Active Agents"
          value={stats.activeUsers}
          icon={Users}
          color="var(--accent5)"
          sub={<span>in the company</span>}
          delay={0.14}
        />
        <StatCard
          label="Pass Rate"
          value={`${stats.passRate}%`}
          icon={Trophy}
          color="#7C3AED"
          sub={
            <span className={stats.passRate >= 70 ? 'text-accent-3' : 'text-accent-4'}>
              {stats.passRate >= 70 ? 'On track' : 'Below target'}
            </span>
          }
          delay={0.21}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <span className="font-display text-[14px] font-bold">Recent Sessions</span>
            <button onClick={() => navigate('/sessions')} className="text-[12px] text-accent hover:underline">
              View all →
            </button>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {stats.recentSessions.length === 0 ? (
              <div className="px-5 py-10 text-center text-white/30 text-sm">No sessions yet.</div>
            ) : stats.recentSessions.map((s, i) => (
              <SessionRow
                key={s.id}
                session={s}
                showAgent
                onClick={() => navigate(`/sessions/${s.id}/feedback`)}
                delay={0.2 + i * 0.06}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <Award size={13} className="text-accent-5" />
            <span className="font-display text-[14px] font-bold">Top Performers</span>
            <button
              onClick={() => navigate('/leaderboard')}
              className="ml-auto text-[12px] text-accent hover:underline"
            >
              Full board →
            </button>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {topMembers.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/30 text-sm">No data yet.</div>
            ) : topMembers.map((m: TeamMemberSummary, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="w-6 text-center text-base shrink-0">
                  {i < 3 ? MEDALS[i] : <span className="text-[13px] text-white/30 font-semibold">#{i + 1}</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.firstName} {m.lastName}</div>
                  <div className="text-[11px] text-white/35">{m.sessionCount} sessions</div>
                </div>
                {m.avgScore != null && (
                  <span className={clsx('text-[14px] font-bold font-display shrink-0', scoreColor(m.avgScore))}>
                    {Math.round(m.avgScore)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <FrameworkPerformance stats={stats.frameworkStats} />
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.dashboard().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!stats) return null;

  const role = user?.role;
  const subtitle =
    role === 'AGENT' ? 'Keep practicing — every session makes you better.' :
    role === 'MANAGER' ? "Here's your team's performance at a glance." :
    'Company-wide overview and performance metrics.';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">
            {greeting()}, {user?.firstName} 👋
          </h2>
          <p className="text-sm text-white/65 mt-0.5">{subtitle}</p>
        </div>
        <button onClick={() => navigate('/practice')} className="btn-primary gap-2">
          <Play size={14} /> Start Practice
        </button>
      </div>

      {role === 'AGENT' && <AgentView stats={stats} navigate={navigate} />}
      {role === 'MANAGER' && <ManagerView stats={stats} navigate={navigate} />}
      {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN') && <AdminView stats={stats} navigate={navigate} />}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-64 bg-white/[0.06] rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white/[0.04] rounded-lg border border-white/[0.06]" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 h-64 bg-white/[0.04] rounded-lg border border-white/[0.06]" />
        <div className="h-64 bg-white/[0.04] rounded-lg border border-white/[0.06]" />
      </div>
    </div>
  );
}
