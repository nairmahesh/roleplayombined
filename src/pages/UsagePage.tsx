import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, DollarSign, Zap, Clock, Users, RefreshCw, CreditCard as Edit2, Check, X, ChevronDown, ChevronUp, Activity, Building2, Lock, Clock as Unlock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { usageApi, UsageSummary, UserUsageStat, PlatformUsageSummary } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import clsx from 'clsx';

const SERVICE_LABELS: Record<string, { label: string; color: string }> = {
  gemini:             { label: 'Gemini AI',         color: '#5B6FFF' },
  elevenlabs_tts:     { label: 'ElevenLabs TTS',    color: '#06D6A0' },
  elevenlabs_convai:  { label: 'ElevenLabs ConvAI', color: '#FFD166' },
};

const PERIOD_OPTIONS = [7, 14, 30, 90] as const;
type Period = typeof PERIOD_OPTIONS[number];

function fmt$(n: number, decimals = 2) { return `$${n.toFixed(decimals)}`; }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

// ── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      <div>
        <div className="font-display text-[24px] font-bold leading-none">{value}</div>
        {sub && <div className="text-[11px] text-white/50 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ── User cap editor modal ─────────────────────────────────────────────────────
function CapEditor({ user, onSave, onClose }: {
  user: UserUsageStat;
  onSave: (caps: { sessionCap: number | null; minutesCap: number | null; tokensCap: number | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [sessionCap, setSessionCap] = useState(user.sessionCap !== null ? String(user.sessionCap) : '');
  const [minutesCap, setMinutesCap] = useState(user.minutesCap !== null ? String(user.minutesCap) : '');
  const [tokensCap, setTokensCap]   = useState(user.tokensCap !== null ? String(user.tokensCap) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        sessionCap: sessionCap.trim() ? parseInt(sessionCap) : null,
        minutesCap: minutesCap.trim() ? parseInt(minutesCap) : null,
        tokensCap:  tokensCap.trim()  ? parseInt(tokensCap)  : null,
      });
      toast.success('Caps updated');
      onClose();
    } catch {
      toast.error('Failed to save caps');
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-bg-2 border border-white/10 rounded-[18px] p-6 w-full max-w-sm shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col gap-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display font-bold text-[15px]">Usage Caps</h3>
            <p className="text-[12px] text-white/55 mt-0.5">{user.firstName} {user.lastName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={15} /></button>
        </div>

        <p className="text-[12px] text-white/60 -mt-1">
          Leave a field blank for unlimited. Caps reset monthly.
        </p>

        {[
          { label: 'Max sessions / month', value: sessionCap, set: setSessionCap, placeholder: 'e.g. 50', current: user.sessions },
          { label: 'Max call minutes / month', value: minutesCap, set: setMinutesCap, placeholder: 'e.g. 200', current: user.callMinutes },
          { label: 'Max AI tokens / month', value: tokensCap, set: setTokensCap, placeholder: 'e.g. 100000', current: user.tokensUsed },
        ].map(({ label, value, set, placeholder, current }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={placeholder}
                className="input-base flex-1 text-[13px]"
              />
              {value && (
                <button onClick={() => set('')} className="text-white/30 hover:text-white/60">
                  <Unlock size={12} />
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-white/35">Current usage: {fmtK(current)}</p>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-[10px] text-[13px] text-white/60 hover:text-white border border-white/10 hover:bg-white/[0.04] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-[10px] text-[13px] font-semibold bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Caps'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── User usage row ────────────────────────────────────────────────────────────
function UserRow({ stat, canEdit, onEdit }: {
  stat: UserUsageStat; canEdit: boolean; onEdit: () => void;
}) {
  const sessionPct  = stat.sessionCap  ? Math.min(100, (stat.sessions    / stat.sessionCap)  * 100) : null;
  const minutesPct  = stat.minutesCap  ? Math.min(100, (stat.callMinutes / stat.minutesCap)  * 100) : null;
  const tokensPct   = stat.tokensCap   ? Math.min(100, (stat.tokensUsed  / stat.tokensCap)   * 100) : null;

  const atRisk = (pct: number | null) => pct !== null && pct >= 80;

  const ROLE_CLS: Record<string, string> = {
    SUPER_ADMIN:   'text-amber-300 bg-amber-300/10 border-amber-300/20',
    COMPANY_ADMIN: 'text-sky-300 bg-sky-300/10 border-sky-300/20',
    MANAGER:       'text-accent-3 bg-accent-3/10 border-accent-3/20',
    AGENT:         'text-white/60 bg-white/[0.05] border-white/10',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[11px] border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      {/* Identity */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold bg-accent/10 text-accent border border-accent/20">
        {stat.firstName[0]}{stat.lastName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold truncate">{stat.firstName} {stat.lastName}</span>
          <span className={clsx('text-[9.5px] px-1.5 py-0.5 rounded border font-medium', ROLE_CLS[stat.role] ?? ROLE_CLS.AGENT)}>
            {stat.role.replace('_', ' ')}
          </span>
        </div>
        <div className="text-[11px] text-white/40 truncate">{stat.email}</div>
      </div>

      {/* Usage metrics */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
        {[
          { label: 'Sessions', val: stat.sessions, cap: stat.sessionCap, pct: sessionPct },
          { label: 'Minutes',  val: stat.callMinutes, cap: stat.minutesCap, pct: minutesPct },
          { label: 'Tokens',   val: stat.tokensUsed,  cap: stat.tokensCap,  pct: tokensPct },
        ].map(({ label, val, cap, pct }) => (
          <div key={label} className="text-center w-20">
            <div className="text-[10px] text-white/40 mb-0.5">{label}</div>
            <div className={clsx('text-[13px] font-semibold font-mono', atRisk(pct) && 'text-amber-400')}>
              {fmtK(val)}
              {cap && <span className="text-[10px] text-white/30">/{fmtK(cap)}</span>}
            </div>
            {pct !== null && (
              <div className="mt-1 h-1 rounded-full bg-white/[0.08] overflow-hidden w-full">
                <div
                  className={clsx('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-accent-3')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {!cap && <div className="text-[9px] text-white/20 mt-0.5">unlimited</div>}
          </div>
        ))}
        <div className="text-center w-16">
          <div className="text-[10px] text-white/40 mb-0.5">Cost</div>
          <div className="text-[13px] font-semibold font-mono text-accent-5">{fmt$(stat.costUsd)}</div>
        </div>
      </div>

      {/* Edit caps */}
      {canEdit && (
        <button
          onClick={onEdit}
          title="Set usage caps"
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-[8px] border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-colors flex-shrink-0"
        >
          <Lock size={11} />
          <span className="hidden md:inline">Set Caps</span>
        </button>
      )}
    </div>
  );
}

// ── Daily trend chart ─────────────────────────────────────────────────────────
function TrendChart({ data }: { data: { _id: string; costUsd: number; sessions: number }[] }) {
  const [metric, setMetric] = useState<'cost' | 'sessions'>('cost');
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[13px] font-bold">Daily Trend</h3>
        <div className="flex gap-1 bg-white/[0.04] rounded-[8px] p-0.5">
          {(['cost', 'sessions'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={clsx('px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors', metric === m ? 'bg-accent/20 text-accent' : 'text-white/50 hover:text-white/80')}
            >
              {m === 'cost' ? 'Cost' : 'Sessions'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5B6FFF" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#5B6FFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="_id" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false}
            tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false}
            tickFormatter={v => metric === 'cost' ? `$${v.toFixed(2)}` : String(v)} />
          <Tooltip
            contentStyle={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            formatter={(v: number) => [metric === 'cost' ? fmt$(v, 4) : v, metric === 'cost' ? 'Cost' : 'Sessions']}
          />
          <Area
            type="monotone"
            dataKey={metric === 'cost' ? 'costUsd' : 'sessions'}
            stroke="#5B6FFF" strokeWidth={2}
            fill="url(#trendGrad)"
            dot={false} activeDot={{ r: 4, fill: '#5B6FFF' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── SuperAdmin margin panel ───────────────────────────────────────────────────
function MarginPanel({ data }: { data: PlatformUsageSummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-amber-400/10 flex items-center justify-center">
            <TrendingUp size={13} className="text-amber-400" />
          </div>
          <span className="font-display text-[14px] font-bold">Revenue vs Actual Cost</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-semibold">
            Super Admin Only
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-5 flex flex-col gap-5">
              {/* Margin tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Actual API Cost', value: fmt$(data.actualCostUsd), sub: 'What you pay APIs', color: '#FF6B6B' },
                  { label: 'Billed to Clients', value: fmt$(data.billedCostUsd), sub: 'Plan pricing revenue', color: '#06D6A0' },
                  { label: 'Gross Margin', value: fmt$(data.marginUsd), sub: 'Revenue minus cost', color: '#FFD166' },
                  { label: 'Margin %', value: `${data.marginPct.toFixed(1)}%`, sub: 'Gross margin ratio', color: '#5B6FFF' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="p-4 rounded-[12px] border border-white/[0.07] bg-white/[0.02] text-center">
                    <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">{label}</div>
                    <div className="font-display text-[20px] font-bold" style={{ color }}>{value}</div>
                    <div className="text-[10.5px] text-white/35 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>

              {/* Margin bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/40">Cost vs Revenue split</span>
                  <span className="text-[11px] text-white/40 font-mono">{data.marginPct.toFixed(1)}% margin</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-red-400/70 transition-all"
                    style={{ width: `${(data.actualCostUsd / data.billedCostUsd) * 100}%` }}
                    title={`API cost: ${fmt$(data.actualCostUsd)}`}
                  />
                  <div className="h-full bg-accent-3/60 flex-1" title={`Margin: ${fmt$(data.marginUsd)}`} />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[10.5px] text-white/40"><span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />API Cost</span>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-white/40"><span className="w-2.5 h-2.5 rounded-full bg-accent-3/60" />Margin</span>
                </div>
              </div>

              {/* By company */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">By Company</div>
                <div className="flex flex-col gap-1.5">
                  {data.byCompany.map(c => (
                    <div key={c.companyId} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02]">
                      <Building2 size={13} className="text-white/30 flex-shrink-0" />
                      <span className="flex-1 text-[13px] font-medium text-white/80 truncate">{c.companyName}</span>
                      <span className="text-[11px] text-white/40 tabular-nums">{c.sessions} sessions</span>
                      <span className="text-[12px] font-mono text-red-400/70 w-14 text-right">{fmt$(c.costUsd)}</span>
                      <span className="text-[10px] text-white/25">vs</span>
                      <span className="text-[12px] font-mono text-accent-3/80 w-14 text-right">{fmt$(c.billedUsd)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-white/25 mt-2 text-right">
                  API cost → Billed revenue
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function UsagePage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin  = user?.role === 'SUPER_ADMIN';
  const isAdmin       = user?.role === 'COMPANY_ADMIN' || isSuperAdmin;

  const [period, setPeriod]         = useState<Period>(30);
  const [summary, setSummary]       = useState<UsageSummary | PlatformUsageSummary | null>(null);
  const [userStats, setUserStats]   = useState<UserUsageStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editUser, setEditUser]     = useState<UserUsageStat | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, users] = await Promise.all([
        isSuperAdmin ? usageApi.getPlatformSummary(period) : usageApi.getSummary(period),
        isAdmin ? usageApi.getUserStats(period) : Promise.resolve([]),
      ]);
      setSummary(sum);
      setUserStats(users);
    } catch {
      toast.error('Failed to load usage data');
    } finally { setLoading(false); }
  }, [period, isSuperAdmin, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleSaveCaps = async (
    userId: string,
    caps: { sessionCap: number | null; minutesCap: number | null; tokensCap: number | null },
  ) => {
    await usageApi.updateUserCap(userId, caps);
    setUserStats(prev => prev.map(u => u.userId === userId ? { ...u, ...caps } : u));
  };

  const totals = summary?.totals;

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold">Usage &amp; Costs</h2>
          <p className="text-[12.5px] text-white/55 mt-0.5">
            {isSuperAdmin ? 'Platform-wide API usage, cost vs revenue, and per-company breakdown' : 'Team AI usage, token consumption, and per-user caps'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/[0.04] rounded-[8px] p-0.5">
            {PERIOD_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={clsx('px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium transition-colors', period === d ? 'bg-accent/20 text-accent' : 'text-white/50 hover:text-white/80')}
              >
                {d}d
              </button>
            ))}
          </div>
          <button onClick={load} className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Total Cost"
              value={fmt$(totals?.totalCostUsd ?? 0)}
              sub={`Last ${period} days`}
              icon={DollarSign}
              accent="#FFD166"
            />
            <StatTile
              label="AI Tokens"
              value={fmtK((totals?.geminiPromptTokens ?? 0) + (totals?.geminiOutputTokens ?? 0))}
              sub={`${fmtK(totals?.geminiPromptTokens ?? 0)} in · ${fmtK(totals?.geminiOutputTokens ?? 0)} out`}
              icon={Zap}
              accent="#5B6FFF"
            />
            <StatTile
              label="Call Minutes"
              value={`${(totals?.convaiMinutes ?? 0).toFixed(1)}`}
              sub={`${totals?.callCount ?? 0} sessions`}
              icon={Clock}
              accent="#06D6A0"
            />
            <StatTile
              label="API Requests"
              value={String(totals?.requestCount ?? 0)}
              sub={`${totals?.ttsCharacters?.toLocaleString() ?? 0} TTS chars`}
              icon={Activity}
              accent="#FF6B6B"
            />
          </div>

          {/* Trend chart + by-service breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              {summary?.dailyTrend && summary.dailyTrend.length > 0 && (
                <TrendChart data={summary.dailyTrend} />
              )}
            </div>
            <div className="card p-5 flex flex-col gap-3">
              <h3 className="font-display text-[13px] font-bold">By Service</h3>
              {summary?.byService.map(s => {
                const cfg = SERVICE_LABELS[s._id];
                const pct = totals?.totalCostUsd ? (s.costUsd / totals.totalCostUsd) * 100 : 0;
                return (
                  <div key={s._id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium" style={{ color: cfg?.color ?? '#fff' }}>
                        {cfg?.label ?? s._id}
                      </span>
                      <span className="text-[12px] font-mono font-semibold">{fmt$(s.costUsd)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: cfg?.color ?? '#5B6FFF' }}
                      />
                    </div>
                    <div className="text-[10.5px] text-white/35">{s.requestCount} requests · {pct.toFixed(0)}% of spend</div>
                  </div>
                );
              })}
              <div className="border-t border-white/[0.06] pt-3 mt-1 text-[10.5px] text-white/30 leading-relaxed">
                Pricing: Gemini ${summary?.pricing.geminiInputPerMToken}/M in · ${summary?.pricing.geminiOutputPerMToken}/M out · TTS ${summary?.pricing.ttsPerKChars}/K chars · ConvAI ${summary?.pricing.convaiPerMinute}/min
              </div>
            </div>
          </div>

          {/* SuperAdmin: margin panel */}
          {isSuperAdmin && summary && 'marginUsd' in summary && (
            <MarginPanel data={summary as PlatformUsageSummary} />
          )}

          {/* Admin: per-user breakdown with caps */}
          {isAdmin && userStats.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-accent/70" />
                  <span className="font-display text-[14px] font-bold">Per-User Breakdown</span>
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">{userStats.length} users</span>
                </div>
                <div className="hidden sm:flex items-center gap-5 text-[10px] font-semibold uppercase tracking-wider text-white/30 pr-16">
                  <span className="w-20 text-center">Sessions</span>
                  <span className="w-20 text-center">Minutes</span>
                  <span className="w-20 text-center">Tokens</span>
                  <span className="w-16 text-center">Cost</span>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {userStats.map(stat => (
                  <UserRow
                    key={stat.userId}
                    stat={stat}
                    canEdit={isAdmin}
                    onEdit={() => setEditUser(stat)}
                  />
                ))}
              </div>
              <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center justify-between text-[11px] text-white/30">
                  <span>Click "Set Caps" on any user to limit their monthly usage</span>
                  <span className="font-mono font-semibold text-white/50">
                    Total: {fmt$(userStats.reduce((a, u) => a + u.costUsd, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tokens breakdown card */}
          <div className="card p-5">
            <h3 className="font-display text-[13px] font-bold mb-4 flex items-center gap-2">
              <BarChart3 size={13} className="text-accent/60" />
              Token Usage Detail
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Gemini Input', value: fmtK(totals?.geminiPromptTokens ?? 0), sub: 'Prompt tokens', color: '#5B6FFF' },
                { label: 'Gemini Output', value: fmtK(totals?.geminiOutputTokens ?? 0), sub: 'Completion tokens', color: '#9BA8FF' },
                { label: 'TTS Chars', value: fmtK(totals?.ttsCharacters ?? 0), sub: 'Characters synthesised', color: '#06D6A0' },
                { label: 'ConvAI Min', value: `${(totals?.convaiMinutes ?? 0).toFixed(1)}`, sub: 'Conversation minutes', color: '#FFD166' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="p-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">{label}</div>
                  <div className="font-display text-[18px] font-bold" style={{ color }}>{value}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Cap editor modal */}
      <AnimatePresence>
        {editUser && (
          <CapEditor
            user={editUser}
            onSave={caps => handleSaveCaps(editUser.userId, caps)}
            onClose={() => setEditUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
