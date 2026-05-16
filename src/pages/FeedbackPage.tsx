// pitchiq/frontend/src/pages/FeedbackPage.tsx

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { RefreshCw, Share2, ChevronRight, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Lightbulb, Play, Pause, Search, Copy, Download, MessageSquare, Clock, Shield, BarChart3, Gauge, Activity, Mic, ChevronDown, CircleAlert as AlertCircle, X, Info, Trophy, RotateCcw, Zap, Target, ChevronLeft } from 'lucide-react';
import { sessionsApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Session, ParsedFeedback, FRAMEWORK_INFO, ScorecardGroup } from '@/types';
import clsx from 'clsx';

type Tab = 'scorecard' | 'transcript' | 'analytics' | 'objections' | 'leaderboard';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'scorecard',   label: 'Scorecard',   icon: Target       },
  { id: 'transcript',  label: 'Transcript',  icon: MessageSquare },
  { id: 'analytics',  label: 'Analytics',   icon: BarChart3     },
  { id: 'objections',  label: 'Objections',  icon: Shield        },
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

// ── Coaching content helpers ──────────────────────────────────────────────────

function getComponentCoaching(component: string, passed: boolean, framework: string): string {
  const c = component.toLowerCase();
  if (c.includes('metric')) return passed
    ? 'You surfaced quantifiable impact — now push further: get them to put a dollar figure on the cost of inaction. Numbers-per-month create urgency.'
    : 'You need to anchor every conversation in numbers. Ask: "What does this problem cost you each quarter?" — then use that figure throughout the rest of the call.';
  if (c.includes('economic buyer') || c.includes('economic')) return passed
    ? 'Good — you identified the real decision-maker. Now get them on the next call or get your champion to brief them directly with a one-pager.'
    : 'The economic buyer is the only person who can say yes to the budget. Before next call, ask your contact: "Who ultimately approves spend of this size, and what does their decision process look like?"';
  if (c.includes('decision criteria') || c.includes('criteria')) return passed
    ? 'You mapped their criteria well. Next step: create a scoring matrix that shows how your solution rates on each one — send it before the demo.'
    : 'Before any demo, ask: "What would an ideal vendor look like to you?" — write down every criterion they mention, then build your pitch around their own words.';
  if (c.includes('decision process') || c.includes('process')) return passed
    ? 'You understand how they decide. Make sure you have a mutual success plan in writing — set a decision deadline with the prospect.'
    : 'Ask: "Walk me through how a decision like this typically gets made — who else needs to be involved, and what are the key milestones?" This prevents last-minute surprises.';
  if (c.includes('identify pain') || c.includes('pain')) return passed
    ? 'Pain was clearly established — now quantify it. A pain that costs $200K/year is a lot more compelling than "we have inefficiencies".'
    : 'You need 3 levels of pain: surface problem, business impact, personal impact on your contact. Use SPIN: "What happens if this isn\'t resolved in the next 6 months?"';
  if (c.includes('champion')) return passed
    ? 'You have a champion — now arm them. Give them the 3-sentence pitch for their internal conversations and a 1-page ROI summary they can forward.'
    : 'Find the person who will fight for you internally and needs your solution to succeed. Ask: "Who else in your org would be most excited about this outcome?"';
  if (c.includes('competition') || c.includes('competitor')) return passed
    ? 'You handled competition well. Reinforce your differentiation with a specific win story from a similar company.'
    : 'When competition comes up, don\'t dismiss it — acknowledge it, then pivot: "That\'s a solid tool for X. What we uniquely do is Y, which matters a lot when you need Z."';
  if (c.includes('situation')) return passed
    ? 'Good situation mapping — now use those facts to set up problem questions. The situation alone doesn\'t create urgency.'
    : 'Gather context efficiently: ask 2–3 targeted situation questions upfront, not 10 — too many feel like an interrogation.';
  if (c.includes('problem')) return passed
    ? 'You uncovered problems — push to implications. A problem that has no cost stays unsolved.'
    : 'After identifying a problem, ask: "How long has this been an issue?" and "What have you tried before?" — this reveals if they\'re actually ready to solve it.';
  if (c.includes('implication')) return passed
    ? 'You made the pain felt — now direct that pain toward your solution with a needs-payoff question.'
    : 'Implication questions make problems painful enough to act on: "If this continues, what does that mean for your team\'s targets next year?"';
  if (c.includes('need') || c.includes('payoff')) return passed
    ? 'Needs-payoff landed well — the prospect articulated the value themselves, which is the most powerful form of selling.'
    : 'Get the prospect to say the value out loud: "If we could eliminate that problem, how valuable would that be for your team?" — their words, not yours.';
  if (c.includes('budget') || c.includes('bant')) return passed
    ? 'Budget confirmed — good. Now tie every conversation back to ROI so the number stays justified as you go through approvals.'
    : 'Qualify budget early, not late: "Is there budget allocated for solving this, or would it need to be approved?" — saves everyone\'s time.';
  if (c.includes('authority')) return passed
    ? 'You\'re talking to the right person — make sure they\'re also your champion, not just the gatekeeper.'
    : 'Confirm authority by asking: "Are you the one who would make the final call, or are others involved?" — do this early, before investing in a full demo cycle.';
  if (c.includes('timeline')) return passed
    ? 'Timeline is set — create a mutual success plan with agreed milestones so the timeline stays accountable.'
    : 'Create urgency around timeline: ask "What\'s your target go-live date?" and "What happens to that goal if you don\'t have a solution by then?"';
  if (c.includes('teach') || c.includes('tailor') || c.includes('control') || c.includes('challenger')) return passed
    ? 'Good challenger approach — keep reframing their thinking with insights they haven\'t considered yet.'
    : 'Lead with insight: share a data point or observation that reframes their problem, then connect it to how your solution uniquely solves it.';
  if (c.includes('simple') || c.includes('snap')) return passed
    ? 'Your message was clear — ensure each follow-up communication is equally crisp.'
    : 'SNAP principle: keep your pitch simple, invaluable, aligned to their priorities. Remove any feature-talk that isn\'t solving their stated pain.';
  if (c.includes('closing') || c.includes('close')) return passed
    ? 'Good close — make sure you confirmed next steps in writing within 24 hours.'
    : 'Always close with a specific next step: "Let\'s block 30 minutes Thursday to review this with your team — does 2pm work?" — vague "I\'ll be in touch" kills momentum.';
  if (c.includes('objection')) return passed
    ? 'Strong objection handling — continue using the Feel-Felt-Found or Acknowledge-Align-Pivot framework consistently.'
    : 'When an objection lands, don\'t defend immediately. First: "That\'s a fair concern — I hear that a lot. Can you tell me more about what\'s driving that?" — understand before you respond.';
  return passed
    ? 'You scored well here — focus on consistency and making this a repeatable habit in every call.'
    : `Review the evidence above and prepare 2–3 specific phrases you can use to strengthen ${component.toLowerCase()} in your next call.`;
}

