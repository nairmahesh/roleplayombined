// Live call interface — ElevenLabs Conversational AI (signed URL via backend) + @elevenlabs/react SDK

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mic, MicOff, Phone, Pause, Play, BarChart3 } from 'lucide-react';
import { sessionsApi, voiceApi } from '@/lib/api';
import { ConversationProvider, useConversation } from '@elevenlabs/react';

import { useRecording } from '@/hooks/useRecording';
import { connectSocket } from '@/lib/socket';
import { Framework, SessionType, FRAMEWORK_INFO } from '@/types';
import { AvatarDisplay } from '@/components/practice/PersonaAvatars';
import clsx from 'clsx';

interface Message { role: 'user' | 'assistant'; content: string; timestampMs: number; }

export interface PersonaDisplay {
  name: string;
  title: string;
  emoji: string;
  avatarId?: string;
  elevenlabsVoiceId?: string;
  systemPrompt?: string;
  firstMessage?: string;
  personaId?: string;
  // Opening behaviour
  firstSpeaker?: 'persona' | 'user';
  openingLine?: string;
  roleplayType?: string;
}

interface Props {
  sessionId: string;
  persona: PersonaDisplay;
  sessionType: SessionType;
  framework: Framework;
  timeLimitMins?: number | null;
  onEnd: (sessionId: string) => void;
}

// ── Ring tone (3 rings via Web Audio API) ─────────────────────────────────────
// Returns { promise, stop } so callers can cancel the audio mid-ring.
function playRings(): { promise: Promise<void>; stop: () => void } {
  let audioCtx: AudioContext | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<void>(resolve => {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioCtx;
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 2.2;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o1.connect(g); o2.connect(g); g.connect(ctx.destination);
        o1.frequency.value = 480; o2.frequency.value = 440;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.28, t + 0.06);
        g.gain.setValueAtTime(0.28, t + 0.88);
        g.gain.linearRampToValueAtTime(0, t + 1.0);
        o1.start(t); o2.start(t); o1.stop(t + 1.1); o2.stop(t + 1.1);
      }
      timeoutId = setTimeout(resolve, 3 * 2200 + 200);
    } catch { timeoutId = setTimeout(resolve, 2000); }
  });

  const stop = () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    try { audioCtx?.close(); } catch {}
  };

  return { promise, stop };
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CallInterface(props: Props) {
  return (
    <ConversationProvider>
      <CallInterfaceInner {...props} />
    </ConversationProvider>
  );
}

