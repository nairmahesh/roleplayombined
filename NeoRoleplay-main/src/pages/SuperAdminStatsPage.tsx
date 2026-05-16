import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, BarChart3, Activity, TrendingUp } from 'lucide-react';
import { superadminApi } from '@/lib/api';
import { PlatformStats } from '@/types';
import clsx from 'clsx';

export function SuperAdminStatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminApi.getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  const cards = stats ? [
    {
      label: 'Total Companies',
      value: stats.totalCompanies,
      sub: `${stats.activeCompanies} active`,
      icon: Building2,
      color: 'from-accent to-accent-2',
      textColor: 'text-accent',
    },
    {
      label: 'Total Users',
      value: stats.totalUsers,
      sub: `${stats.activeUsersThisMonth} active this month`,
      icon: Users,
      color: 'from-purple-600 to-purple-400',
      textColor: 'text-purple-400',
    },
    {
      label: 'Total Sessions',
      value: stats.totalSessions,
      sub: 'all time',
      icon: BarChart3,
      color: 'from-accent-3 to-accent-5',
      textColor: 'text-accent-3',
    },
    {
      label: 'Active Users (30d)',
      value: stats.activeUsersThisMonth,
      sub: `${stats.totalUsers > 0 ? Math.round((stats.activeUsersThisMonth / stats.totalUsers) * 100) : 0}% of all users`,
      icon: Activity,
      color: 'from-accent-5 to-accent-4',
      textColor: 'text-accent-5',
    },
  ] : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-bold">Platform Overview</h2>
        <p className="text-sm text-white/65 mt-0.5">System-wide statistics across all companies</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card p-6"
          >
            <div className={clsx(
              'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4',
              card.color
            )}>
              <card.icon size={18} className="text-white" />
            </div>
            <div className={clsx('font-display text-4xl font-bold mb-1', card.textColor)}>
              {card.value.toLocaleString()}
            </div>
            <div className="font-semibold text-[14px] mb-0.5">{card.label}</div>
            <div className="text-xs text-white/35">{card.sub}</div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
        className="card p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={15} className="text-accent" />
          <h3 className="font-display text-[14px] font-bold">Platform Health</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              label: 'Company Activation Rate',
              value: stats && stats.totalCompanies > 0
                ? `${Math.round((stats.activeCompanies / stats.totalCompanies) * 100)}%`
                : '—',
              desc: 'Active vs total companies',
            },
            {
              label: 'User Engagement (30d)',
              value: stats && stats.totalUsers > 0
                ? `${Math.round((stats.activeUsersThisMonth / stats.totalUsers) * 100)}%`
                : '—',
              desc: 'Users active in last 30 days',
            },
            {
              label: 'Sessions per User',
              value: stats && stats.totalUsers > 0
                ? (stats.totalSessions / stats.totalUsers).toFixed(1)
                : '—',
              desc: 'Average sessions all-time',
            },
          ].map(m => (
            <div key={m.label}>
              <div className="font-display text-3xl font-bold text-accent mb-1">{m.value}</div>
              <div className="text-[13px] font-semibold mb-0.5">{m.label}</div>
              <div className="text-[11px] text-white/35">{m.desc}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
