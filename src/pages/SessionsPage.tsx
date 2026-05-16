// pitchiq/frontend/src/pages/SessionsPage.tsx

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { sessionsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Session, User, FRAMEWORK_INFO } from '@/types';
import { formatDistanceToNow, isWithinInterval, subDays, startOfDay } from 'date-fns';
import {
  Phone, Monitor, Download, ClipboardList,
  Search, X, ChevronDown, MapPin, User as UserIcon,
  SlidersHorizontal, Calendar,
} from 'lucide-react';
import clsx from 'clsx';

type ScoreRange = 'all' | 'pass' | 'fail' | 'high';
type DateRange = 'all' | '7d' | '30d' | '90d';

interface Filters {
  search: string;
  userId: string;
  framework: string;
  sessionType: string;
  scoreRange: ScoreRange;
  dateRange: DateRange;
  location: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  userId: 'all',
  framework: 'all',
  sessionType: 'all',
  scoreRange: 'all',
  dateRange: 'all',
  location: 'all',
};

function scoreColor(score?: number) {
  if (score == null) return 'var(--text3)';
  if (score >= 80) return 'var(--accent3)';
  if (score >= 65) return 'var(--accent5)';
  return 'var(--accent4)';
}

function scoreBadgeStyle(score?: number): React.CSSProperties {
  if (score == null) return { color: 'var(--text3)' };
  if (score >= 80) return { background: 'rgba(6,214,160,0.1)', color: 'var(--accent3)', border: '1px solid rgba(6,214,160,0.2)' };
  if (score >= 65) return { background: 'rgba(255,209,102,0.1)', color: 'var(--accent5)', border: '1px solid rgba(255,209,102,0.2)' };
  return { background: 'rgba(255,107,107,0.1)', color: 'var(--accent4)', border: '1px solid rgba(255,107,107,0.2)' };
}

