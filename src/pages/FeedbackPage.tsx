// pitchiq/frontend/src/pages/FeedbackPage.tsx

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { RefreshCw, Share2, ChevronRight, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Lightbulb, Play, Pause, Search, Copy, Download, MessageSquare, Clock, Shield, BarChart3, Gauge, Activity, Mic, ChevronDown, CircleAlert as AlertCircle, X, Info, Trophy, RotateCcw, Zap, Target, ChevronLeft } from 'lucide-react';
import { sessionsApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Session, ParsedFeedback, FRAMEWORK_INFO } from '@/types';
import clsx from 'clsx';

type Tab = 'scorecard' | 'transcript' | 'analytics' | 'leaderboard';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'scorecard',   label: 'Scorecard',   icon: Target       },
  { id: 'transcript',  label: 'Transcript',  icon: MessageSquare },
  { id: 'analytics',  label: 'Analytics',   icon: BarChart3     },
  { id: 'leaderboard',label: 'Leaderboard', icon: Trophy        },
];

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSecs(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function scoreStyle(score?: number): React.CSSProperties {
  if (score == null) return { color: 'var(--text3)' };
  if (score >= 80) return { color: 'var(--accent3)' };
  if (score >= 65) return { color: 'var(--accent5)' };
  return { color: 'var(--accent4)' };
}

function scoreBadgeStyle(score?: number): React.CSSProperties {
  if (score == null) return {};
  if (score >= 80) return { background: 'rgba(6,214,160,0.12)', color: 'var(--accent3)', border: '1px solid rgba(6,214,160,0.25)' };
  if (score >= 65) return { background: 'rgba(255,209,102,0.12)', color: 'var(--accent5)', border: '1px solid rgba(255,209,102,0.25)' };
  return { background: 'rgba(255,107,107,0.12)', color: 'var(--accent4)', border: '1px solid rgba(255,107,107,0.25)' };
}

function getRating(metric: 'talkRatio' | 'talkSpeed' | 'fillerWpm' | 'monologue', value: number) {
  const specs = {
    talkRatio: { good: [40, 60] as [number,number], avg: [30, 70] as [number,number], goodLabel: 'Balanced', badLabel: value > 70 ? 'Talking too much' : 'Not engaging enough' },
    talkSpeed: { good: [120, 160] as [number,number], avg: [100, 180] as [number,number], goodLabel: 'Good pace', badLabel: value > 180 ? 'Too fast' : 'Too slow' },
    fillerWpm:  { good: [0, 1] as [number,number],   avg: [1, 2] as [number,number],     goodLabel: 'Clean',    badLabel: 'Too many fillers' },
    monologue:  { good: [0, 30] as [number,number],  avg: [30, 60] as [number,number],   goodLabel: 'Good',     badLabel: 'Too long' },
  };
  const { good, avg, goodLabel, badLabel } = specs[metric];
  if (value >= good[0] && value <= good[1]) return { label: goodLabel, color: '#06D6A0' };
  if (value >= avg[0] && value <= avg[1])   return { label: 'Average',   color: '#FFD166' };
  return { label: badLabel, color: '#FF6B6B' };
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const color = score >= 80 ? '#06D6A0' : score >= 65 ? '#FFD166' : '#FF6B6B';
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[20px] font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text3)' }}>Score</span>
      </div>
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return <>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} className="rounded px-0.5" style={{ background: 'rgba(91,111,255,0.35)', color: 'var(--text)' }}>{p}</mark> : p)}</>;
}

interface PeerScore { userId: string; name: string; score: number; rank: number; }