function getComponentPhrase(component: string, _framework: string): string {
  const c = component.toLowerCase();
  if (c.includes('metric')) return "What does this problem cost you each month in lost productivity or revenue?";
  if (c.includes('economic buyer') || c.includes('economic')) return "Who else would need to be involved in approving a decision like this?";
  if (c.includes('decision criteria') || c.includes('criteria')) return "What does an ideal outcome look like for you — what would a successful vendor need to deliver?";
  if (c.includes('decision process') || c.includes('process')) return "Can you walk me through how a decision of this size typically gets made at your company?";
  if (c.includes('identify pain') || c.includes('pain')) return "What happens to your team's goals if this isn't resolved in the next quarter?";
  if (c.includes('champion')) return "Who else in your organization would benefit most from this — someone who'd really champion this internally?";
  if (c.includes('situation')) return "Tell me about your current setup — how does your team handle this today?";
  if (c.includes('problem')) return "What's the biggest challenge you're running into with your current approach?";
  if (c.includes('implication')) return "If this keeps going the way it is, what does that mean for your targets by end of year?";
  if (c.includes('need') || c.includes('payoff')) return "If we could eliminate that completely, how big of an impact would that have for your team?";
  if (c.includes('budget')) return "Is there budget set aside for solving this, or would this need to go through an approval process?";
  if (c.includes('authority')) return "Are you the primary decision-maker here, or would others need to weigh in before moving forward?";
  if (c.includes('timeline')) return "What's your target date to have something in place — and what's driving that timeline?";
  if (c.includes('closing') || c.includes('close')) return "What would need to be true for you to be comfortable moving forward with us?";
  if (c.includes('objection')) return "That's a really common concern — can you help me understand what's driving that for you specifically?";
  return "What would make this an easy decision for you?";
}

function getObjectionModelResponse(objection: string): string {
  const o = objection.toLowerCase();
  if (o.includes('price') || o.includes('expensive') || o.includes('cost') || o.includes('cheaper')) {
    return "I understand cost is a factor. Let me ask — what does it cost you today to not solve this? Most of our customers find the ROI within 3 months. Would it help if we built out a quick business case together?";
  }
  if (o.includes('already have') || o.includes('current') || o.includes('use') || o.includes('competitor')) {
    return "That makes sense — switching tools is a real investment. What I'd ask is: what's the one thing your current solution doesn't do that you wish it did? That gap is usually where we can add the most value.";
  }
  if (o.includes('timing') || o.includes('not now') || o.includes('bad time') || o.includes('quarter')) {
    return "I hear you — timing matters. Can I ask what changes in Q2 that makes this a better time? I want to make sure we're working on your timeline, not ours.";
  }
  if (o.includes('think about') || o.includes('get back') || o.includes('consider')) {
    return "Of course — this is a meaningful decision. What are the main things you're weighing? If I can answer those now, it might save you some back and forth.";
  }
  if (o.includes('decision') || o.includes('approve') || o.includes('stakeholder') || o.includes('board')) {
    return "Totally makes sense. Who else needs to be part of the conversation? I'd love to help you put together a one-page summary that makes the case internally — would that be useful?";
  }
  if (o.includes('trust') || o.includes('proven') || o.includes('risk') || o.includes('too new')) {
    return "That's a fair concern. Let me share a specific example — [Company similar to theirs] had the same concern, and here's how they de-risked it: they started with a 30-day pilot. Would that kind of approach work for you?";
  }
  return "That's worth exploring. Help me understand — is that a definite no, or more of a 'not yet unless the right conditions are met'? I want to make sure I'm respecting your time and your priorities.";
}