export function SessionsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore(s => ({ user: s.user }));
  const isAdmin = currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionData, userData] = await Promise.all([
          isAdmin
            ? sessionsApi.listAll({ status: 'COMPLETED', limit: 200 })
            : sessionsApi.list({ status: 'COMPLETED', limit: 200 }),
          isAdmin ? usersApi.list() : Promise.resolve([]),
        ]);
        setSessions(sessionData.sessions);
        if (Array.isArray(userData)) setTeamUsers(userData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin]);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    teamUsers.forEach(u => { if (u.location) locs.add(u.location); });
    if (currentUser?.location) locs.add(currentUser.location);
    return Array.from(locs).sort();
  }, [teamUsers, currentUser]);

  const userLocationMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamUsers.forEach(u => { if (u.location) map[u.id] = u.location; });
    if (currentUser?.id && currentUser.location) map[currentUser.id] = currentUser.location;
    return map;
  }, [teamUsers, currentUser]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const personaName = (s.scenarioConfig?.displayName || s.persona?.name || '').toLowerCase();
        const userName = `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.toLowerCase();
        if (!personaName.includes(q) && !userName.includes(q)) return false;
      }
      if (filters.userId !== 'all' && s.user?.id !== filters.userId) return false;
      if (filters.framework !== 'all' && s.framework !== filters.framework) return false;
      if (filters.sessionType !== 'all' && s.type !== filters.sessionType) return false;
      if (filters.scoreRange !== 'all') {
        const score = s.totalScore;
        if (filters.scoreRange === 'pass' && (score == null || score < 70)) return false;
        if (filters.scoreRange === 'fail' && (score == null || score >= 70)) return false;
        if (filters.scoreRange === 'high' && (score == null || score < 85)) return false;
      }
      if (filters.dateRange !== 'all') {
        const end = s.endedAt ? new Date(s.endedAt) : null;
        if (!end) return false;
        const days = filters.dateRange === '7d' ? 7 : filters.dateRange === '30d' ? 30 : 90;
        if (!isWithinInterval(end, { start: startOfDay(subDays(new Date(), days)), end: new Date() })) return false;
      }
      if (filters.location !== 'all') {
        const uid = s.user?.id;
        if (!uid || userLocationMap[uid] !== filters.location) return false;
      }
      return true;
    });
  }, [sessions, filters, userLocationMap]);

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => k !== 'search' && v !== 'all' && v !== ''
  ).length;

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const clearAllFilters = () => setFilters(DEFAULT_FILTERS);

  const avgScore = useMemo(() => {
    const scored = filtered.filter(s => s.totalScore != null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((a, s) => a + (s.totalScore ?? 0), 0) / scored.length);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold" style={{ color: 'var(--text)' }}>Call History</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            {loading ? 'Loading…' : `${filtered.length} of ${sessions.length} sessions`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border text-[12.5px] font-medium transition-all"
            style={showFilters
              ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(91,111,255,0.1)' }
              : { borderColor: 'var(--border2)', color: 'var(--text2)', background: 'transparent' }
            }
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                style={{ background: 'var(--accent)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border text-[12.5px] font-medium transition-all"
            style={{ borderColor: 'var(--border2)', color: 'var(--text2)', background: 'transparent' }}
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }} />
        <input
          type="text"
          placeholder="Search by rep name or persona…"
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-[10px] border text-[13px] outline-none transition-colors"
          style={{
            background: 'var(--input-bg)',
            borderColor: filters.search ? 'var(--accent)' : 'var(--border2)',
            color: 'var(--text)',
          }}
        />
        {filters.search && (
          <button
            onClick={() => setFilter('search', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text3)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Expandable filter bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: -8 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: -8 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="flex flex-wrap gap-2 p-4 rounded-[12px] border"
              style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}
            >
              {isAdmin && (
                <FilterSelect
                  icon={<UserIcon size={11} />}
                  label="Rep"
                  value={filters.userId}
                  onChange={v => setFilter('userId', v)}
                  options={[
                    { value: 'all', label: 'All Reps' },
                    ...teamUsers.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
                  ]}
                />
              )}
              {locations.length > 0 && (
                <FilterSelect
                  icon={<MapPin size={11} />}
                  label="Location"
                  value={filters.location}
                  onChange={v => setFilter('location', v)}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    ...locations.map(l => ({ value: l, label: l })),
                  ]}
                />
              )}
              <FilterSelect
                label="Framework"
                value={filters.framework}
                onChange={v => setFilter('framework', v)}
                options={[
                  { value: 'all', label: 'All Frameworks' },
                  ...Object.entries(FRAMEWORK_INFO).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
              />
              <FilterSelect
                icon={<Phone size={11} />}
                label="Type"
                value={filters.sessionType}
                onChange={v => setFilter('sessionType', v)}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'PHONE_CALL', label: 'Phone Call' },
                  { value: 'ONLINE_MEETING', label: 'Online Meeting' },
                ]}
              />
              <FilterSelect
                label="Score"
                value={filters.scoreRange}
                onChange={v => setFilter('scoreRange', v as ScoreRange)}
                options={[
                  { value: 'all', label: 'All Scores' },
                  { value: 'high', label: 'High (85+)' },
                  { value: 'pass', label: 'Pass (70+)' },
                  { value: 'fail', label: 'Fail (<70)' },
                ]}
              />
              <FilterSelect
                icon={<Calendar size={11} />}
                label="Date"
                value={filters.dateRange}
                onChange={v => setFilter('dateRange', v as DateRange)}
                options={[
                  { value: 'all', label: 'All Time' },
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '90d', label: 'Last 90 days' },
                ]}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors"
                  style={{ color: 'var(--accent4)' }}
                >
                  <X size={11} />
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      {(activeFilterCount > 0 || filters.search) && (
        <div className="flex flex-wrap gap-2 -mt-2">
          {filters.search && (
            <FilterChip label={`"${filters.search}"`} onRemove={() => setFilter('search', '')} />
          )}
          {filters.userId !== 'all' && (
            <FilterChip
              label={(() => { const u = teamUsers.find(u => u.id === filters.userId); return u ? `${u.firstName} ${u.lastName}` : filters.userId; })()}
              onRemove={() => setFilter('userId', 'all')}
            />
          )}
          {filters.location !== 'all' && (
            <FilterChip label={filters.location} onRemove={() => setFilter('location', 'all')} />
          )}
          {filters.framework !== 'all' && (
            <FilterChip
              label={FRAMEWORK_INFO[filters.framework as keyof typeof FRAMEWORK_INFO]?.label ?? filters.framework}
              onRemove={() => setFilter('framework', 'all')}
            />
          )}
          {filters.sessionType !== 'all' && (
            <FilterChip
              label={filters.sessionType === 'PHONE_CALL' ? 'Phone Call' : 'Online Meeting'}
              onRemove={() => setFilter('sessionType', 'all')}
            />
          )}
          {filters.scoreRange !== 'all' && (
            <FilterChip
              label={{ pass: 'Pass (70+)', fail: 'Fail (<70)', high: 'High (85+)' }[filters.scoreRange]}
              onRemove={() => setFilter('scoreRange', 'all')}
            />
          )}
          {filters.dateRange !== 'all' && (
            <FilterChip
              label={{ '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }[filters.dateRange]}
              onRemove={() => setFilter('dateRange', 'all')}
            />
          )}
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div
          className="hidden md:grid text-[11px] font-semibold uppercase tracking-wider px-5 py-3 border-b"
          style={{
            gridTemplateColumns: isAdmin ? '2fr 1.3fr 1fr 1fr 1fr 90px' : '2fr 1fr 1fr 1fr 90px',
            color: 'var(--text3)',
            borderColor: 'var(--border)',
          }}
        >
          <div>Session</div>
          {isAdmin && <div>Rep</div>}
          <div>Framework</div>
          <div>Duration</div>
          <div>Date</div>
          <div className="text-right">Score</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm" style={{ color: 'var(--text3)' }}>Loading sessions…</div>
        ) : filtered.length === 0 ? (
          <EmptyState hasData={sessions.length > 0} onClear={clearAllFilters} onNavigate={() => navigate('/practice')} />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                index={i}
                isAdmin={isAdmin}
                userLocationMap={userLocationMap}
                onClick={() => navigate(`/sessions/${session.id}/feedback`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between px-1 text-[12px]" style={{ color: 'var(--text3)' }}>
          <span>{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
          {avgScore != null && (
            <span>
              Avg score:{' '}
              <span className="font-semibold" style={{ color: scoreColor(avgScore) }}>
                {avgScore}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── SessionRow ────────────────────────────────────────────────────────────────

function SessionRow({
  session,
  index,
  isAdmin,
  userLocationMap,
  onClick,
}: {
  session: Session;
  index: number;
  isAdmin: boolean;
  userLocationMap: Record<string, string>;
  onClick: () => void;
}) {
  const score = session.totalScore;
  const TypeIcon = session.type === 'PHONE_CALL' ? Phone : Monitor;
  const personaName = session.scenarioConfig?.displayName || session.persona?.name || 'Unknown';
  const personaTitle = session.scenarioConfig?.displayTitle || session.persona?.title || '';
  const repName = session.user ? `${session.user.firstName} ${session.user.lastName}` : null;
  const repLocation = session.user?.id ? userLocationMap[session.user.id] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.15 }}
      onClick={onClick}
      className="cursor-pointer group"
      style={{ transition: 'background 0.12s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Mobile */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,111,255,0.12)' }}>
            <TypeIcon size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{personaName}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{FRAMEWORK_INFO[session.framework]?.label}</span>
              {repName && isAdmin && (
                <>
                  <span style={{ color: 'var(--border2)' }}>·</span>
                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{repName}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <span
          className="font-display text-[17px] font-bold flex-shrink-0"
          style={{ color: scoreColor(score) }}
        >
          {score ?? '—'}
        </span>
      </div>

      {/* Desktop */}
      <div
        className="hidden md:grid items-center px-5 py-3.5"
        style={{ gridTemplateColumns: isAdmin ? '2fr 1.3fr 1fr 1fr 1fr 90px' : '2fr 1fr 1fr 1fr 90px' }}
      >
        {/* Persona */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,111,255,0.12)' }}>
            <TypeIcon size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{personaName}</div>
            <div className="text-[11.5px] truncate" style={{ color: 'var(--text3)' }}>{personaTitle}</div>
          </div>
        </div>

        {/* Rep */}
        {isAdmin && (
          <div className="min-w-0 pr-3">
            {repName ? (
              <>
                <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text2)' }}>{repName}</div>
                {repLocation && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} style={{ color: 'var(--text3)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{repLocation}</span>
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--text3)' }}>—</span>
            )}
          </div>
        )}

        {/* Framework */}
        <div className="text-[12.5px]" style={{ color: 'var(--text2)' }}>
          {FRAMEWORK_INFO[session.framework]?.label ?? session.framework}
        </div>

        {/* Duration */}
        <div className="font-mono text-[12px]" style={{ color: 'var(--text2)' }}>
          {session.durationSeconds
            ? `${Math.floor(session.durationSeconds / 60)}:${String(session.durationSeconds % 60).padStart(2, '0')}`
            : '—'}
        </div>

        {/* Date */}
        <div className="text-[12px]" style={{ color: 'var(--text3)' }}>
          {session.endedAt ? formatDistanceToNow(new Date(session.endedAt), { addSuffix: true }) : '—'}
        </div>

        {/* Score badge */}
        <div className="flex justify-end">
          {score != null ? (
            <span
              className="inline-flex items-center justify-center w-12 h-7 rounded-[8px] text-[13px] font-bold font-display"
              style={scoreBadgeStyle(score)}
            >
              {score}
            </span>
          ) : (
            <span className="text-[13px] font-display" style={{ color: 'var(--text3)' }}>—</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ hasData, onClear, onNavigate }: { hasData: boolean; onClear: () => void; onNavigate: () => void }) {
  return (
    <div className="p-14 text-center flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--bg3)' }}>
        <ClipboardList size={22} style={{ color: 'var(--text3)' }} />
      </div>
      <div>
        <p className="font-medium text-sm" style={{ color: 'var(--text2)' }}>
          {hasData ? 'No sessions match your filters' : 'No sessions yet'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
          {hasData
            ? <button onClick={onClear} className="hover:underline" style={{ color: 'var(--accent)' }}>Clear filters</button>
            : <button onClick={onNavigate} className="hover:underline" style={{ color: 'var(--accent)' }}>Start your first session →</button>
          }
        </p>
      </div>
    </div>
  );
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon?: React.ReactNode;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const selected = options.find(o => o.value === value);
  const isActive = value !== 'all' && value !== '';

  return (
    <div className="relative inline-flex">
      <div
        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-[8px] border text-[12px] cursor-pointer select-none transition-all"
        style={isActive
          ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(91,111,255,0.1)' }
          : { borderColor: 'var(--border2)', color: 'var(--text2)', background: 'var(--bg4)' }
        }
      >
        {icon && <span className="opacity-70 flex-shrink-0">{icon}</span>}
        <span className="whitespace-nowrap">{selected?.label ?? label ?? 'Select'}</span>
        <ChevronDown size={11} className="opacity-60 flex-shrink-0" />
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── FilterChip ────────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label?: string; onRemove: () => void }) {
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-medium"
      style={{
        background: 'rgba(91,111,255,0.08)',
        borderColor: 'rgba(91,111,255,0.25)',
        color: 'var(--accent)',
      }}
    >
      {label}
      <button onClick={onRemove} className="opacity-70 hover:opacity-100 transition-opacity">
        <X size={10} />
      </button>
    </span>
  );
}
