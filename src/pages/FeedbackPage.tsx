// pitchiq/frontend/src/pages/FeedbackPage.tsx

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { RefreshCw, Share2, ChevronRight, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Lightbulb, Play, Pause, Search, Copy, Download, MessageSquare, Clock, Shield, BarChart3, Gauge, Activity, Mic, ChevronDown, CircleAlert as AlertCircle, X } from 'lucide-react';
import { sessionsApi, api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Session, ParsedFeedback, FRAMEWORK_INFO } from '@/types';
import clsx from 'clsx';

type Tab = 'feedback' | 'analytics' | 'objections';

const TABS = [
  { id: 'feedback'   as Tab, label: 'Feedback',   icon: MessageSquare },
  { id: 'analytics'  as Tab, label: 'Analytics',   icon: BarChart3     },
  { id: 'objections' as Tab, label: 'Objections',  icon: Shield        },
];

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatSecs(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function getRating(metric: 'talkRatio' | 'talkSpeed' | 'fillerWpm' | 'monologue', value: number) {
  const specs = {
    talkRatio: { good: [40, 60] as [number,number], avg: [30, 70] as [number,number], goodLabel: 'Good', badLabel: value > 70 ? 'Too much' : 'Too little' },
    talkSpeed: { good: [120, 160] as [number,number], avg: [100, 180] as [number,number], goodLabel: 'Good', badLabel: value > 180 ? 'Too fast' : 'Too slow' },
    fillerWpm: { good: [0, 1] as [number,number],   avg: [1, 2] as [number,number],     goodLabel: 'Good', badLabel: 'Too many'  },
    monologue: { good: [0, 30] as [number,number],  avg: [30, 60] as [number,number],   goodLabel: 'Good', badLabel: 'Too long'  },
  };
  const { good, avg, goodLabel, badLabel } = specs[metric];
  if (value >= good[0] && value <= good[1]) return { label: goodLabel, color: '#06D6A0' };
  if (value >= avg[0] && value <= avg[1])   return { label: 'Average', color: '#FFD166' };
  return { label: badLabel, color: '#FF6B6B' };
}

function RatingBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}18`, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-accent/30 text-white rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#06D6A0' : score >= 65 ? '#FFD166' : '#FF6B6B';
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[18px] font-bold leading-none">{score}</span>
        <span className="text-[8px] text-white/30 font-medium tracking-wider">SCORE</span>
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession]               = useState<Session | null>(null);
  const [loading, setLoading]               = useState(true);
  const [analysing, setAnalysing]           = useState(false);
  const [activeTab, setActiveTab]           = useState<Tab>('feedback');
  const [playbackUrl, setPlaybackUrl]       = useState<string | null>(null);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [audioDuration, setAudioDuration]   = useState(0);
  const [audioProgress, setAudioProgress]   = useState(0);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [expandedScoreId, setExpandedScoreId]   = useState<string | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const trackRef  = useRef<HTMLDivElement>(null);
  const socket    = connectSocket();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await sessionsApi.get(id);
        setSession(data);
        if (data.status === 'COMPLETED' && !data.totalScore) setAnalysing(true);
        if (data.recordingUrl) {
          api.get(`/recordings/playback/${id}`)
            .then((res: any) => setPlaybackUrl((res.data as any).url))
            .catch(() => {});
        }
      } catch {
        toast.error('Session not found');
        navigate('/sessions');
      } finally {
        setLoading(false);
      }
    };
    load();
    socket.emit('session:join', { sessionId: id });
    const handleAnalysisComplete = async ({ sessionId }: { sessionId: string }) => {
      if (sessionId !== id) return;
      setAnalysing(false);
      try {
        const data = await sessionsApi.get(id);
        setSession(data);
        toast.success('🎯 AI analysis complete!');
        if (data.recordingUrl) {
          api.get(`/recordings/playback/${id}`)
            .then((res: any) => setPlaybackUrl((res.data as any).url))
            .catch(() => {});
        }
      } catch {
        toast.error('Failed to load analysis results');
      }
    };
    socket.on('analysis:complete', handleAnalysisComplete);
    return () => {
      socket.off('analysis:complete', handleAnalysisComplete);
      socket.emit('session:leave', { sessionId: id });
    };
  }, [id]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
  }, [isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    audioRef.current.play();
    setIsPlaying(true);
  }, []);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !audioDuration) return;
    const rect = trackRef.current.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audioDuration);
  };

  const analytics = useMemo(() => {
    const messages = session?.messages || [];
    const duration = session?.durationSeconds || 0;
    if (messages.length === 0) return null;

    const FILLERS = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically',
                     'literally', 'right', 'hmm', 'i mean', 'well', 'kind of', 'sort of'];
    const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
    const repMsgs = messages.filter(m => m.role === 'user');
    const aiMsgs  = messages.filter(m => m.role === 'assistant');
    const repWords = repMsgs.reduce((a, m) => a + countWords(m.content), 0);
    const aiWords  = aiMsgs.reduce((a, m) => a + countWords(m.content), 0);
    const totalWords = repWords + aiWords;
    const talkRatioPct = totalWords > 0 ? Math.round((repWords / totalWords) * 100) : 50;
    const repSpeakingMins = duration > 0 ? (duration * (talkRatioPct / 100)) / 60 : repWords / 130;
    const talkSpeedWpm = repSpeakingMins > 0 ? Math.round(repWords / repSpeakingMins) : 0;

    const repText = repMsgs.map(m => m.content.toLowerCase()).join(' ');
    let fillerCount = 0;
    FILLERS.forEach(fw => {
      const rx = new RegExp(`\\b${fw.replace(/\s+/g, '\\s+')}\\b`, 'g');
      fillerCount += (repText.match(rx) || []).length;
    });
    const fillerWpm = repSpeakingMins > 0 ? parseFloat((fillerCount / repSpeakingMins).toFixed(2)) : 0;

    let longestSecs = 0;
    let curWords = 0;
    let inRun = false;
    messages.forEach(m => {
      if (m.role === 'user') {
        curWords += countWords(m.content);
        inRun = true;
      } else if (inRun) {
        const s = talkSpeedWpm > 0 ? (curWords / talkSpeedWpm) * 60 : curWords * 0.4;
        if (s > longestSecs) longestSecs = s;
        curWords = 0; inRun = false;
      }
    });
    if (inRun && curWords > 0) {
      const s = talkSpeedWpm > 0 ? (curWords / talkSpeedWpm) * 60 : curWords * 0.4;
      if (s > longestSecs) longestSecs = s;
    }

    return {
      talkRatioPct,
      listenRatioPct: 100 - talkRatioPct,
      talkSpeedWpm,
      fillerWpm,
      fillerCount,
      longestMonologueSecs: Math.round(longestSecs),
    };
  }, [session]);

  const filteredMessages = useMemo(() => {
    const msgs = session?.messages || [];
    if (!transcriptSearch.trim()) return msgs;
    const q = transcriptSearch.toLowerCase();
    return msgs.filter(m => m.content.toLowerCase().includes(q));
  }, [session?.messages, transcriptSearch]);

  let feedback: ParsedFeedback | null = null;
  try { feedback = session?.aiFeedback ? JSON.parse(session.aiFeedback) as ParsedFeedback : null; }
  catch { feedback = null; }

  if (loading) return <LoadingSkeleton />;
  if (!session) return null;

  if (analysing) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-16 h-16 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
      <div className="text-center">
        <h3 className="font-display text-xl font-bold mb-2">Analysing your session…</h3>
        <p className="text-white/65 text-sm">Reviewing your transcript against {FRAMEWORK_INFO[session.framework]?.label} criteria</p>
      </div>
    </div>
  );

  const totalDurationMs = (session.durationSeconds || 0) * 1000;
  const sortedEvents    = [...(session.timelineEvents || [])].sort((a, b) => a.timestampMs - b.timestampMs);
  const scores          = session.frameworkScores || [];
  const trackProgress   = audioDuration ? (audioProgress / audioDuration) * 100 : audioProgress;
  const personaName     = session.scenarioConfig?.displayName || session.persona?.name || 'Persona';
  const objections      = session.scenarioConfig?.objections || [];
  const objectionEvents = sortedEvents.filter(e => e.type === 'ISSUE' || e.type === 'WARNING');

  return (
    <div
      className="flex flex-col md:flex-row gap-0 rounded-[14px] border border-white/[0.07] overflow-hidden bg-bg-2"
      style={{ minHeight: 'calc(100vh - 156px)' }}
    >
      {/* ── LEFT: Transcript panel ─────────────────────────────────────────── */}
      <div className="w-full md:w-[360px] md:flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-white/[0.07] bg-bg max-h-[45vh] md:max-h-none">

        {/* Audio player */}
        {playbackUrl && (
          <div className="px-4 py-3 border-b border-white/[0.07] flex-shrink-0 bg-bg-2">
            <audio
              ref={el => {
                audioRef.current = el;
                if (el) {
                  el.onloadedmetadata = () => setAudioDuration(el.duration);
                  el.ontimeupdate    = () => setAudioProgress(el.currentTime);
                  el.onplay          = () => setIsPlaying(true);
                  el.onpause         = () => setIsPlaying(false);
                  el.onended         = () => { setIsPlaying(false); setAudioProgress(0); };
                }
              }}
              src={playbackUrl}
              preload="metadata"
            />
            <div className="flex items-center gap-2.5 mb-2.5">
              <button
                onClick={togglePlay}
                className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 text-accent flex items-center justify-center flex-shrink-0 hover:bg-accent/25 transition-colors"
              >
                {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
              </button>
              <div
                ref={trackRef}
                onClick={handleTrackClick}
                className="flex-1 h-[4px] bg-white/10 rounded-full relative cursor-pointer"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 relative"
                  style={{ width: `${trackProgress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-accent translate-x-1.5" />
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/30 flex-shrink-0">
                {formatMs(audioProgress * 1000)} / {audioDuration ? formatMs(audioDuration * 1000) : '--:--'}
              </span>
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = playbackUrl;
                  a.download = `session-${id}.mp3`;
                  a.click();
                }}
                className="text-white/25 hover:text-white/50 transition-colors flex-shrink-0"
                title="Download recording"
              >
                <Download size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Transcript header */}
        <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2 flex-shrink-0 bg-bg-2">
          <span className="font-semibold text-[13px] text-white/80 flex-1">Transcript</span>
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-[8px] px-2.5 py-1.5 flex-1 min-w-0">
            <Search size={11} className="text-white/25 flex-shrink-0" />
            <input
              value={transcriptSearch}
              onChange={e => setTranscriptSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 min-w-0 bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
            />
            {transcriptSearch && (
              <button onClick={() => setTranscriptSearch('')} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
                <X size={10} />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              const text = (session.messages || [])
                .map(m => `[${formatMs(m.timestampMs)}] ${m.role === 'user' ? 'You' : personaName}: ${m.content}`)
                .join('\n');
              navigator.clipboard.writeText(text).then(() => toast.success('Transcript copied!'));
            }}
            className="text-white/25 hover:text-white/50 transition-colors flex-shrink-0"
            title="Copy transcript"
          >
            <Copy size={12} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/25 text-sm">{transcriptSearch ? 'No matches' : 'No transcript available'}</p>
            </div>
          ) : (
            <div className="py-3 px-3 flex flex-col gap-1">
              {filteredMessages.map(m => {
                const isRep = m.role === 'user';
                return (
                  <div key={m.id} className={clsx('flex gap-2.5 py-1.5', isRep ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar */}
                    <div className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-1',
                      isRep ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/10 text-white/60 border border-white/15'
                    )}>
                      {isRep ? 'U' : personaName.charAt(0)}
                    </div>
                    <div className={clsx('flex flex-col gap-0.5 max-w-[78%]', isRep ? 'items-end' : 'items-start')}>
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('text-[10px] font-semibold', isRep ? 'text-accent/70' : 'text-white/40')}>
                          {isRep ? 'You' : personaName.split(' ')[0]}
                        </span>
                        {!isRep && (
                          <span className="text-[8px] font-bold bg-accent/20 text-accent px-1 py-0.5 rounded">AI</span>
                        )}
                        <span className="text-[10px] font-mono text-white/20">{formatMs(m.timestampMs)}</span>
                      </div>
                      <div className={clsx(
                        'px-3 py-2 rounded-[10px] text-[12.5px] leading-relaxed',
                        isRep
                          ? 'bg-accent/10 border border-accent/15 text-white/85'
                          : 'bg-white/[0.04] border border-white/[0.07] text-white/55'
                      )}>
                        {highlightText(m.content, transcriptSearch)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Feedback panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Hero */}
        <div className="px-6 py-4 border-b border-white/[0.07] flex-shrink-0 bg-bg-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent-2 to-accent-3" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {session.totalScore != null && <ScoreRing score={session.totalScore} />}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-[17px] font-bold mb-1 truncate">
                {personaName} · {session.type === 'PHONE_CALL' ? 'Phone Call' : 'Online Meeting'}
              </h2>
              <div className="flex gap-1.5 flex-wrap">
                <span className="tag">{FRAMEWORK_INFO[session.framework]?.label}</span>
                {session.durationSeconds && (
                  <span className="tag tag-green">{Math.round(session.durationSeconds / 60)}m {session.durationSeconds % 60}s</span>
                )}
                {session.totalScore != null && (
                  <span className={clsx('tag', session.totalScore >= 70 ? 'tag-green' : 'tag-red')}>
                    {session.totalScore >= 70 ? '✓ Passed' : '✗ Below threshold'}
                  </span>
                )}
              </div>
              {feedback?.overallFeedback && (
                <p className="text-[12px] text-white/50 leading-relaxed mt-1.5 line-clamp-2">{feedback.overallFeedback}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 w-full sm:w-auto">
              <button onClick={() => navigate('/practice')} className="btn-ghost gap-1.5 text-xs py-1.5 px-3">
                <RefreshCw size={11} /> Retry
              </button>
              <button
                onClick={() => { sessionsApi.share(id!); toast.success('📤 Shared with your manager!'); }}
                className="btn-success gap-1.5 text-xs py-1.5 px-3"
              >
                <Share2 size={11} /> Share
              </button>
              <button onClick={() => navigate('/practice')} className="btn-primary gap-1.5 text-xs py-1.5 px-3 ml-auto sm:ml-0">
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] px-6 flex-shrink-0 bg-bg-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-3 text-[12.5px] font-medium transition-colors relative',
                  active ? 'text-white' : 'text-white/35 hover:text-white/60'
                )}
              >
                <Icon size={12} />
                {tab.label}
                {active && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-t-full" />}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── FEEDBACK TAB ──────────────────────────────────────────────── */}
          {activeTab === 'feedback' && (
            <div className="flex flex-col gap-5">

              {/* Scorecard */}
              {scores.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-semibold text-white/25 uppercase tracking-[1.2px] mb-3">Scorecard</div>
                  <div className="flex flex-col gap-1.5">
                    {scores.map(score => {
                      const passed = score.score >= 70;
                      const color  = score.score >= 80 ? '#06D6A0' : score.score >= 65 ? '#FFD166' : '#FF6B6B';
                      const isOpen = expandedScoreId === score.id;
                      return (
                        <div
                          key={score.id}
                          className="rounded-[10px] border border-white/[0.07] overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedScoreId(isOpen ? null : score.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                          >
                            {passed
                              ? <CheckCircle size={15} className="text-accent-3 flex-shrink-0" />
                              : <X size={15} className="text-accent-4 flex-shrink-0" />
                            }
                            <span className="flex-1 text-[13px] font-medium text-white/80">{score.component}</span>
                            <span className="font-display text-[14px] font-bold flex-shrink-0" style={{ color }}>{score.score}</span>
                            <ChevronDown
                              size={14}
                              className={clsx('text-white/25 flex-shrink-0 transition-transform ml-1', isOpen && 'rotate-180')}
                            />
                          </button>
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 bg-white/[0.015]">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Why were you scored this way?</span>
                                  </div>
                                  <p className="text-[12.5px] text-white/60 leading-relaxed mb-3">{score.feedback}</p>
                                  {score.evidence?.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                      {score.evidence.map((ev: string, i: number) => (
                                        <blockquote key={i} className="text-[11.5px] text-white/35 italic border-l-2 border-accent/30 pl-3 py-0.5">
                                          "{ev}"
                                        </blockquote>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline events (issues/warnings) */}
              {sortedEvents.length > 0 && (
                <div>
                  <div className="text-[10.5px] font-semibold text-white/25 uppercase tracking-[1.2px] mb-3">Key Moments</div>

                  {/* Scrubber */}
                  {totalDurationMs > 0 && (
                    <div className="mb-3 px-1">
                      <div className="h-[4px] bg-white/[0.06] rounded-full relative">
                        {sortedEvents.map(event => {
                          const pct = Math.min(99, (event.timestampMs / totalDurationMs) * 100);
                          const dotColor = event.type === 'GOOD' ? 'bg-accent-3' : event.type === 'WARNING' ? 'bg-accent-5' : event.type === 'ISSUE' ? 'bg-accent-4' : 'bg-white/30';
                          return (
                            <div
                              key={event.id}
                              className={clsx('absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-bg-2 cursor-pointer hover:scale-150 transition-transform z-10', dotColor)}
                              style={{ left: `${pct}%` }}
                              title={`${formatMs(event.timestampMs)} — ${event.title}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[9px] text-white/20 mt-1 font-mono">
                        <span>0:00</span>
                        {session.durationSeconds && <span>{formatMs(session.durationSeconds * 1000)}</span>}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    {sortedEvents.map(event => {
                      const isGood = event.type === 'GOOD';
                      const isIssue = event.type === 'ISSUE';
                      const isWarn = event.type === 'WARNING';
                      return (
                        <div
                          key={event.id}
                          className={clsx(
                            'p-3 rounded-[10px] border-l-[3px]',
                            isGood  ? 'bg-accent-3/5 border-l-accent-3' :
                            isIssue ? 'bg-accent-4/5 border-l-accent-4' :
                            isWarn  ? 'bg-accent-5/5 border-l-accent-5' :
                                      'bg-white/[0.03] border-l-white/15'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono text-white/25 flex-shrink-0">{formatMs(event.timestampMs)}</span>
                            <span className="text-[12.5px] font-medium text-white/80 flex-1">
                              {isGood ? '✅' : isIssue ? '❌' : isWarn ? '⚠' : 'ℹ'} {event.title}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-white/45 leading-relaxed pl-10">{event.description}</p>
                          {event.betterResponse && (
                            <div className="mt-2 ml-10 bg-accent-3/5 border border-accent-3/15 rounded-[8px] p-2">
                              <span className="text-[9px] font-bold text-accent-3/60 uppercase tracking-wider block mb-1">Better response</span>
                              <p className="text-[11.5px] text-white/60 italic">"{event.betterResponse}"</p>
                            </div>
                          )}
                          {!event.betterResponse && event.suggestion && (
                            <div className="mt-1.5 ml-10 flex items-center gap-1 text-[11px] text-accent/70">
                              <Lightbulb size={9} /> {event.suggestion}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths / Improvements / Pro Tip */}
              {feedback && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle size={13} className="text-accent-3" />
                      <span className="font-display text-[12.5px] font-bold">Strengths</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {feedback.strengths.map((s, i) => (
                        <li key={i} className="text-[11.5px] text-white/55 flex gap-2">
                          <span className="text-accent-3 flex-shrink-0">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={13} className="text-accent-5" />
                      <span className="font-display text-[12.5px] font-bold">Improve Next Time</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {feedback.improvements.map((s, i) => (
                        <li key={i} className="text-[11.5px] text-white/55 flex gap-2">
                          <span className="text-accent-5 flex-shrink-0">→</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card p-4 border-accent/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb size={13} className="text-accent" />
                      <span className="font-display text-[12.5px] font-bold">Pro Tip</span>
                    </div>
                    <p className="text-[11.5px] text-white/55 leading-relaxed">{feedback.proTip}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="flex flex-col gap-4">
              {!analytics ? (
                <div className="card p-12 text-center">
                  <BarChart3 size={28} className="text-white/20 mx-auto mb-3" />
                  <p className="text-white/65 text-sm">No analytics available — session transcript is empty</p>
                </div>
              ) : (
                <>
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Mic size={13} className="text-accent" />
                      <span className="font-display text-[13.5px] font-bold">Talk / Listen Ratio</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] text-white/65">You spoke</span>
                          <span className="font-display text-[20px] font-bold text-accent">{analytics.talkRatioPct}%</span>
                        </div>
                        <div className="h-3 bg-bg-4 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${analytics.talkRatioPct}%`, background: getRating('talkRatio', analytics.talkRatioPct).color }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] text-white/65">Prospect spoke</span>
                          <span className="font-display text-[20px] font-bold text-white/50">{analytics.listenRatioPct}%</span>
                        </div>
                        <div className="h-3 bg-bg-4 rounded-full overflow-hidden">
                          <div className="h-full bg-white/15 rounded-full transition-all duration-700 ease-out" style={{ width: `${analytics.listenRatioPct}%` }} />
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const r = getRating('talkRatio', analytics.talkRatioPct);
                      return (
                        <div className="flex items-center gap-2">
                          <RatingBadge color={r.color} label={r.label} />
                          <span className="text-[11px] text-white/30">Ideal range is 40–60% for active selling</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const r = getRating('talkSpeed', analytics.talkSpeedWpm);
                      return (
                        <div className="card p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Gauge size={12} className="text-white/65" />
                            <span className="text-[12px] font-semibold text-white/55">Talk Speed</span>
                          </div>
                          <div className="font-display text-[28px] font-bold leading-none mb-1">{analytics.talkSpeedWpm}</div>
                          <div className="text-[10.5px] text-white/30 mb-3">words per minute</div>
                          <RatingBadge color={r.color} label={r.label} />
                          <div className="mt-1.5 text-[10px] text-white/25">Ideal: 120–160 wpm</div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const r = getRating('fillerWpm', analytics.fillerWpm);
                      return (
                        <div className="card p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Activity size={12} className="text-white/65" />
                            <span className="text-[12px] font-semibold text-white/55">Filler Words</span>
                          </div>
                          <div className="font-display text-[28px] font-bold leading-none mb-1">{analytics.fillerWpm.toFixed(2)}</div>
                          <div className="text-[10.5px] text-white/30 mb-3">per minute ({analytics.fillerCount} total)</div>
                          <RatingBadge color={r.color} label={r.label} />
                          <div className="mt-1.5 text-[10px] text-white/25">Target: &lt;1 per minute</div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const r = getRating('monologue', analytics.longestMonologueSecs);
                      return (
                        <div className="card p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock size={12} className="text-white/65" />
                            <span className="text-[12px] font-semibold text-white/55">Longest Monologue</span>
                          </div>
                          <div className="font-display text-[28px] font-bold leading-none mb-1">{formatSecs(analytics.longestMonologueSecs)}</div>
                          <div className="text-[10.5px] text-white/30 mb-3">uninterrupted speaking</div>
                          <RatingBadge color={r.color} label={r.label} />
                          <div className="mt-1.5 text-[10px] text-white/25">Target: under 30 sec</div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── OBJECTIONS TAB ────────────────────────────────────────────── */}
          {activeTab === 'objections' && (
            <div className="flex flex-col gap-4">
              {objections.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={13} className="text-accent-4" />
                    <span className="font-display text-[13.5px] font-bold">Prospect's Prepared Objections</span>
                    <span className="text-[11px] text-white/30">{objections.length} loaded</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {objections.map((obj, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-accent-4/5 border border-accent-4/10 rounded-[10px]">
                        <span className="text-accent-4/50 text-[11px] font-bold flex-shrink-0 w-4">{i + 1}.</span>
                        <span className="text-[12.5px] text-white/65">{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {objectionEvents.length > 0 ? (
                <div className="card">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                    <AlertCircle size={13} className="text-accent-4" />
                    <span className="font-display text-[13.5px] font-bold">Handling Analysis</span>
                    <span className="text-[11px] text-white/30">{objectionEvents.length} moment{objectionEvents.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-col divide-y divide-white/[0.05]">
                    {objectionEvents.map(event => {
                      const isIssue = event.type === 'ISSUE';
                      return (
                        <div key={event.id} className="p-5 flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border', isIssue ? 'text-accent-4 border-accent-4/30 bg-accent-4/8' : 'text-accent-5 border-accent-5/30 bg-accent-5/8')}>
                              {isIssue ? '❌ Issue' : '⚠ Warning'}
                            </span>
                            <span className="text-[12px] font-semibold text-white/70">{event.title}</span>
                            <span className="text-[10px] font-mono text-white/25 ml-auto">{formatMs(event.timestampMs)}</span>
                          </div>
                          <p className="text-[12px] text-white/50 leading-relaxed">{event.description}</p>
                          {(event.transcriptRef || event.betterResponse) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {event.transcriptRef && (
                                <div className="bg-accent-4/5 border border-accent-4/15 rounded-[10px] p-3">
                                  <div className="text-[9.5px] font-bold text-accent-4/60 uppercase tracking-wider mb-2">What was said</div>
                                  <p className="text-[12px] text-white/60 italic">"{event.transcriptRef}"</p>
                                </div>
                              )}
                              {event.betterResponse && (
                                <div className="bg-accent-3/5 border border-accent-3/15 rounded-[10px] p-3">
                                  <div className="text-[9.5px] font-bold text-accent-3/60 uppercase tracking-wider mb-2">Better response</div>
                                  <p className="text-[12px] text-white/70 italic">"{event.betterResponse}"</p>
                                </div>
                              )}
                            </div>
                          )}
                          {event.suggestion && (
                            <div className="flex items-center gap-1.5 text-[11px] text-accent/70">
                              <Lightbulb size={10} /> {event.suggestion}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="card p-10 text-center">
                  <CheckCircle size={28} className="text-accent-3 mx-auto mb-3" />
                  <p className="text-[14px] font-semibold text-white/60">No objection handling issues detected</p>
                  <p className="text-[12px] text-white/30 mt-1">You navigated the conversation well!</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-0 rounded-[14px] border border-white/[0.07] overflow-hidden animate-pulse" style={{ minHeight: 'calc(100vh - 156px)' }}>
      <div className="w-full md:w-[360px] h-40 md:h-auto border-b md:border-b-0 md:border-r border-white/[0.07] bg-white/[0.02]" />
      <div className="flex-1 flex flex-col gap-4 p-6 bg-white/[0.01]">
        <div className="h-20 bg-white/[0.04] rounded-lg" />
        <div className="h-10 bg-white/[0.04] rounded-lg" />
        <div className="flex-1 bg-white/[0.04] rounded-lg" />
      </div>
    </div>
  );
}