function getObjectionTip(objection: string, framework: string): string {
  const o = objection.toLowerCase();
  const f = framework.toUpperCase();
  if (o.includes('price') || o.includes('expensive') || o.includes('cost')) {
    return `${f} tip: Price objections are really ROI objections. Build your metrics case first — if you've quantified their pain (M in MEDDIC), the price conversation becomes a math problem, not a value debate.`;
  }
  if (o.includes('timing') || o.includes('not now')) {
    return `${f} tip: "Not now" means the urgency isn't high enough yet. Use implication questions to raise the cost of waiting — "What happens to [their goal] if this isn't solved by [their deadline]?"`;
  }
  if (o.includes('already have') || o.includes('competitor')) {
    return `${f} tip: Don't knock the competition — acknowledge it, then ask what they wish their current tool did differently. That gap is your wedge. Teach them something they don't know about what's possible.`;
  }
  return `Use the Acknowledge-Align-Pivot technique: (1) Acknowledge the concern genuinely, (2) Align with a shared goal, (3) Pivot to how you address it with specifics. Avoid defending; ask a clarifying question first.`;
}

function getQuickCoachingTip(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('permission')) return 'Ask: "Do you have 30 seconds for me to explain why I\'m calling?" — this tiny ask dramatically increases engagement.';
  if (q.includes('research') || q.includes('prospect')) return 'Mention one specific thing about their company or role before pitching — shows preparation and earns attention.';
  if (q.includes('preconception') || q.includes('awareness')) return 'Ask: "What do you know about [product category] today?" — their answer shapes your entire pitch.';
  if (q.includes('social proof')) return 'Name a customer they\'d recognise and their result: "We helped [Company] achieve X in 90 days."';
  if (q.includes('relevant')) return 'After citing proof, ask: "Is that the kind of challenge you\'re dealing with too?" — makes it personal.';
  if (q.includes('timing') || q.includes('time works')) return 'Close with: "Before we wrap — does this timing work for you, or is there a better moment to follow up?"';
  if (q.includes('success criteria')) return 'Ask: "What would make the next conversation worth your time?" — then design your follow-up around their answer.';
  if (q.includes('next step') || q.includes('next steps')) return 'Always close with a specific, time-bound next step — "Can we block 20 minutes Thursday?" beats "I\'ll be in touch."';
  if (q.includes('follow-up') || q.includes('meeting booked')) return 'Book the meeting before ending the call — sending a calendar link after means competing for attention.';
  if (q.includes('agenda')) return 'Open every call: "Here\'s what I was hoping to cover — does that work, and is there anything you\'d like to add?"';
  if (q.includes('upfront contract')) return 'Set expectations early: "By the end of our time, my goal is X. For that to make sense, I\'d need to learn Y from you. Does that sound fair?"';
  if (q.includes('pain')) return 'Dig past surface pain: ask "How long has this been an issue?" and "What have you tried?" — these reveal real urgency.';
  if (q.includes('metric')) return 'Quantify the pain: "What does this cost you per month — in time, revenue, or team frustration?"';
  if (q.includes('fff') || q.includes('objection')) return 'Use Feel-Felt-Found: "I understand how you feel — others have felt the same way — what they found was…" then present evidence.';
  if (q.includes('customer reference') || q.includes('reference')) return 'Pick a customer from a similar industry or company size — relevance multiplies the impact of social proof.';
  if (q.includes('goal') || q.includes('framework')) return 'Ask: "How do you measure success for your team this quarter?" — anchor your value to their own targets.';
  if (q.includes('qualify')) return 'Confirm fit before closing: "Based on everything we\'ve covered, does it make sense to explore this further?"';
  if (q.includes('anchor') || q.includes('concession')) return 'Never make the first concession — ask for something in return: "If I can do X, can you commit to Y?"';
  if (q.includes('relationship')) return 'Acknowledge pressure points: "I know this is a tough conversation — let\'s find something that works for both of us."';
  return 'Review this criterion in the transcript and prepare a specific phrase to address it in your next call.';
}

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
  const [lastJumpMs, setLastJumpMs]       = useState<number | null>(null);
  const [audioBarFlash, setAudioBarFlash] = useState(false);
  const jumpLabelRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioFlashRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const audioBarRef = useRef<HTMLDivElement>(null);
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
        if (data.recordingUrl) setPlaybackUrl(data.recordingUrl);
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

  const pendingSeekRef = useRef<number | null>(null);

  const seekTo = useCallback((seconds: number) => {
    if (!audioRef.current) {
      pendingSeekRef.current = seconds;
      return;
    }
    const el = audioRef.current;
    const doSeek = () => {
      el.currentTime = seconds;
      el.play().catch(() => {});
      setIsPlaying(true);
    };
    if (el.readyState >= 1) {
      doSeek();
    } else {
      pendingSeekRef.current = seconds;
      el.addEventListener('loadedmetadata', () => {
        if (pendingSeekRef.current !== null) {
          el.currentTime = pendingSeekRef.current;
          el.play().catch(() => {});
          setIsPlaying(true);
          pendingSeekRef.current = null;
        }
      }, { once: true });
    }
  }, []);

  const jumpToTimestamp = useCallback((timestampMs: number, switchToTranscript = false) => {
    seekTo(timestampMs / 1000);
    // Scroll audio bar into view and flash it
    audioBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setAudioBarFlash(true);
    if (audioFlashRef.current) clearTimeout(audioFlashRef.current);
    audioFlashRef.current = setTimeout(() => setAudioBarFlash(false), 1200);
    // Pulse the header timeline marker
    setLastJumpMs(timestampMs);
    if (jumpLabelRef.current) clearTimeout(jumpLabelRef.current);
    jumpLabelRef.current = setTimeout(() => setLastJumpMs(null), 2800);
    // Find nearest message for transcript highlighting
    const messages = session?.messages || [];
    let nearest = messages[0];
    for (const m of messages) {
      if (Math.abs(m.timestampMs - timestampMs) < Math.abs((nearest?.timestampMs ?? 0) - timestampMs)) nearest = m;
    }
    if (nearest) {
      setHighlightedMsgId(nearest.id);
      if (switchToTranscript) {
        setActiveTab('transcript');
        setTimeout(() => {
          msgRefs.current[nearest.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
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

  const scores         = session.frameworkScores || [];
  const scorecardGroups: ScorecardGroup[] = feedback?.scorecardGroups || [];
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

        {/* Audio player — always visible */}
        <div
          ref={audioBarRef}
          className="mt-3 pt-3 border-t transition-all duration-300"
          style={{
            borderColor: 'var(--border)',
            boxShadow: audioBarFlash ? '0 0 0 2px var(--accent)' : undefined,
            borderRadius: audioBarFlash ? '10px' : undefined,
          }}
        >
          {playbackUrl && (
            <audio
              ref={el => {
                audioRef.current = el;
                if (el) {
                  el.onloadedmetadata = () => {
                    setAudioDuration(el.duration);
                    if (pendingSeekRef.current !== null) {
                      el.currentTime = pendingSeekRef.current;
                      el.play().catch(() => {});
                      setIsPlaying(true);
                      pendingSeekRef.current = null;
                    }
                  };
                  el.ontimeupdate = () => setAudioProgress(el.currentTime);
                  el.onplay = () => setIsPlaying(true);
                  el.onpause = () => setIsPlaying(false);
                  el.onended = () => { setIsPlaying(false); setAudioProgress(0); };
                }
              }}
              src={playbackUrl}
              preload="metadata"
            />
          )}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                disabled={!playbackUrl}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: 'rgba(91,111,255,0.15)', border: '1px solid rgba(91,111,255,0.3)', color: 'var(--accent)' }}
              >
                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
              </button>
              <span className="text-[10px] font-mono flex-shrink-0 w-9" style={{ color: 'var(--text3)' }}>{fmt(audioProgress * 1000)}</span>
              <div
                ref={trackRef}
                onClick={playbackUrl ? handleTrackClick : undefined}
                className={clsx('flex-1 h-[5px] rounded-full relative', playbackUrl ? 'cursor-pointer' : 'cursor-default')}
                style={{ background: 'var(--bg4)' }}
              >
                {/* Event markers */}
                {sortedEvents.map(e => {
                  const pct = totalDurMs > 0 ? Math.min(99, (e.timestampMs / totalDurMs) * 100) : 0;
                  const dotColor = e.type === 'GOOD' ? '#06D6A0' : e.type === 'ISSUE' ? '#FF6B6B' : e.type === 'WARNING' ? '#FFD166' : '#888';
                  const isActive = activeEventId === e.id;
                  const isPulsing = lastJumpMs !== null && Math.abs(e.timestampMs - lastJumpMs) < 5000;
                  return (
                    <div
                      key={e.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer z-10"
                      style={{ left: `${pct}%` }}
                      title={`${fmt(e.timestampMs)} — ${e.title}`}
                      onClick={ev => { ev.stopPropagation(); jumpToTimestamp(e.timestampMs); setActiveEventId(e.id); }}
                    >
                      {/* Pulse ring when jumped-to */}
                      {isPulsing && (
                        <div
                          className="absolute inset-0 -m-1.5 rounded-full animate-ping"
                          style={{ background: `${dotColor}40` }}
                        />
                      )}
                      <div
                        className={`w-2.5 h-2.5 rounded-full border-2 transition-transform ${isActive ? 'scale-150' : 'hover:scale-150'}`}
                        style={{ background: dotColor, borderColor: 'var(--bg2)', boxShadow: isPulsing ? `0 0 0 2px ${dotColor}` : undefined }}
                      />
                    </div>
                  );
                })}
                {/* Progress fill */}
                {playbackUrl && (
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
                )}
                {/* No recording indicator */}
                {!playbackUrl && (
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[9px]" style={{ color: 'var(--text3)' }}>No recording available</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text3)' }}>
                {audioDuration ? fmt(audioDuration * 1000) : session.durationSeconds ? fmt(session.durationSeconds * 1000) : '--:--'}
              </span>
              <button
                onClick={() => { if (playbackUrl) { const a = document.createElement('a'); a.href = playbackUrl; a.download = `session-${id}.mp3`; a.click(); } }}
                title="Download"
                disabled={!playbackUrl}
                style={{ color: 'var(--text3)' }}
                className="hover:text-white transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Download size={13} />
              </button>
            </div>
        </div>
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

                {/* ── Rubric scorecard (criteria groups) ── */}
                {scorecardGroups.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {/* Total score bar */}
                    {(() => {
                      const total = scorecardGroups.reduce((a, g) => a + g.maxPoints, 0);
                      const earned = scorecardGroups.reduce((a, g) => a + g.earnedPoints, 0);
                      const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
                      const color = pct >= 70 ? '#06D6A0' : pct >= 50 ? '#FFD166' : '#FF6B6B';
                      return (
                        <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Roleplay Scorecard</div>
                              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text3)' }}>
                                {scorecardGroups.reduce((a, g) => a + g.criteria.filter(c => c.passed).length, 0)} of {scorecardGroups.reduce((a, g) => a + g.criteria.length, 0)} criteria met
                              </div>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-display text-[28px] font-bold" style={{ color }}>{earned}</span>
                              <span className="text-[14px]" style={{ color: 'var(--text3)' }}>/ {total}</span>
                            </div>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <div className="flex gap-3 mt-2.5 flex-wrap">
                            {scorecardGroups.map(g => {
                              const gc = g.earnedPoints === g.maxPoints ? '#06D6A0' : g.earnedPoints === 0 ? '#FF6B6B' : '#FFD166';
                              return (
                                <div key={g.group} className="flex items-center gap-1.5">
                                  <span className="text-[9.5px] font-bold" style={{ color: gc }}>{g.group}</span>
                                  <span className="text-[9.5px]" style={{ color: 'var(--text3)' }}>{g.earnedPoints}/{g.maxPoints}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Criterion groups accordion */}
                    {scorecardGroups.map((group, gi) => {
                      const groupId = `sg-${gi}`;
                      const isOpen = expandedId === groupId;
                      const groupColor = group.earnedPoints === group.maxPoints ? '#06D6A0' : group.earnedPoints === 0 ? '#FF6B6B' : '#FFD166';
                      return (
                        <div key={gi} className="rounded-[12px] border overflow-hidden" style={{ borderColor: isOpen ? 'rgba(91,111,255,0.3)' : 'var(--border)', background: 'var(--bg2)' }}>
                          <button
                            onClick={() => setExpandedId(isOpen ? null : groupId)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${groupColor}18`, color: groupColor, border: `1px solid ${groupColor}35` }}>
                              {group.earnedPoints}/{group.maxPoints}
                            </div>
                            <span className="flex-1 text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{group.group}</span>
                            <div className="hidden sm:flex gap-1 mr-2">
                              {group.criteria.map((c, ci) => (
                                <div key={ci} className="w-2 h-2 rounded-full" style={{ background: c.passed ? '#06D6A0' : '#FF6B6B' }} />
                              ))}
                            </div>
                            <ChevronDown size={14} className={clsx('flex-shrink-0 transition-transform', isOpen && 'rotate-180')} style={{ color: 'var(--text3)' }} />
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
                                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                                  {group.criteria.map((criterion, ci) => {
                                    // Extract any timestamp from reasoning text e.g. "at 0:28" or "2:45"
                                    const tsInReasoning = criterion.reasoning?.match(/\b(\d+):(\d{2})\b/);
                                    const criterionTsMs = tsInReasoning ? (parseInt(tsInReasoning[1]) * 60 + parseInt(tsInReasoning[2])) * 1000 : null;
                                    return (
                                    <div
                                      key={ci}
                                      className={clsx('px-4 py-3.5 flex gap-3', ci > 0 && 'border-t')}
                                      style={{ borderColor: 'var(--border)', background: criterion.passed ? 'rgba(6,214,160,0.02)' : 'rgba(255,107,107,0.02)' }}
                                    >
                                      <div className="flex-shrink-0 mt-0.5">
                                        {criterion.passed
                                          ? <CheckCircle size={15} style={{ color: '#06D6A0' }} />
                                          : <X size={15} style={{ color: '#FF6B6B' }} />
                                        }
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                          <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{criterion.question}</span>
                                          {criterionTsMs !== null && (
                                            <button
                                              onClick={() => jumpToTimestamp(criterionTsMs)}
                                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10px] font-medium flex-shrink-0 transition-all hover:scale-105"
                                              style={{ background: 'rgba(91,111,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.2)' }}
                                              title={`Seek audio to ${fmt(criterionTsMs)}`}
                                            >
                                              <Play size={7} fill="currentColor" /> {fmt(criterionTsMs)}
                                            </button>
                                          )}
                                        </div>
                                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text3)' }}>{criterion.reasoning}</p>
                                        {!criterion.passed && (
                                          <div className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed" style={{ color: '#FFD166' }}>
                                            <Lightbulb size={10} className="flex-shrink-0 mt-0.5" />
                                            {getQuickCoachingTip(criterion.question)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-shrink-0">
                                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={criterion.passed
                                          ? { background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.25)' }
                                          : { background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.25)' }
                                        }>
                                          {criterion.passed ? 'Pass' : 'Fail'}
                                        </span>
                                      </div>
                                    </div>
                                  ); })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Divider between rubric and framework scores */}
                {scorecardGroups.length > 0 && scores.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Sales Methodology ({FRAMEWORK_INFO[session.framework]?.label})</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>
                )}

                {/* Quick summary pills */}
                <div className={clsx('grid gap-3', scorecardGroups.length > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}>
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
                                                  onClick={() => jumpToTimestamp(tsMs, true)}
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

                                  {/* What to do next time — rich coaching */}
                                  <div className={clsx('mt-4 p-3.5 rounded-[10px] border', passed ? 'border-[rgba(6,214,160,0.2)]' : 'border-[rgba(255,209,102,0.2)]')}
                                    style={{ background: passed ? 'rgba(6,214,160,0.04)' : 'rgba(255,209,102,0.05)' }}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Lightbulb size={11} style={{ color: passed ? '#06D6A0' : '#FFD166' }} />
                                      <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: passed ? '#06D6A0' : '#FFD166' }}>
                                        {passed ? 'How to make this even stronger' : 'Specific action for next call'}
                                      </span>
                                    </div>
                                    <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text2)' }}>
                                      {getComponentCoaching(score.component, passed, session.framework)}
                                    </p>
                                    {/* Try this phrase */}
                                    {!passed && (
                                      <div className="flex items-start gap-2 px-3 py-2 rounded-[8px]" style={{ background: 'rgba(91,111,255,0.08)', border: '1px solid rgba(91,111,255,0.2)' }}>
                                        <Zap size={10} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                                        <div>
                                          <div className="text-[9.5px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--accent)' }}>Try this phrase</div>
                                          <p className="text-[12px] italic" style={{ color: 'var(--text2)' }}>
                                            "{getComponentPhrase(score.component, session.framework)}"
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
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
                                onClick={() => jumpToTimestamp(ev.timestampMs)}
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

                {/* AI Coach debrief */}
                {feedback && (
                  <div className="flex flex-col gap-3 mt-1">
                    {/* Overall narrative */}
                    {feedback.overallFeedback && (
                      <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'rgba(91,111,255,0.2)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,111,255,0.15)' }}>
                            <Zap size={10} style={{ color: 'var(--accent)' }} />
                          </div>
                          <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>AI Coach Summary</span>
                        </div>
                        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{feedback.overallFeedback}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Strengths */}
                      <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'rgba(6,214,160,0.2)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle size={13} style={{ color: '#06D6A0' }} />
                          <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>What You Did Well</span>
                        </div>
                        <ul className="flex flex-col gap-2.5">
                          {feedback.strengths.map((s, i) => (
                            <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                              <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px] font-bold" style={{ background: 'rgba(6,214,160,0.15)', color: '#06D6A0' }}>✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Improvements */}
                      <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'rgba(255,209,102,0.2)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={13} style={{ color: '#FFD166' }} />
                          <span className="font-display text-[13px] font-bold" style={{ color: 'var(--text)' }}>Fix These Next Call</span>
                        </div>
                        <ul className="flex flex-col gap-2.5">
                          {feedback.improvements.map((s, i) => (
                            <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                              <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px] font-bold" style={{ background: 'rgba(255,209,102,0.15)', color: '#FFD166' }}>→</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Pro Tip */}
                    <div className="rounded-[12px] border p-4 flex gap-3" style={{ background: 'rgba(91,111,255,0.06)', borderColor: 'rgba(91,111,255,0.2)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,111,255,0.15)' }}>
                        <Lightbulb size={14} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--accent)' }}>Coach's Pro Tip</div>
                        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{feedback.proTip}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Objections teaser — full tab available */}
                {objections.length > 0 && (
                  <button
                    onClick={() => setActiveTab('objections')}
                    className="flex items-center justify-between w-full p-3.5 rounded-[12px] border transition-all hover:border-[rgba(255,107,107,0.4)] hover:bg-[rgba(255,107,107,0.04)] group"
                    style={{ background: 'rgba(255,107,107,0.04)', borderColor: 'rgba(255,107,107,0.2)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield size={14} style={{ color: 'var(--accent4)' }} />
                      <div className="text-left">
                        <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Objection Handling Review</div>
                        <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{objections.length} objection{objections.length !== 1 ? 's' : ''} loaded — see how you handled each one</div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform flex-shrink-0" style={{ color: 'var(--text3)' }} />
                  </button>
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
                              <span className="text-[9.5px] font-mono" style={{ color: 'var(--text3)' }}>
                                {fmt(m.timestampMs)}
                              </span>
                            </div>
                            <button
                              className="group/bubble relative text-left px-3 py-2.5 rounded-[10px] text-[12.5px] leading-relaxed transition-all hover:brightness-110 active:scale-[0.98]"
                              style={isRep
                                ? { background: 'rgba(91,111,255,0.1)', border: '1px solid rgba(91,111,255,0.15)', color: 'var(--text)' }
                                : { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)' }
                              }
                              onClick={() => jumpToTimestamp(m.timestampMs)}
                              title={`Play from ${fmt(m.timestampMs)}`}
                            >
                              {highlightText(m.content, transcriptSearch)}
                              {/* Play icon overlay on hover */}
                              <span
                                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/bubble:opacity-100 transition-opacity pointer-events-none"
                                style={{ background: 'rgba(91,111,255,0.85)' }}
                              >
                                <Play size={8} fill="white" color="white" />
                              </span>
                            </button>
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
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: r.color, background: `${r.color}18`, border: `1px solid ${r.color}35` }}>{r.label}</span>
                              <span className="text-[11px]" style={{ color: 'var(--text3)' }}>Ideal range: 40–60% for active selling</span>
                            </div>
                            {analytics.talkRatioPct > 70 && (
                              <span className="text-[11px] flex items-center gap-1" style={{ color: '#FFD166' }}>
                                <Lightbulb size={10} /> Ask more questions — stop selling, start listening
                              </span>
                            )}
                            {analytics.talkRatioPct < 30 && (
                              <span className="text-[11px] flex items-center gap-1" style={{ color: '#FFD166' }}>
                                <Lightbulb size={10} /> You went quiet — guide the conversation more actively
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3 metric cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { icon: Gauge, label: 'Talk Speed', value: analytics.talkSpeedWpm, unit: 'wpm', ideal: '120–160 wpm', metric: 'talkSpeed' as const,
                          tip: analytics.talkSpeedWpm > 160 ? 'Slow down — prospects need time to absorb your pitch. Pause after key claims.' : analytics.talkSpeedWpm < 100 && analytics.talkSpeedWpm > 0 ? 'Speed up slightly — a too-slow pace can lose attention. Aim for 130–150 wpm.' : null },
                        { icon: Activity, label: 'Filler Words', value: analytics.fillerWpm, unit: `per min (${analytics.fillerCount} total)`, ideal: '<1 per minute', metric: 'fillerWpm' as const,
                          tip: analytics.fillerWpm > 2 ? 'Replace fillers with deliberate pauses — silence projects confidence and gives you time to think.' : null },
                        { icon: Clock, label: 'Longest Monologue', value: fmtSecs(analytics.longestMonologueSecs), unit: 'uninterrupted', ideal: 'under 30 sec', metric: 'monologue' as const,
                          tip: analytics.longestMonologueSecs > 45 ? 'Break up long stretches with a check-in question: "Does that resonate with what you\'re seeing?" — keeps the prospect engaged.' : null },
                      ].map(({ icon: Icon, label, value, unit, ideal, metric, tip }) => {
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
                            {tip && (
                              <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed pt-2.5" style={{ color: '#FFD166', borderTop: '1px solid var(--border)' }}>
                                <Lightbulb size={9} className="flex-shrink-0 mt-0.5" />
                                {tip}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Question quality analysis */}
                    {(() => {
                      const msgs = session?.messages || [];
                      const repMsgs = msgs.filter(m => m.role === 'user');
                      const questions = repMsgs.filter(m => m.content.includes('?'));
                      const openEnded = questions.filter(m => /^(what|how|why|tell me|describe|walk me|can you explain|help me understand)/i.test(m.content.trim()));
                      const closedYesNo = questions.filter(m => /^(do|did|does|is|are|was|were|have|has|can|could|would|will|should)/i.test(m.content.trim()));
                      if (questions.length === 0) return null;
                      return (
                        <div className="rounded-[12px] border p-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <Info size={12} style={{ color: 'var(--accent)' }} />
                            <span className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>Question Quality</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            {[
                              { label: 'Total questions', value: questions.length, color: 'var(--text)' },
                              { label: 'Open-ended', value: openEnded.length, color: '#06D6A0', tip: 'Good — reveals pain' },
                              { label: 'Yes/No (closed)', value: closedYesNo.length, color: closedYesNo.length > openEnded.length ? '#FF6B6B' : '#FFD166', tip: 'Use sparingly' },
                            ].map(({ label, value, color, tip }) => (
                              <div key={label} className="text-center p-3 rounded-[10px]" style={{ background: 'var(--bg3)' }}>
                                <div className="font-display text-[22px] font-bold" style={{ color }}>{value}</div>
                                <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text3)' }}>{label}</div>
                                {tip && <div className="text-[9.5px] mt-0.5 font-medium" style={{ color }}>{tip}</div>}
                              </div>
                            ))}
                          </div>
                          {closedYesNo.length > openEnded.length && (
                            <div className="flex items-start gap-2 p-3 rounded-[9px]" style={{ background: 'rgba(255,209,102,0.07)', border: '1px solid rgba(255,209,102,0.2)' }}>
                              <Lightbulb size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#FFD166' }} />
                              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                                You asked more closed than open-ended questions. Flip the ratio — open-ended questions (What, How, Why) unlock deeper insights and give you more control. Try: <em>"What's driving this decision now?"</em> instead of <em>"Are you looking to solve this?"</em>
                              </p>
                            </div>
                          )}
                          {openEnded.length > 0 && openEnded.length >= closedYesNo.length && (
                            <div className="flex items-start gap-2 p-3 rounded-[9px]" style={{ background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.2)' }}>
                              <CheckCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#06D6A0' }} />
                              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                                Strong question ratio — your open-ended questions create space for the prospect to reveal priorities. Keep it up.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Conversation flow pattern */}
                    {(() => {
                      const msgs = session?.messages || [];
                      if (msgs.length < 4) return null;
                      const consecutive = msgs.reduce((max, m, i, arr) => {
                        if (i === 0 || m.role !== arr[i-1].role || m.role !== 'user') return max;
                        let count = 1;
                        let j = i;
                        while (j > 0 && arr[j].role === 'user') { count++; j--; }
                        return Math.max(max, count);
                      }, 0);
                      if (consecutive < 2) return null;
                      return (
                        <div className="flex items-start gap-3 p-4 rounded-[12px] border" style={{ background: 'rgba(255,107,107,0.05)', borderColor: 'rgba(255,107,107,0.2)' }}>
                          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#FF6B6B' }} />
                          <div>
                            <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Conversation flow: interruption pattern detected</div>
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                              You sent {consecutive} messages in a row without waiting for the prospect to respond. In real sales conversations, this reads as pushing too hard. Let each message land — then wait for the response before continuing.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── OBJECTIONS TAB ─────────────────────────────────────────────── */}
            {activeTab === 'objections' && (
              <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center gap-3 p-4 rounded-[12px] border" style={{ background: 'rgba(255,107,107,0.05)', borderColor: 'rgba(255,107,107,0.2)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,107,107,0.12)' }}>
                    <Shield size={18} style={{ color: 'var(--accent4)' }} />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Objection Handling Review</div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--text3)' }}>
                      {objections.length > 0
                        ? `${objections.length} objection${objections.length !== 1 ? 's' : ''} were loaded for this scenario. See how you handled each one and what better responses look like.`
                        : 'No objections were pre-loaded for this scenario. Objections raised during the call are shown below.'}
                    </div>
                  </div>
                </div>

                {/* Pre-loaded objections */}
                {objections.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px]" style={{ color: 'var(--text3)' }}>Pre-Loaded Objections</div>
                    {objections.map((obj, i) => {
                      // Try to find relevant timeline events that mention this objection topic
                      const relatedEvents = sortedEvents.filter(ev =>
                        ev.description.toLowerCase().includes(obj.toLowerCase().slice(0, 20)) ||
                        (ev.transcriptRef || '').toLowerCase().includes(obj.toLowerCase().slice(0, 15))
                      );
                      const wasAddressed = relatedEvents.some(ev => ev.type === 'GOOD');
                      const wasMissed    = relatedEvents.length === 0;

                      return (
                        <div
                          key={i}
                          className="rounded-[12px] border overflow-hidden"
                          style={{ borderColor: wasAddressed ? 'rgba(6,214,160,0.25)' : wasMissed ? 'rgba(255,107,107,0.2)' : 'rgba(255,209,102,0.2)', background: 'var(--bg2)' }}
                        >
                          {/* Header row */}
                          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0')}>
                              {wasAddressed
                                ? <CheckCircle size={15} style={{ color: '#06D6A0' }} />
                                : wasMissed
                                ? <X size={15} style={{ color: '#FF6B6B' }} />
                                : <AlertTriangle size={15} style={{ color: '#FFD166' }} />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text)' }}>{obj}</span>
                            </div>
                            <span
                              className="text-[9.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={wasAddressed
                                ? { background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.25)' }
                                : wasMissed
                                ? { background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.25)' }
                                : { background: 'rgba(255,209,102,0.12)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.25)' }
                              }
                            >
                              {wasAddressed ? 'Handled' : wasMissed ? 'Not addressed' : 'Partial'}
                            </span>
                          </div>

                          <div className="px-4 py-3 flex flex-col gap-3">
                            {/* Related timeline events */}
                            {relatedEvents.length > 0 && (
                              <div>
                                <div className="text-[9.5px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>From your call</div>
                                {relatedEvents.map(ev => (
                                  <div key={ev.id} className="flex items-start gap-2 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: ev.type === 'GOOD' ? '#06D6A0' : ev.type === 'ISSUE' ? '#FF6B6B' : '#FFD166' }} />
                                    <p className="text-[12px] leading-relaxed flex-1" style={{ color: 'var(--text2)' }}>{ev.description}</p>
                                    <button
                                      onClick={() => jumpToTimestamp(ev.timestampMs)}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium flex-shrink-0 transition-all hover:scale-105"
                                      style={{ background: 'rgba(91,111,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.2)' }}
                                    >
                                      <Play size={7} fill="currentColor" /> {fmt(ev.timestampMs)}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Best practice response */}
                            <div className="p-3 rounded-[10px]" style={{ background: 'rgba(91,111,255,0.07)', border: '1px solid rgba(91,111,255,0.15)' }}>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Zap size={10} style={{ color: 'var(--accent)' }} />
                                <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Model response to this objection</div>
                              </div>
                              <p className="text-[12.5px] leading-relaxed italic" style={{ color: 'var(--text2)' }}>
                                "{getObjectionModelResponse(obj)}"
                              </p>
                            </div>

                            {/* Framework tip */}
                            <div className="flex items-start gap-2">
                              <Lightbulb size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#FFD166' }} />
                              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                                {getObjectionTip(obj, session.framework)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Objection-related timeline events (issues/warnings from call) */}
                {sortedEvents.filter(ev => ev.type === 'ISSUE' || ev.type === 'WARNING').length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px]" style={{ color: 'var(--text3)' }}>Challenges From Your Call</div>
                    {sortedEvents.filter(ev => ev.type === 'ISSUE' || ev.type === 'WARNING').map(ev => (
                      <div key={ev.id} className="rounded-[12px] border p-4" style={{ borderColor: ev.type === 'ISSUE' ? 'rgba(255,107,107,0.2)' : 'rgba(255,209,102,0.2)', background: 'var(--bg2)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          {ev.type === 'ISSUE'
                            ? <X size={13} style={{ color: '#FF6B6B' }} />
                            : <AlertTriangle size={13} style={{ color: '#FFD166' }} />
                          }
                          <span className="text-[13px] font-semibold flex-1" style={{ color: 'var(--text)' }}>{ev.title}</span>
                          <button
                            onClick={() => jumpToTimestamp(ev.timestampMs)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] flex-shrink-0 transition-all hover:scale-105"
                            style={{ background: 'rgba(91,111,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.15)' }}
                          >
                            <Play size={7} fill="currentColor" /> {fmt(ev.timestampMs)}
                          </button>
                        </div>
                        <p className="text-[12.5px] leading-relaxed mb-2" style={{ color: 'var(--text3)' }}>{ev.description}</p>
                        {ev.transcriptRef && (
                          <div className="px-3 py-2 rounded-[8px] border-l-2 mb-2" style={{ background: 'var(--bg3)', borderLeftColor: 'var(--border2)' }}>
                            <div className="text-[9.5px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>What was said</div>
                            <p className="text-[12px] italic" style={{ color: 'var(--text2)' }}>"{ev.transcriptRef}"</p>
                          </div>
                        )}
                        {ev.betterResponse && (
                          <div className="px-3 py-2 rounded-[8px] border-l-2" style={{ background: 'rgba(6,214,160,0.05)', borderLeftColor: '#06D6A0' }}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Zap size={9} style={{ color: '#06D6A0' }} />
                              <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: '#06D6A0' }}>Stronger response</div>
                            </div>
                            <p className="text-[12px] italic" style={{ color: 'var(--text2)' }}>"{ev.betterResponse}"</p>
                          </div>
                        )}
                        {!ev.betterResponse && ev.suggestion && (
                          <div className="flex items-center gap-1.5 text-[11.5px] mt-1" style={{ color: 'var(--accent)' }}>
                            <Lightbulb size={10} /> {ev.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {objections.length === 0 && sortedEvents.filter(ev => ev.type === 'ISSUE' || ev.type === 'WARNING').length === 0 && (
                  <div className="rounded-[12px] border p-10 text-center" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                    <Shield size={28} className="mx-auto mb-3" style={{ color: 'var(--text3)' }} />
                    <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text2)' }}>No objections recorded</p>
                    <p className="text-[12px]" style={{ color: 'var(--text3)' }}>Try a scenario with pre-loaded objections to practise handling them systematically.</p>
                  </div>
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