function CallInterfaceInner({ sessionId, persona, sessionType, framework, timeLimitMins, onEnd }: Props) {
  const { startSession, endSession, status, isSpeaking: isBotSpeaking, isMuted, setMuted, getId } = useConversation();

  const [phase, setPhase]                 = useState<'ringing' | 'active'>('ringing');
  const [ringDot, setRingDot]             = useState(0);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [elapsed, setElapsed]             = useState(0);
  const [isHeld, setIsHeld]               = useState(false);
  const [isEnding, setIsEnding]           = useState(false);
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false);
  const everConnectedRef = useRef(false);
  const connectTimeRef   = useRef<number | null>(null);

  const startTimeRef     = useRef(Date.now());
  const endDataRef       = useRef<{ durationSeconds: number; convaiConversationId?: string } | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLimitWarnRef = useRef(false);
  const historyRef       = useRef<Message[]>([]);
  const transcriptRef    = useRef<HTMLDivElement>(null);
  const handleEndRef     = useRef<(() => void) | null>(null);
  const isEndingRef      = useRef(false);
  const sessionStartedRef = useRef(false); // true once startSession() has been called
  const stopRingsRef     = useRef<(() => void) | null>(null); // stops ring audio mid-play

  const socket = connectSocket();
  const recording = useRecording({ sessionId, mode: sessionType === 'ONLINE_MEETING' ? 'video' : 'audio' });
  const isConnected = status === 'connected';

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, 50);
  }, []);

  const addMsg = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: Message = { role, content, timestampMs: Date.now() - startTimeRef.current };
    historyRef.current = [...historyRef.current, msg];
    setMessages(prev => [...prev, msg]);
    sessionsApi.addMessage(sessionId, { role, content, timestampMs: msg.timestampMs }).catch(() => {});
    scrollToBottom();
  }, [sessionId, scrollToBottom]);

  // ── Session lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        toast.error('Microphone access required');
        onEnd(sessionId);
        return;
      }

      try { await sessionsApi.start(sessionId); } catch {}

      for (let i = 0; i < 3; i++) {
        setTimeout(() => { if (!cancelled) setRingDot(i + 1); }, i * 2200);
      }
      const rings = playRings();
      stopRingsRef.current = rings.stop;
      await rings.promise;
      stopRingsRef.current = null;
      if (cancelled) return;

      setPhase('active');
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
      recording.startRecording(stream);
      socket.emit('session:join', { sessionId });

      // Get signed URL from backend (API key never leaves the server).
      // Pass personaId so the backend uses that persona's dedicated ElevenLabs agent.
      let signedUrl: string | null = null;
      try {
        console.log('[CallInterface] Fetching signed URL for personaId:', persona.personaId);
        signedUrl = await voiceApi.getSignedUrl(persona.personaId);
        console.log('[CallInterface] Got signed URL (first 60 chars):', signedUrl?.slice(0, 60));
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        console.error('[CallInterface] Signed URL error:', err);
        if (code === 'CONVAI_UNAVAILABLE') {
          toast.error(
            'ElevenLabs Conversational AI requires a Creator plan or above. ' +
            'Live call sessions are unavailable with your current plan.',
            { duration: 8000 }
          );
        } else {
          toast.error('Could not connect to ElevenLabs — check ELEVENLABS_API_KEY on the server');
        }
        onEnd(sessionId);
        return;
      }

      if (!signedUrl) {
        toast.error('Voice AI is not available in demo mode. Connect a backend with a valid ElevenLabs API key to enable live calls.', { duration: 8000 });
        onEnd(sessionId);
        return;
      }

      // Determine who speaks first and what they say.
      // Logic: the person being *called* answers first. Cold calls / outbound = user called them,
      // so the persona picks up. In outbound/pitch scenarios where the persona is calling the user,
      // the user should speak first (the persona dialled them).
      const isOutbound = /cold call|outbound/i.test(persona.roleplayType ?? '');
      const personaSpeaksFirst = (persona.firstSpeaker ?? 'persona') === 'persona' && !isOutbound;

      // Derive the opening line if not explicitly set
      const firstName = persona.name.split(' ')[0];
      let computedOpeningLine: string;
      if (persona.openingLine) {
        computedOpeningLine = persona.openingLine;
      } else if (!personaSpeaksFirst) {
        // Persona is the caller — user answers, persona should wait silently
        // We use an empty/ellipsis so ElevenLabs doesn't speak immediately
        computedOpeningLine = '...';
      } else if (sessionType === 'PHONE_CALL') {
        // Answered an inbound call — terse phone greeting
        computedOpeningLine = `${firstName} speaking.`;
      } else {
        // Online meeting — warmer, host-style greeting
        computedOpeningLine = `Hi! Thanks for joining — ${firstName} here. How can I help you today?`;
      }

      console.log('[CallInterface] Persona info — name=%s personaId=%s voiceId=%s',
        persona.name, persona.personaId, persona.elevenlabsVoiceId ?? 'default');

      if (!cancelled) {
        sessionStartedRef.current = true;
        console.log('[CallInterface] Calling startSession with signedUrl=%s', signedUrl?.slice(0, 80));
        startSession({
          signedUrl,
          onConnect: () => {
            everConnectedRef.current = true;
            connectTimeRef.current = Date.now();
            console.log('[CallInterface] ✅ EL onConnect — WebSocket open, session active');
          },
          onMessage: ({ message, source }: { message: string; source: string }) => {
            console.log('[CallInterface] 💬 EL onMessage source=%s msg=%s', source, message?.slice(0, 80));
            if (message?.trim()) addMsg(source === 'ai' ? 'assistant' : 'user', message.trim());
          },
          onError: (msg: string) => {
            console.error('[CallInterface] ❌ EL onError:', msg);
            if (!cancelled) toast.error(`ElevenLabs error: ${msg}`, { duration: 8000 });
          },
          onDisconnect: (details?: unknown) => {
            const d = details as { reason?: string; message?: string; closeCode?: number; closeReason?: string } | undefined;
            const connectedMs = connectTimeRef.current ? Date.now() - connectTimeRef.current : 0;
            console.warn('[CallInterface] 🔌 EL onDisconnect — closeCode=%s reason=%s connectedMs=%s | cancelled=%s isEnding=%s',
              d?.closeCode, d?.reason, connectedMs, cancelled, isEndingRef.current);
            if (!cancelled && sessionStartedRef.current && !isEndingRef.current) {
              if (everConnectedRef.current && connectedMs > 4000) {
                // Normal end — session actually ran
                handleEndRef.current?.();
              } else if (everConnectedRef.current) {
                // Disconnected within 4s — likely agent config rejection (overrides not allowed, etc.)
                toast.error('Voice connection dropped immediately. Check agent settings or try again.', { duration: 8000 });
                onEnd(sessionId);
              } else {
                toast.error(`Session failed to connect — ${d?.message ?? JSON.stringify(details)}`, { duration: 10000 });
              }
            }
          },
        });
      }
    })();

    return () => {
      console.log('[CallInterface] useEffect cleanup — sessionStarted=%s', sessionStartedRef.current);
      cancelled = true;
      sessionStartedRef.current = false;
      stopRingsRef.current?.();
      stopRingsRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      try { endSession(); } catch {}
      socket.emit('session:leave', { sessionId });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End call ──────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);
    const convaiConversationId = getId() ?? undefined;
    try { endSession(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    recording.stopRecording?.();
    endDataRef.current = { durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000), convaiConversationId };
    setShowAnalysisPrompt(true);
  }, [endSession, getId, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handleEndRef.current = handleEnd; });

  const confirmEnd = async (analyze: boolean) => {
    setShowAnalysisPrompt(false);
    const durationSeconds = endDataRef.current?.durationSeconds ?? 0;
    const convaiConversationId = endDataRef.current?.convaiConversationId;
    try {
      await sessionsApi.end(sessionId, { durationSeconds, transcript: historyRef.current, skipAnalysis: !analyze, convaiConversationId });
      toast.success(analyze ? 'Session ended — AI is analysing…' : 'Session saved.');
      onEnd(sessionId);
    } catch (err: unknown) {
      toast.error('Could not end session: ' + (err instanceof Error ? err.message : String(err)));
      isEndingRef.current = false;
      setIsEnding(false);
    }
  };

  // ── Time limit enforcement ────────────────────────────────────────────────────
  useEffect(() => {
    if (!timeLimitMins || phase !== 'active' || isEnding) return;
    const limitMs = timeLimitMins * 60 * 1000;
    if (!timeLimitWarnRef.current && elapsed >= limitMs - 60_000 && elapsed < limitMs) {
      timeLimitWarnRef.current = true;
      toast('1 minute remaining');
    }
    if (elapsed >= limitMs) {
      toast('Time limit reached — ending session');
      handleEnd();
    }
  }, [elapsed, timeLimitMins, phase, isEnding, handleEnd]);

  const toggleHold = () => {
    setIsHeld(h => {
      setMuted(!h);
      return !h;
    });
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4"
    >
      <style>{`@keyframes rp{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.08);opacity:0}}`}</style>

      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative bg-bg-2 border-0 sm:border border-white/10 rounded-none sm:rounded-[24px] w-full sm:max-w-[880px] h-full sm:h-auto overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(91,111,255,0.08)]"
      >
        {/* ── RINGING ── */}
        {phase === 'ringing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-0">
            <div className="relative w-24 h-24 rounded-full overflow-hidden mb-5 flex-shrink-0">
              <div className="absolute inset-[-10px] rounded-full border-2 border-accent/35 z-10 animate-[rp_1.4s_ease-out_infinite]" />
              <div className="absolute inset-[-22px] rounded-full border-2 border-accent/18 z-10 animate-[rp_1.4s_ease-out_0.5s_infinite]" />
              <AvatarDisplay avatarId={persona.avatarId} size={96} />
            </div>
            <div className="font-display font-bold text-xl mb-1.5">{persona.name}</div>
            <div className="text-sm text-white/75 mb-4">{persona.title}</div>
            <div className="flex gap-2 mb-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={clsx('w-2.5 h-2.5 rounded-full transition-all duration-300', ringDot > i ? 'bg-accent scale-110' : 'bg-white/15')} />
              ))}
            </div>
            <div className="text-[12px] text-white/70 mb-6">Ringing…</div>
            <button
              type="button"
              onClick={() => {
                stopRingsRef.current?.();
                stopRingsRef.current = null;
                onEnd(sessionId);
              }}
              className="px-6 py-2.5 bg-accent-4/15 text-accent-4 border border-accent-4/25 rounded-[9px] text-[12.5px] font-semibold cursor-pointer hover:bg-accent-4/25 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── ACTIVE CALL ── */}
        {phase === 'active' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <span className="w-[7px] h-[7px] rounded-full bg-accent-3 animate-pulse flex-shrink-0" />
                <div>
                  <div className="font-display font-bold text-[15px]">{persona.name} · {FRAMEWORK_INFO[framework].label}</div>
                  <div className="text-[12px] text-white/75 font-mono flex items-center gap-2">
                    {fmt(elapsed)}
                    {timeLimitMins && (
                      <span className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded border',
                        elapsed >= timeLimitMins * 60 * 1000 - 60_000
                          ? 'text-accent-4 border-accent-4/30 bg-accent-4/10'
                          : 'text-white/55 border-white/10'
                      )}>
                        /{timeLimitMins}:00
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isBotSpeaking && (
                  <div className="wave-bars-5" aria-hidden="true">
                    <span/><span/><span/><span/><span/>
                  </div>
                )}
                <span className="px-2.5 py-1 rounded-full bg-accent-3/10 border border-accent-3/20 text-[10px] text-accent-3 font-medium">● LIVE</span>
                {!isConnected && phase === 'active' && (
                  <span className="text-[10px] text-white/55 animate-pulse">Connecting…</span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row h-[clamp(320px,55vh,420px)]">
              {/* Avatar panel */}
              <div className={clsx(
                'flex-shrink-0 bg-bg-3 border-b sm:border-b-0 sm:border-r border-white/[0.07] flex items-center justify-center',
                sessionType === 'ONLINE_MEETING' ? 'sm:w-64 h-32 sm:h-auto' : 'sm:w-52 h-28 sm:h-auto'
              )}>
                <div className="flex flex-col items-center gap-3 p-4">
                  <div className="relative">
                    {isBotSpeaking && (
                      <>
                        <div className="absolute inset-[-8px] rounded-full border-2 border-accent/40 z-10 animate-[rp_1.2s_ease-out_infinite]" />
                        <div className="absolute inset-[-16px] rounded-full border border-accent/20 z-10 animate-[rp_1.2s_ease-out_0.4s_infinite]" />
                      </>
                    )}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
                      <AvatarDisplay avatarId={persona.avatarId} size={80} speaking={isBotSpeaking} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-sm">{persona.name}</div>
                    <div className="text-[11px] text-white/70">{persona.title}</div>
                  </div>
                  <div className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium transition-all',
                    isMuted
                      ? 'bg-accent-4/10 border-accent-4/25 text-accent-4'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/55'
                  )}>
                    {isMuted ? <><MicOff size={9} /> Muted</> : <><Mic size={9} /> Live</>}
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="flex-1 flex flex-col bg-bg-3 min-w-0">
                <div className="px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/55 uppercase tracking-wider">Transcript</span>
                  {isBotSpeaking && (
                    <div className="wave-bars-3" aria-hidden="true">
                      <span/><span/><span/>
                    </div>
                  )}
                </div>
                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {messages.length === 0 && (
                    <div className="text-center text-white/65 text-[12px] py-12 flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                        <Mic size={14} className="text-white/65" />
                      </div>
                      <span>Waiting for conversation…</span>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={clsx(
                        'max-w-[80%] px-3.5 py-2 rounded-[14px] text-[12.5px] leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-accent/20 border border-accent/20 text-white/90 rounded-br-[4px]'
                          : 'bg-white/[0.05] border border-white/[0.07] text-white/75 rounded-bl-[4px]'
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2.5 px-6 py-4 border-t border-white/[0.07] bg-bg-2">
              <CtrlBtn icon={isMuted ? MicOff : Mic} active={!isMuted} muted={isMuted} onClick={() => setMuted(!isMuted)} label={isMuted ? 'Unmute' : 'Mute'} />
              <CtrlBtn icon={isHeld ? Play : Pause} active={isHeld} onClick={toggleHold} label={isHeld ? 'Resume' : 'Hold'} />
              <button
                type="button"
                onClick={handleEnd}
                disabled={isEnding}
                className="ml-4 flex items-center gap-2 px-5 py-2.5 rounded-[11px] bg-accent-4 text-white text-[13px] font-bold hover:bg-red-500 transition-all shadow-[0_4px_20px_rgba(255,107,107,0.3)] disabled:opacity-50"
              >
                <Phone size={14} className="rotate-[135deg]" />
                {isEnding ? 'Ending…' : 'End Session'}
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* ── Analysis prompt modal ── */}
      {showAnalysisPrompt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-bg-2 border border-white/10 rounded-[18px] p-7 w-[340px] flex flex-col items-center gap-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
          >
            <div className="w-11 h-11 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <BarChart3 size={20} className="text-accent" />
            </div>
            <div className="text-center">
              <div className="font-display font-bold text-[16px] mb-1.5">Analyze this session?</div>
              <p className="text-[12.5px] text-white/70 leading-relaxed">Get AI feedback on your pitch, objection handling, and framework score.</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => confirmEnd(false)}
                className="flex-1 py-2.5 rounded-[10px] bg-white/[0.05] border border-white/10 text-[13px] text-white/75 font-semibold hover:bg-white/[0.09] transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => confirmEnd(true)}
                className="flex-1 py-2.5 rounded-[10px] bg-accent text-white text-[13px] font-bold hover:bg-accent/80 transition-colors shadow-[0_4px_20px_rgba(91,111,255,0.35)]"
              >
                Analyze
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ── CtrlBtn ───────────────────────────────────────────────────────────────────
function CtrlBtn({ icon: Icon, active, muted, onClick, label }: {
  icon: React.ElementType; active: boolean; muted?: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={clsx(
        'w-11 h-11 rounded-[10px] flex items-center justify-center border transition-all',
        muted
          ? 'bg-accent-4/12 border-accent-4/40 text-accent-4'
          : active
          ? 'bg-accent/10 border-accent/40 text-accent'
          : 'bg-bg-3 border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08]'
      )}
    >
      <Icon size={16} />
    </button>
  );
}
