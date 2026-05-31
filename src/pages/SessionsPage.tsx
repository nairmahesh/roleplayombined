// pitchiq/frontend/src/pages/SessionsPage.tsx

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { sessionsApi, usersApi, recordingsApi, isS3Recording } from '@/lib/api';
import { useAuthStore, usePageCache } from '@/lib/store';
import { Session, User, FRAMEWORK_INFO } from '@/types';
import { formatDistanceToNow, isWithinInterval, subDays, startOfDay } from 'date-fns';
import {
  Phone, Monitor, Download, ClipboardList,
  Search, X, ChevronDown, MapPin, User as UserIcon,
  SlidersHorizontal, Calendar, Film, Play,
} from 'lucide-react';
import { RECORDINGS_LS_KEY, type RecordingMeta } from '@/components/practice/OnlineMeetingRoom';
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

interface SessionsCache { sessions: Session[]; teamUsers: User[] }

export function SessionsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore(s => ({ user: s.user }));
  const isAdmin = currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN';
  const { getCache, setCache } = usePageCache();

  const cached = getCache<SessionsCache>('sessions');
  const [sessions, setSessions] = useState<Session[]>(cached?.sessions ?? []);
  const [teamUsers, setTeamUsers] = useState<User[]>(cached?.teamUsers ?? []);
  const [loading, setLoading] = useState(!cached);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [playbackMeta, setPlaybackMeta] = useState<RecordingMeta | null>(null);
  const [playbackSessionType, setPlaybackSessionType] = useState<string>('ONLINE_MEETING');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [s3LoadingId, setS3LoadingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECORDINGS_LS_KEY);
      if (raw) setRecordings(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionData, userData] = await Promise.all([
          isAdmin
            ? sessionsApi.listAll({ status: 'COMPLETED', limit: 200 })
            : sessionsApi.list({ status: 'COMPLETED', limit: 200 }),
          isAdmin ? usersApi.list() : Promise.resolve([]),
        ]);
        const s = sessionData.sessions;
        const u = Array.isArray(userData) ? userData : [];
        setSessions(s);
        setTeamUsers(u);
        setCache('sessions', { sessions: s, teamUsers: u });
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
                recordingMeta={recordings.find(r => r.sessionId === session.id)}
                s3LoadingId={s3LoadingId}
                onPlayRecording={meta => {
                  const sType = sessions.find(s => s.id === meta.sessionId)?.type ?? 'ONLINE_MEETING';
                  setPlaybackSessionType(sType);
                  setPlaybackMeta(meta);
                  setVideoPlaying(false);
                }}
                onPlayS3Recording={async (sessionId) => {
                  setS3LoadingId(sessionId);
                  try {
                    const url = await recordingsApi.getPlaybackUrl(sessionId);
                    const sType = sessions.find(s => s.id === sessionId)?.type ?? 'ONLINE_MEETING';
                    setPlaybackSessionType(sType);
                    setPlaybackMeta({ sessionId, objectUrl: url, recordedAt: new Date().toISOString(), durationMs: 0, sizeBytes: 0 });
                    setVideoPlaying(false);
                  } catch { toast.error('Recording not available'); }
                  finally { setS3LoadingId(null); }
                }}
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

      {/* ── Recording playback modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {playbackMeta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setPlaybackMeta(null)}
          >
            <motion.div
              initial={{ scale: 0.93, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="flex flex-col w-full max-w-2xl rounded-[20px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
              style={{ background: '#1c1e21' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                    <Film size={14} className="text-red-400" />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-white">Session Recording</div>
                    <div className="text-[11px] text-white/50 mt-0.5">
                      {new Date(playbackMeta.recordedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      {' · '}
                      {(playbackMeta.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      {' · '}
                      {Math.floor(playbackMeta.durationMs / 60000)}:{String(Math.floor((playbackMeta.durationMs % 60000) / 1000)).padStart(2, '0')} duration
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = playbackMeta.objectUrl;
                      a.download = `pitchiq-session-${playbackMeta.sessionId}.webm`;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-white/10 text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Download size={12} /> Download
                  </button>
                  <button
                    onClick={() => setPlaybackMeta(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Video / Audio player */}
              {playbackSessionType === 'PHONE_CALL' ? (
                <div className="flex flex-col items-center gap-4 px-6 py-8" style={{ background: '#111' }}>
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <Phone size={28} className="text-white/60" />
                  </div>
                  <p className="text-[12px] text-white/50">Phone call recording</p>
                  <audio
                    key={playbackMeta.objectUrl}
                    src={playbackMeta.objectUrl}
                    className="w-full"
                    onPlay={() => setVideoPlaying(true)}
                    onPause={() => setVideoPlaying(false)}
                    onEnded={() => setVideoPlaying(false)}
                    controls
                    style={{ accentColor: '#1a73e8' }}
                  />
                </div>
              ) : (
                <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                  <video
                    key={playbackMeta.objectUrl}
                    src={playbackMeta.objectUrl}
                    className="w-full h-full object-contain"
                    onPlay={() => setVideoPlaying(true)}
                    onPause={() => setVideoPlaying(false)}
                    onEnded={() => setVideoPlaying(false)}
                    controls
                  />
                  {!videoPlaying && (
                    <div
                      className="absolute inset-0 flex items-center justify-center cursor-pointer"
                      onClick={e => { e.stopPropagation(); (e.currentTarget.previousElementSibling as HTMLVideoElement)?.play(); }}
                    >
                      <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors">
                        <Play size={26} className="text-white ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[11.5px] text-white/40">
                  Recordings are stored in your browser. Download to keep permanently.
                </p>
                <button
                  onClick={() => navigate(`/sessions/${playbackMeta.sessionId}/feedback`)}
                  className="text-[12px] text-[#1a73e8] hover:text-[#4d96ef] font-medium transition-colors flex-shrink-0"
                >
                  View full scorecard →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SessionRow ────────────────────────────────────────────────────────────────

function SessionRow({
  session,
  index,
  isAdmin,
  userLocationMap,
  recordingMeta,
  s3LoadingId,
  onPlayRecording,
  onPlayS3Recording,
  onClick,
}: {
  session: Session;
  index: number;
  isAdmin: boolean;
  userLocationMap: Record<string, string>;
  recordingMeta?: RecordingMeta;
  s3LoadingId: string | null;
  onPlayRecording?: (meta: RecordingMeta) => void;
  onPlayS3Recording?: (sessionId: string) => void;
  onClick: () => void;
}) {
  const score = session.totalScore;
  const TypeIcon = session.type === 'PHONE_CALL' ? Phone : Monitor;
  const personaName = session.scenarioConfig?.displayName || session.persona?.name || 'Unknown';
  const personaTitle = session.scenarioConfig?.displayTitle || session.persona?.title || '';
  const repName = session.user ? `${session.user.firstName} ${session.user.lastName}` : null;
  const repLocation = session.user?.id ? userLocationMap[session.user.id] : undefined;
  const hasS3Rec = isS3Recording(session.recordingUrl);
  const isLoadingRec = s3LoadingId === session.id;
  const handleRecClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recordingMeta && onPlayRecording) onPlayRecording(recordingMeta);
    else if (hasS3Rec && onPlayS3Recording) onPlayS3Recording(session.id);
  };
  const showRec = !!(recordingMeta || hasS3Rec);

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
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{personaName}</span>
              {showRec && (
                <button
                  onClick={handleRecClick}
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                >
                  {isLoadingRec
                    ? <div className="w-2.5 h-2.5 rounded-full border border-red-400/40 border-t-red-400 animate-spin" />
                    : <Play size={9} className="ml-px" />}
                </button>
              )}
            </div>
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
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{personaName}</div>
            <div className="text-[11.5px] truncate" style={{ color: 'var(--text3)' }}>{personaTitle}</div>
          </div>
          {showRec && (
            <button
              onClick={handleRecClick}
              title="Play recording"
              disabled={isLoadingRec}
              className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-[7px] border opacity-0 group-hover:opacity-100 transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              {isLoadingRec
                ? <div className="w-2.5 h-2.5 rounded-full border border-red-400/40 border-t-red-400 animate-spin" />
                : <Film size={11} />}
              <span className="text-[10.5px] font-medium">{isLoadingRec ? '…' : 'Rec'}</span>
            </button>
          )}
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