export function FeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession]             = useState<Session | null>(null);
  const [loading, setLoading]             = useState(true);
  const [analysing, setAnalysing]         = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>('scorecard');
  const [playbackUrl, setPlaybackUrl]     = useState<string | null>(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress]= useState(0);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [peerScores, setPeerScores]       = useState<PeerScore[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const trackRef  = useRef<HTMLDivElement>(null);
  const msgRefs   = useRef<Record<string, HTMLDivElement | null>>({});
  const socket    = connectSocket();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [data, peers] = await Promise.all([
          sessionsApi.get(id),
          sessionsApi.getPeerScores(id),
        ]);
        setSession(data);
        setPeerScores(peers);
        if (data.status === 'COMPLETED' && !data.totalScore) setAnalysing(true);
      } catch {
        toast.error('Session not found');
        navigate('/sessions');
      } finally {
        setLoading(false);
      }
    };
    load();
    socket.emit('session:join', { sessionId: id });
    const onDone = async ({ sessionId }: { sessionId: string }) => {
      if (sessionId !== id) return;
      setAnalysing(false);
      try {
        const data = await sessionsApi.get(id);
        setSession(data);
        toast.success('AI analysis complete!');
      } catch { toast.error('Failed to load analysis'); }
    };
    socket.on('analysis:complete', onDone);
    return () => { socket.off('analysis:complete', onDone); socket.emit('session:leave', { sessionId: id }); };
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

  const jumpToTimestamp = useCallback((timestampMs: number) => {
    seekTo(timestampMs / 1000);
    // Find nearest message and highlight it
    const messages = session?.messages || [];
    let nearest = messages[0];
    for (const m of messages) {
      if (Math.abs(m.timestampMs - timestampMs) < Math.abs((nearest?.timestampMs ?? 0) - timestampMs)) nearest = m;
    }
    if (nearest) {
      setHighlightedMsgId(nearest.id);
      setActiveTab('transcript');
      setTimeout(() => {
        msgRefs.current[nearest.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightedMsgId(null), 3000);
    }
  }, [session?.messages, seekTo]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !audioDuration) return;
    const rect = trackRef.current.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audioDuration);
  };

  const analytics = useMemo(() => {
    const messages = session?.messages || [];
    const duration = session?.durationSeconds || 0;
    if (!messages.length) return null;
    const FILLERS = ['um','uh','like','you know','so','actually','basically','literally','right','hmm','i mean','well','kind of','sort of'];
    const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
    const repMsgs  = messages.filter(m => m.role === 'user');
    const aiMsgs   = messages.filter(m => m.role === 'assistant');
    const repWords = repMsgs.reduce((a, m) => a + countWords(m.content), 0);
    const aiWords  = aiMsgs.reduce((a, m) => a + countWords(m.content), 0);
    const total    = repWords + aiWords;
    const talkRatioPct = total > 0 ? Math.round((repWords / total) * 100) : 50;
    const repSpeakingMins = duration > 0 ? (duration * (talkRatioPct / 100)) / 60 : repWords / 130;
    const talkSpeedWpm   = repSpeakingMins > 0 ? Math.round(repWords / repSpeakingMins) : 0;
    const repText = repMsgs.map(m => m.content.toLowerCase()).join(' ');
    let fillerCount = 0;
    FILLERS.forEach(fw => { const rx = new RegExp(`\\b${fw.replace(/\s+/g, '\\s+')}\\b`, 'g'); fillerCount += (repText.match(rx) || []).length; });
    const fillerWpm = repSpeakingMins > 0 ? parseFloat((fillerCount / repSpeakingMins).toFixed(2)) : 0;
    let longestSecs = 0, curWords = 0, inRun = false;
    messages.forEach(m => {
      if (m.role === 'user') { curWords += countWords(m.content); inRun = true; }
      else if (inRun) {
        const s = talkSpeedWpm > 0 ? (curWords / talkSpeedWpm) * 60 : curWords * 0.4;
        if (s > longestSecs) longestSecs = s;
        curWords = 0; inRun = false;
      }
    });
    return { talkRatioPct, listenRatioPct: 100 - talkRatioPct, talkSpeedWpm, fillerWpm, fillerCount, longestMonologueSecs: Math.round(longestSecs) };
  }, [session]);

  const filteredMessages = useMemo(() => {
    const msgs = session?.messages || [];
    if (!transcriptSearch.trim()) return msgs;
    const q = transcriptSearch.toLowerCase();
    return msgs.filter(m => m.content.toLowerCase().includes(q));
  }, [session?.messages, transcriptSearch]);

  let feedback: ParsedFeedback | null = null;
  try { feedback = session?.aiFeedback ? JSON.parse(session.aiFeedback) as ParsedFeedback : null; } catch { /**/ }

  if (loading) return <LoadingSkeleton />;
  if (!session) return null;

  if (analysing) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-16 h-16 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(91,111,255,0.3)', borderTopColor: 'var(--accent)' }} />
      <div className="text-center">
        <h3 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Analysing your session…</h3>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>Reviewing your transcript against {FRAMEWORK_INFO[session.framework]?.label} criteria</p>
      </div>
    </div>
  );

  const scores      = session.frameworkScores || [];
  const sortedEvents = [...(session.timelineEvents || [])].sort((a, b) => a.timestampMs - b.timestampMs);
  const personaName  = session.scenarioConfig?.displayName || session.persona?.name || 'Persona';
  const objections   = session.scenarioConfig?.objections || [];
  const totalDurMs   = (session.durationSeconds || 0) * 1000;
  const trackProgress = audioDuration ? (audioProgress / audioDuration) * 100 : 0;
  const currentUserId = 'u1';
  const myPeerEntry   = peerScores.find(p => p.userId === currentUserId);

  return (
    <div className="flex flex-col gap-0" style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-t-[16px] border border-b-0 px-5 py-4 relative overflow-hidden"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--accent)] via-[var(--accent3)] to-[var(--accent5)]" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          {/* Score ring */}
          {session.totalScore != null && <ScoreRing score={session.totalScore} size={76} />}

          {/* Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button
                onClick={() => navigate('/sessions')}
                className="text-[12px] flex items-center gap-1 transition-colors"
                style={{ color: 'var(--text3)' }}
              >
                <ChevronLeft size={13} /> Sessions
              </button>
              <span style={{ color: 'var(--border2)' }}>/</span>
              <span className="text-[12px]" style={{ color: 'var(--text2)' }}>{personaName}</span>
            </div>
            <h2 className="font-display text-[18px] font-bold truncate leading-tight" style={{ color: 'var(--text)' }}>
              {personaName}
              <span className="font-normal text-[13px] ml-2" style={{ color: 'var(--text3)' }}>
                {session.persona?.title || session.scenarioConfig?.displayTitle}
              </span>
            </h2>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              <span className="tag">{FRAMEWORK_INFO[session.framework]?.label}</span>
              {session.durationSeconds && (
                <span className="tag">{Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s</span>
              )}
              {session.persona?.difficulty && (
                <span className="tag">{session.persona.difficulty}</span>
              )}
              {session.totalScore != null && (
                <span
                  className="tag flex items-center gap-1"
                  style={session.totalScore >= 70
                    ? { background: 'rgba(6,214,160,0.12)', color: 'var(--accent3)', border: '1px solid rgba(6,214,160,0.2)' }
                    : { background: 'rgba(255,107,107,0.12)', color: 'var(--accent4)', border: '1px solid rgba(255,107,107,0.2)' }
                  }
                >
                  {session.totalScore >= 70 ? <CheckCircle size={10} /> : <X size={10} />}
                  {session.totalScore >= 70 ? 'Passed' : 'Below threshold'}
                </span>
              )}
              {myPeerEntry && (
                <span className="tag flex items-center gap-1" style={{ background: 'rgba(91,111,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.2)' }}>
                  <Trophy size={9} /> Rank #{myPeerEntry.rank} of {peerScores.length}
                </span>
              )}
            </div>
            {feedback?.overallFeedback && (
              <p className="text-[12.5px] mt-2 leading-relaxed line-clamp-2" style={{ color: 'var(--text3)' }}>{feedback.overallFeedback}</p>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/practice')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border text-[12.5px] font-medium transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: 'var(--border2)', color: 'var(--text2)', background: 'transparent' }}
            >
              <RotateCcw size={12} /> Practice Again
            </button>
            <button
              onClick={() => { sessionsApi.share(id!); toast.success('Shared with your manager!'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border text-[12.5px] font-medium transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: 'rgba(6,214,160,0.3)', color: 'var(--accent3)', background: 'rgba(6,214,160,0.08)' }}
            >
              <Share2 size={12} /> Share
            </button>
            <button
              onClick={() => navigate('/practice')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px] font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Audio player */}
        {playbackUrl && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <audio
              ref={el => {
                audioRef.current = el;
                if (el) {
                  el.onloadedmetadata = () => setAudioDuration(el.duration);
                  el.ontimeupdate = () => setAudioProgress(el.currentTime);
                  el.onplay = () => setIsPlaying(true);
                  el.onpause = () => setIsPlaying(false);
                  el.onended = () => { setIsPlaying(false); setAudioProgress(0); };
                }
              }}
              src={playbackUrl}
              preload="metadata"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                style={{ background: 'rgba(91,111,255,0.15)', border: '1px solid rgba(91,111,255,0.3)', color: 'var(--accent)' }}
              >
                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              </button>
              <span className="text-[10px] font-mono flex-shrink-0 w-9" style={{ color: 'var(--text3)' }}>{fmt(audioProgress * 1000)}</span>
              <div
                ref={trackRef}
                onClick={handleTrackClick}
                className="flex-1 h-[5px] rounded-full relative cursor-pointer"
                style={{ background: 'var(--bg4)' }}
              >
                {/* Event markers */}
                {sortedEvents.map(e => {
                  const pct = totalDurMs > 0 ? Math.min(99, (e.timestampMs / totalDurMs) * 100) : 0;
                  const dotColor = e.type === 'GOOD' ? '#06D6A0' : e.type === 'ISSUE' ? '#FF6B6B' : e.type === 'WARNING' ? '#FFD166' : '#888';
                  return (
                    <div
                      key={e.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 cursor-pointer z-10 transition-transform hover:scale-150"
                      style={{ left: `${pct}%`, background: dotColor, borderColor: 'var(--bg2)' }}
                      title={`${fmt(e.timestampMs)} — ${e.title}`}
                      onClick={ev => { ev.stopPropagation(); jumpToTimestamp(e.timestampMs); setActiveEventId(e.id); }}
                    />
                  );
                })}
                {/* Progress fill */}
                <div
                  className="h-full rounded-full relative"
                  style={{
                    width: `${trackProgress}%`,
                    background: 'linear-gradient(90deg, var(--accent), var(--accent3))',
                  }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full translate-x-1.5 shadow-sm"
                    style={{ background: '#fff', border: '2px solid var(--accent)' }} />
                </div>
              </div>
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text3)' }}>
                {audioDuration ? fmt(audioDuration * 1000) : session.durationSeconds ? fmt(session.durationSeconds * 1000) : '--:--'}
              </span>
              <button
                onClick={() => { if (playbackUrl) { const a = document.createElement('a'); a.href = playbackUrl; a.download = `session-${id}.mp3`; a.click(); } }}
                title="Download"
                style={{ color: 'var(--text3)' }}
                className="hover:text-white transition-colors flex-shrink-0"
              >
                <Download size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────────── */}
      <div
        className="flex border-x border-b overflow-x-auto"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-3 text-[12.5px] font-medium transition-colors relative whitespace-nowrap"
              style={{ color: active ? 'var(--text)' : 'var(--text3)' }}
            >
              <Icon size={13} />
              {tab.label}
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 rounded-b-[16px] border border-t-0 overflow-hidden"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-4 sm:p-5 overflow-y-auto"
            style={{ maxHeight: 'clamp(320px, calc(100vh - 280px), 800px)' }}
          >

            {/* ── SCORECARD TAB ──────────────────────────────────────────────── */}
            {activeTab === 'scorecard' && (
              <div className="flex flex-col gap-5">

                {/* Quick summary pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {scores.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setExpandedId(s.id); }}
                      className="rounded-[12px] border p-3 text-left transition-all hover:border-[var(--accent)] group"
                      style={{
                        background: 'var(--bg2)',
                        borderColor: expandedId === s.id ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        {s.score >= 70
                          ? <CheckCircle size={13} style={{ color: 'var(--accent3)' }} />
                          : <X size={13} style={{ color: 'var(--accent4)' }} />
                        }
                        <span className="font-display text-[16px] font-bold" style={scoreStyle(s.score)}>{s.score}</span>
                      </div>
                      <div className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--text2)' }}>{s.component}</div>
                      <div className="h-1 mt-2 rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${s.score}%`, background: s.score >= 80 ? '#06D6A0' : s.score >= 65 ? '#FFD166' : '#FF6B6B' }}
                        />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Detailed criteria accordion */}
                {scores.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px] mb-1" style={{ color: 'var(--text3)' }}>
                      Detailed Criteria Breakdown
                    </div>
                    {scores.map(score => {
                      const isOpen = expandedId === score.id;
                      const color  = score.score >= 80 ? '#06D6A0' : score.score >= 65 ? '#FFD166' : '#FF6B6B';
                      const passed = score.score >= 70;
                      return (
                        <div
                          key={score.id}
                          className="rounded-[12px] border overflow-hidden transition-colors"
                          style={{ borderColor: isOpen ? 'rgba(91,111,255,0.3)' : 'var(--border)', background: 'var(--bg2)' }}
                        >
                          <button
                            onClick={() => setExpandedId(isOpen ? null : score.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                            style={{ ['--hover' as string]: 'rgba(255,255,255,0.02)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {passed
                              ? <CheckCircle size={16} style={{ color: '#06D6A0', flexShrink: 0 }} />
                              : <X size={16} style={{ color: '#FF6B6B', flexShrink: 0 }} />
                            }
                            <span className="flex-1 text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{score.component}</span>
                            {/* Mini bar */}
                            <div className="hidden sm:flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full" style={{ background: 'var(--bg4)' }}>
                                <div className="h-full rounded-full" style={{ width: `${score.score}%`, background: color }} />
                              </div>
                            </div>
                            <span className="font-display text-[16px] font-bold w-8 text-right flex-shrink-0 ml-2" style={{ color }}>{score.score}</span>
                            <ChevronDown
                              size={14}
                              className={clsx('flex-shrink-0 ml-1 transition-transform', isOpen && 'rotate-180')}
                              style={{ color: 'var(--text3)' }}
                            />
                          </button>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.01)' }}>

                                  {/* Why scored this way */}
                                  <div className="mb-3 mt-3">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Info size={11} style={{ color: 'var(--text3)' }} />
                                      <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Why you were scored this way</span>
                                    </div>
                                    <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{score.feedback}</p>
                                  </div>

                                  {/* Evidence bullets — clickable timestamps */}
                                  {score.evidence?.length > 0 && (
                                    <div className="mt-3">
                                      <div className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>
                                        Evidence from your call
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        {score.evidence.map((ev, i) => {
                                          // Try to extract a timestamp from the evidence string like "at 0:28"
                                          const tsMatch = ev.match(/(\d+):(\d+)/);
                                          const tsMs = tsMatch ? (parseInt(tsMatch[1]) * 60 + parseInt(tsMatch[2])) * 1000 : null;
                                          return (
                                            <div key={i} className="flex items-start gap-2.5 group/ev">
                                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                                              <span className="text-[12px] leading-relaxed flex-1" style={{ color: 'var(--text2)' }}>{ev}</span>
                                              {tsMs != null && (
                                                <button
                                                  onClick={() => { jumpToTimestamp(tsMs); setActiveTab('transcript'); }}
                                                  className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10.5px] font-medium flex-shrink-0 opacity-70 group-hover/ev:opacity-100 transition-all hover:scale-105"
                                                  style={{ background: 'rgba(91,111,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.2)' }}
                                                >
                                                  <Play size={8} fill="currentColor" />
                                                  {fmt(tsMs)}
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* What to do next time */}
                                  {!passed && (
                                    <div className="mt-4 p-3 rounded-[10px] border" style={{ background: 'rgba(255,209,102,0.06)', borderColor: 'rgba(255,209,102,0.2)' }}>
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <Lightbulb size={11} style={{ color: '#FFD166' }} />
                                        <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: '#FFD166' }}>What to do next time</span>
                                      </div>
                                      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                                        {score.component === 'Champion'
                                          ? 'Before ending the call, ask: "Would you be comfortable sponsoring this internally?" — then arm them with a 2-sentence pitch. A champion who can\'t articulate your value is not a champion.'
                                          : score.component === 'Economic Buyer'
                                          ? 'Ask directly: "Who ultimately signs off on decisions like this?" and "What metric would make this a clear yes for them?" — don\'t assume you know.'
                                          : score.component === 'Decision Criteria'
                                          ? 'Before demoing, ask: "What would a successful vendor look like to you?" — let them define the criteria, then map your product to each one.'
                                          : 'Review the evidence above and prepare 2–3 specific phrases you can use to strengthen this area in your next call.'}
                                      </p>
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
                )}

                {/* Key moments */}
                {sortedEvents.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px] mb-3" style={{ color: 'var(--text3)' }}>Key Moments</div>

                    {/* Timeline scrubber */}
                    {totalDurMs > 0 && (
                      <div className="mb-4 px-1">
                        <div className="h-[4px] rounded-full relative" style={{ background: 'var(--bg4)' }}>
                          {sortedEvents.map(ev => {
                            const pct = Math.min(99, (ev.timestampMs / totalDurMs) * 100);
                            const c = ev.type === 'GOOD' ? '#06D6A0' : ev.type === 'ISSUE' ? '#FF6B6B' : ev.type === 'WARNING' ? '#FFD166' : '#aaa';
                            return (
                              <button
                                key={ev.id}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 z-10 transition-transform hover:scale-150"
                                style={{ left: `${pct}%`, background: c, borderColor: 'var(--bg)' }}
                                title={`${fmt(ev.timestampMs)} — ${ev.title}`}
                                onClick={() => { setActiveEventId(activeEventId === ev.id ? null : ev.id); jumpToTimestamp(ev.timestampMs); }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[9px] font-mono mt-1" style={{ color: 'var(--text3)' }}>
                          <span>0:00</span>
                          {session.durationSeconds && <span>{fmt(session.durationSeconds * 1000)}</span>}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {sortedEvents.map(ev => {
                        const isGood = ev.type === 'GOOD';
                        const isIssue = ev.type === 'ISSUE';
                        const isWarn  = ev.type === 'WARNING';
                        const borderColor = isGood ? '#06D6A0' : isIssue ? '#FF6B6B' : isWarn ? '#FFD166' : 'var(--border2)';
                        const bgColor     = isGood ? 'rgba(6,214,160,0.04)' : isIssue ? 'rgba(255,107,107,0.04)' : isWarn ? 'rgba(255,209,102,0.04)' : 'transparent';

                        return (
                          <div
                            key={ev.id}
                            className="rounded-[12px] border-l-[3px] border p-3.5"
                            style={{ borderLeftColor: borderColor, borderColor: 'var(--border)', background: activeEventId === ev.id ? bgColor : 'var(--bg2)' }}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              {isGood ? <CheckCircle size={13} style={{ color: '#06D6A0', flexShrink: 0 }} />
                               : isIssue ? <X size={13} style={{ color: '#FF6B6B', flexShrink: 0 }} />
                               : isWarn ? <AlertTriangle size={13} style={{ color: '#FFD166', flexShrink: 0 }} />
                               : <Info size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
                              <span className="flex-1 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{ev.title}</span>
                              {/* Jump button */}
                              <button
                                onClick={() => { jumpToTimestamp(ev.timestampMs); setActiveTab('transcript'); }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10.5px] font-medium flex-shrink-0 transition-all hover:scale-105"
                                style={{ background: 'rgba(91,111,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.2)' }}
                              >
                                <Play size={8} fill="currentColor" /> {fmt(ev.timestampMs)}
                              </button>
                            </div>
                            <p className="text-[12px] leading-relaxed pl-[21px]" style={{ color: 'var(--text3)' }}>{ev.description}</p>

                            {/* Transcript ref */}
                            {ev.transcriptRef && (
                              <div className="mt-2 ml-[21px] px-3 py-2 rounded-[8px] border-l-2" style={{ background: 'var(--bg3)', borderLeftColor: 'var(--border2)' }}>
                                <div className="text-[9.5px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>What was said</div>
                                <p className="text-[12px] italic" style={{ color: 'var(--text2)' }}>"{ev.transcriptRef}"</p>
                              </div>
                            )}

                            {/* Better response */}
                            {ev.betterResponse && (
                              <div className="mt-2 ml-[21px] px-3 py-2 rounded-[8px] border-l-2" style={{ background: 'rgba(6,214,160,0.05)', borderLeftColor: '#06D6A0' }}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Zap size={10} style={{ color: '#06D6A0' }} />
                                  <div className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: '#06D6A0' }}>Better response</div>
                                </div>
                                <p className="text-[12px] italic" style={{ color: 'var(--text2)' }}>"{ev.betterResponse}"</p>
                              </div>
                            )}

                            {!ev.betterResponse && ev.suggestion && (
                              <div className="mt-1.5 ml-[21px] flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--accent)' }}>
                                <Lightbulb size={10} /> {ev.suggestion}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
                    <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'rgba(6,214,160,0.2)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle size={13} style={{ color: '#06D6A0' }} />
                        <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>Strengths</span>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {feedback.strengths.map((s, i) => (
                          <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                            <span style={{ color: '#06D6A0', flexShrink: 0 }}>✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'rgba(255,209,102,0.2)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={13} style={{ color: '#FFD166' }} />
                        <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>Improve Next Time</span>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {feedback.improvements.map((s, i) => (
                          <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                            <span style={{ color: '#FFD166', flexShrink: 0 }}>→</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'rgba(91,111,255,0.2)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb size={13} style={{ color: 'var(--accent)' }} />
                        <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>Pro Tip</span>
                      </div>
                      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>{feedback.proTip}</p>
                    </div>
                  </div>
                )}

                {/* Objections panel */}
                {objections.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px] mb-3" style={{ color: 'var(--text3)' }}>Prospect Objections Loaded</div>
                    <div className="flex flex-wrap gap-2">
                      {objections.map((obj, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full text-[12px] border" style={{ background: 'rgba(255,107,107,0.07)', color: 'var(--accent4)', borderColor: 'rgba(255,107,107,0.2)' }}>
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TRANSCRIPT TAB ─────────────────────────────────────────────── */}
            {activeTab === 'transcript' && (
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }} />
                  <input
                    value={transcriptSearch}
                    onChange={e => setTranscriptSearch(e.target.value)}
                    placeholder="Search transcript…"
                    className="w-full pl-8 pr-8 py-2 rounded-[9px] border text-[12.5px] outline-none"
                    style={{ background: 'var(--bg2)', borderColor: transcriptSearch ? 'var(--accent)' : 'var(--border2)', color: 'var(--text)' }}
                  />
                  {transcriptSearch && (
                    <button onClick={() => setTranscriptSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }}>
                      <X size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const text = (session.messages || []).map(m => `[${fmt(m.timestampMs)}] ${m.role === 'user' ? 'You' : personaName}: ${m.content}`).join('\n');
                      navigator.clipboard.writeText(text).then(() => toast.success('Transcript copied!'));
                    }}
                    className="absolute right-8 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text3)' }}
                    title="Copy"
                  >
                    <Copy size={12} />
                  </button>
                </div>

                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12 text-sm" style={{ color: 'var(--text3)' }}>
                    {transcriptSearch ? 'No matches found' : 'No transcript available for this session'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredMessages.map(m => {
                      const isRep = m.role === 'user';
                      const isHighlighted = highlightedMsgId === m.id;
                      return (
                        <div
                          key={m.id}
                          ref={el => { msgRefs.current[m.id] = el; }}
                          className={clsx('flex gap-2.5 py-1.5 transition-all duration-500', isRep ? 'flex-row-reverse' : 'flex-row')}
                          style={isHighlighted ? { background: 'rgba(91,111,255,0.08)', borderRadius: 10, padding: '8px' } : {}}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                            style={isRep
                              ? { background: 'rgba(91,111,255,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.3)' }
                              : { background: 'rgba(255,255,255,0.07)', color: 'var(--text2)', border: '1px solid var(--border2)' }
                            }
                          >
                            {isRep ? 'U' : personaName.charAt(0)}
                          </div>
                          <div className={clsx('flex flex-col gap-1 max-w-[78%]', isRep ? 'items-end' : 'items-start')}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-semibold" style={{ color: isRep ? 'var(--accent)' : 'var(--text3)' }}>
                                {isRep ? 'You' : personaName.split(' ')[0]}
                              </span>
                              {!isRep && <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(91,111,255,0.15)', color: 'var(--accent)' }}>AI</span>}
                              <button
                                className="flex items-center gap-1 text-[9.5px] font-mono transition-all hover:scale-105"
                                style={{ color: 'var(--text3)' }}
                                onClick={() => jumpToTimestamp(m.timestampMs)}
                                title="Jump to this moment"
                              >
                                <Play size={7} fill="currentColor" />
                                {fmt(m.timestampMs)}
                              </button>
                            </div>
                            <div
                              className="px-3 py-2.5 rounded-[10px] text-[12.5px] leading-relaxed"
                              style={isRep
                                ? { background: 'rgba(91,111,255,0.1)', border: '1px solid rgba(91,111,255,0.15)', color: 'var(--text)' }
                                : { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)' }
                              }
                            >
                              {highlightText(m.content, transcriptSearch)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS TAB ──────────────────────────────────────────────── */}
            {activeTab === 'analytics' && (
              <div className="flex flex-col gap-4">
                {!analytics ? (
                  <div className="rounded-[12px] border p-12 text-center" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                    <BarChart3 size={28} className="mx-auto mb-3" style={{ color: 'var(--text3)' }} />
                    <p className="text-sm" style={{ color: 'var(--text3)' }}>No analytics — session transcript is empty</p>
                  </div>
                ) : (
                  <>
                    {/* Talk ratio */}
                    <div className="rounded-[12px] border p-5" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <Mic size={13} style={{ color: 'var(--accent)' }} />
                        <span className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Talk / Listen Ratio</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4">
                        {[
                          { label: 'You spoke', pct: analytics.talkRatioPct, color: getRating('talkRatio', analytics.talkRatioPct).color },
                          { label: 'Prospect spoke', pct: analytics.listenRatioPct, color: 'rgba(255,255,255,0.15)' },
                        ].map(({ label, pct, color }) => (
                          <div key={label} className="flex-1">
                            <div className="flex justify-between mb-1.5">
                              <span className="text-[12px]" style={{ color: 'var(--text2)' }}>{label}</span>
                              <span className="font-display text-[18px] font-bold" style={{ color }}>{pct}%</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {(() => {
                        const r = getRating('talkRatio', analytics.talkRatioPct);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: r.color, background: `${r.color}18`, border: `1px solid ${r.color}35` }}>{r.label}</span>
                            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>Ideal range: 40–60% for active selling</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3 metric cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { icon: Gauge, label: 'Talk Speed', value: analytics.talkSpeedWpm, unit: 'wpm', ideal: '120–160 wpm', metric: 'talkSpeed' as const },
                        { icon: Activity, label: 'Filler Words', value: analytics.fillerWpm, unit: `per min (${analytics.fillerCount} total)`, ideal: '<1 per minute', metric: 'fillerWpm' as const },
                        { icon: Clock, label: 'Longest Monologue', value: fmtSecs(analytics.longestMonologueSecs), unit: 'uninterrupted', ideal: 'under 30 sec', metric: 'monologue' as const },
                      ].map(({ icon: Icon, label, value, unit, ideal, metric }) => {
                        const numValue = typeof value === 'number' ? value : analytics.longestMonologueSecs;
                        const r = getRating(metric, numValue);
                        return (
                          <div key={label} className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-2 mb-3">
                              <Icon size={12} style={{ color: 'var(--text3)' }} />
                              <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>{label}</span>
                            </div>
                            <div className="font-display text-[28px] font-bold leading-none mb-1" style={{ color: 'var(--text)' }}>
                              {typeof value === 'number' ? value.toFixed(value < 10 ? 2 : 0) : value}
                            </div>
                            <div className="text-[10.5px] mb-3" style={{ color: 'var(--text3)' }}>{unit}</div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: r.color, background: `${r.color}18`, border: `1px solid ${r.color}35` }}>{r.label}</span>
                            <div className="mt-1.5 text-[10px]" style={{ color: 'var(--text3)' }}>Target: {ideal}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── LEADERBOARD TAB ────────────────────────────────────────────── */}
            {activeTab === 'leaderboard' && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text)' }}>Peer Performance on This Scenario</div>
                  <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
                    How others scored on the same persona — {session.scenarioConfig?.displayName || session.persona?.name || 'this scenario'}
                  </p>
                </div>

                {/* My position callout */}
                {myPeerEntry && (
                  <div
                    className="flex items-center gap-4 p-4 rounded-[12px] border"
                    style={{ background: 'rgba(91,111,255,0.07)', borderColor: 'rgba(91,111,255,0.25)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-[15px] font-bold flex-shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>
                      #{myPeerEntry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>You ranked #{myPeerEntry.rank} out of {peerScores.length} reps</div>
                      <div className="text-[12px]" style={{ color: 'var(--text3)' }}>
                        {myPeerEntry.rank === 1 ? 'Top of the board!' : myPeerEntry.rank <= 3 ? 'Top 3 — strong performance' : 'Room to improve — see top performers below'}
                      </div>
                    </div>
                    <span className="font-display text-[24px] font-bold flex-shrink-0" style={scoreStyle(myPeerEntry.score)}>{myPeerEntry.score}</span>
                  </div>
                )}

                {/* Leaderboard table */}
                <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div
                    className="hidden sm:grid text-[10.5px] font-semibold uppercase tracking-wider px-4 py-2.5 border-b"
                    style={{ gridTemplateColumns: '40px 1fr 80px 80px', color: 'var(--text3)', background: 'var(--bg2)', borderColor: 'var(--border)' }}
                  >
                    <div>#</div><div>Rep</div><div className="text-center">Score</div><div className="text-right">vs You</div>
                  </div>
                  <div
                    className="sm:hidden text-[10.5px] font-semibold uppercase tracking-wider px-4 py-2.5 border-b flex justify-between"
                    style={{ color: 'var(--text3)', background: 'var(--bg2)', borderColor: 'var(--border)' }}
                  >
                    <span>Rep</span><span>Score</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {peerScores.map((p, i) => {
                      const isMe = p.userId === currentUserId;
                      const delta = session.totalScore != null ? p.score - session.totalScore : null;
                      return (
                        <motion.div
                          key={p.userId}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          style={{ background: isMe ? 'rgba(91,111,255,0.06)' : 'transparent' }}
                        >
                          {/* Mobile row */}
                          <div className="sm:hidden flex items-center justify-between px-4 py-3 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 flex-shrink-0">
                                {p.rank <= 3 ? (
                                  <Trophy size={13} style={{ color: p.rank === 1 ? '#FFD166' : p.rank === 2 ? '#aaa' : '#cd7f32' }} />
                                ) : (
                                  <span className="text-[11px] font-mono" style={{ color: 'var(--text3)' }}>{p.rank}</span>
                                )}
                              </div>
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                style={isMe ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--bg3)', color: 'var(--text2)' }}
                              >
                                {p.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="text-[13px] truncate" style={{ color: isMe ? 'var(--accent)' : 'var(--text)', fontWeight: isMe ? 600 : 400 }}>
                                {isMe ? 'You' : p.name}
                              </span>
                            </div>
                            <span className="inline-flex items-center justify-center w-10 h-6 rounded-[7px] text-[12px] font-bold font-display flex-shrink-0" style={scoreBadgeStyle(p.score)}>
                              {p.score}
                            </span>
                          </div>
                          {/* Desktop row */}
                          <div
                            className="hidden sm:grid items-center px-4 py-3"
                            style={{ gridTemplateColumns: '40px 1fr 80px 80px' }}
                          >
                            <div>
                              {p.rank <= 3 ? (
                                <Trophy size={14} style={{ color: p.rank === 1 ? '#FFD166' : p.rank === 2 ? '#aaa' : '#cd7f32' }} />
                              ) : (
                                <span className="text-[12px] font-mono" style={{ color: 'var(--text3)' }}>{p.rank}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                style={isMe ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--bg3)', color: 'var(--text2)' }}
                              >
                                {p.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="text-[13px] truncate" style={{ color: isMe ? 'var(--accent)' : 'var(--text)', fontWeight: isMe ? 600 : 400 }}>
                                {isMe ? 'You' : p.name}
                              </span>
                              {isMe && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(91,111,255,0.2)', color: 'var(--accent)' }}>You</span>}
                            </div>
                            <div className="text-center">
                              <span className="inline-flex items-center justify-center w-10 h-6 rounded-[7px] text-[12px] font-bold font-display" style={scoreBadgeStyle(p.score)}>
                                {p.score}
                              </span>
                            </div>
                            <div className="text-right text-[12px] font-mono">
                              {isMe ? <span style={{ color: 'var(--text3)' }}>—</span> : delta != null ? (
                                <span style={{ color: delta > 0 ? 'var(--accent4)' : delta < 0 ? 'var(--accent3)' : 'var(--text3)' }}>
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              ) : '—'}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Practice again nudge */}
                <div
                  className="flex items-center gap-4 p-4 rounded-[12px] border"
                  style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(6,214,160,0.1)' }}>
                    <RefreshCw size={16} style={{ color: 'var(--accent3)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Want to move up the board?</div>
                    <div className="text-[12px]" style={{ color: 'var(--text3)' }}>
                      {myPeerEntry && myPeerEntry.rank > 1
                        ? `${peerScores[myPeerEntry.rank - 2]?.name || 'The next rep'} is ${Math.abs((peerScores[myPeerEntry.rank - 2]?.score ?? 0) - myPeerEntry.score)} points ahead — practice this scenario again to close the gap.`
                        : 'Keep your lead — practice again to stay sharp.'
                      }
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/practice')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[9px] text-[12.5px] font-semibold flex-shrink-0 transition-all hover:scale-105"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    <RotateCcw size={12} /> Practice Again
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-0 rounded-[16px] border overflow-hidden animate-pulse" style={{ minHeight: 'calc(100vh - 120px)', borderColor: 'var(--border)' }}>
      <div className="h-32 border-b" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }} />
      <div className="h-12 border-b" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }} />
      <div className="flex-1 p-6 flex flex-col gap-4" style={{ background: 'var(--bg)' }}>
        <div className="h-24 rounded-xl" style={{ background: 'var(--bg2)' }} />
        <div className="h-20 rounded-xl" style={{ background: 'var(--bg2)' }} />
        <div className="h-20 rounded-xl" style={{ background: 'var(--bg2)' }} />
      </div>
    </div>
  );
}
