// Live call overlay — ElevenLabs Conversational AI WebSocket
// Rings 3 times, persona answers, full duplex audio with native barge-in

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mic, MicOff, Phone, Pause, Play } from 'lucide-react';
import { sessionsApi } from '@/lib/api';
import { useRecording } from '@/hooks/useRecording';
import { connectSocket } from '@/lib/socket';
import { Framework, SessionType, FRAMEWORK_INFO } from '@/types';
import { AvatarDisplay } from '@/components/practice/PersonaAvatars';
import clsx from 'clsx';

// ── Config ────────────────────────────────────────────────────────────────────
const EL_WS_URL = 'wss://api.elevenlabs.io/v1/convai/conversation';
const EL_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || '';
const EL_API_KEY  = import.meta.env.VITE_ELEVENLABS_API_KEY  || '';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'assistant'; content: string; timestampMs: number; }

export interface PersonaDisplay {
  name: string;
  title: string;
  emoji: string;
  avatarId?: string;
  elevenlabsVoiceId?: string;
  systemPrompt?: string;
  firstMessage?: string;
}

interface Props {
  sessionId: string;
  persona: PersonaDisplay;
  sessionType: SessionType;
  framework: Framework;
  timeLimitMins?: number | null;
  onEnd: (sessionId: string) => void;
}

// ── Ring tone (3 rings via Web Audio) ────────────────────────────────────────
function playRings(): Promise<void> {
  return new Promise(resolve => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      setTimeout(resolve, 3 * 2200 + 200);
    } catch { setTimeout(resolve, 2000); }
  });
}

// ── PCM16 audio queue + playback ──────────────────────────────────────────────
// ElevenLabs sends audio as base64-encoded PCM16 @ 16kHz chunks.
// We decode and queue them into an AudioContext for seamless, gap-free playback.
class AudioQueue {
  private ctx: AudioContext;
  private nextAt = 0;
  private sources: AudioBufferSourceNode[] = [];
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  private playing = false;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  enqueue(base64: string) {
    this.resume();
    const raw = atob(base64);
    const buf = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);

    // PCM16 LE → Float32
    const pcm = new Int16Array(buf);
    const float = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 32768;

    const audioBuf = this.ctx.createBuffer(1, float.length, 16000);
    audioBuf.copyToChannel(float, 0);

    const src = this.ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(this.ctx.destination);

    const startAt = Math.max(this.ctx.currentTime + 0.005, this.nextAt);
    src.start(startAt);
    this.nextAt = startAt + audioBuf.duration;

    if (!this.playing) {
      this.playing = true;
      this.onPlaybackStart?.();
    }

    // Schedule end detection
    if (this.endTimer) clearTimeout(this.endTimer);
    const msUntilEnd = (this.nextAt - this.ctx.currentTime) * 1000 + 120;
    this.endTimer = setTimeout(() => {
      if (this.playing) { this.playing = false; this.onPlaybackEnd?.(); }
    }, msUntilEnd);

    this.sources.push(src);
    // Keep sources list lean
    if (this.sources.length > 20) this.sources.shift();
  }

  interrupt() {
    this.nextAt = 0;
    this.sources.forEach(s => { try { s.stop(); } catch {} });
    this.sources = [];
    if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; }
    if (this.playing) { this.playing = false; this.onPlaybackEnd?.(); }
  }

  isPlaying() { return this.playing; }

  close() {
    this.interrupt();
    this.ctx.close().catch(() => {});
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CallInterface({ sessionId, persona, sessionType, framework, timeLimitMins, onEnd }: Props) {
  const [phase, setPhase] = useState<'ringing' | 'active'>('ringing');
  const [ringDot, setRingDot] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false);
  const [wsReady, setWsReady] = useState(false);

  const startTimeRef    = useRef(Date.now());
  const endDataRef      = useRef<{ durationSeconds: number } | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLimitWarnRef = useRef(false);
  const callLiveRef     = useRef(false);
  const wsRef           = useRef<WebSocket | null>(null);
  const audioQueueRef   = useRef<AudioQueue | null>(null);
  const micStreamRef    = useRef<MediaStream | null>(null);
  const micProcRef      = useRef<ScriptProcessorNode | null>(null);
  const micCtxRef       = useRef<AudioContext | null>(null);
  const historyRef      = useRef<Message[]>([]);
  const transcriptRef   = useRef<HTMLDivElement>(null);
  const handleEndRef    = useRef<(() => void) | null>(null);
  const isMutedRef      = useRef(false);
  const isHeldRef       = useRef(false);
  const pendingUserMsg  = useRef('');
  const pendingBotMsg   = useRef('');

  const socket = connectSocket();
  const recording = useRecording({ sessionId, mode: sessionType === 'ONLINE_MEETING' ? 'video' : 'audio' });
  const tsNow = () => Date.now() - startTimeRef.current;

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isHeldRef.current = isHeld; }, [isHeld]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, 50);
  }, []);

  const addMsg = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: Message = { role, content, timestampMs: tsNow() };
    historyRef.current = [...historyRef.current, msg];
    setMessages(prev => [...prev, msg]);
    sessionsApi.addMessage(sessionId, { role, content, timestampMs: msg.timestampMs }).catch(() => {});
    scrollToBottom();
  }, [sessionId, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build persona system prompt for ElevenLabs override ──────────────────────
  const buildSystemPrompt = useCallback(() => {
    if (persona.systemPrompt) return persona.systemPrompt;
    return (
      `You are ${persona.name}, ${persona.title}. ` +
      `You are in a sales call roleplay. Act naturally as this persona — be realistic, slightly busy, ` +
      `raise objections, ask clarifying questions, and respond to the salesperson's pitch. ` +
      `Never break character. Keep responses concise and conversational (1-3 sentences). ` +
      `If the salesperson makes a compelling case, show buying signals. ` +
      `Use the ${FRAMEWORK_INFO[framework].label} sales framework context in your responses.`
    );
  }, [persona, framework]);

  const buildFirstMessage = useCallback(() => {
    if (persona.firstMessage) return persona.firstMessage;
    const greetings = [
      `${persona.name.split(' ')[0]} speaking.`,
      `This is ${persona.name.split(' ')[0]}, go ahead.`,
      `Hello, ${persona.name.split(' ')[0]} here.`,
      `${persona.name.split(' ')[0]}, hi — I've only got a few minutes.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }, [persona]);

  // ── Mic → PCM16 → WebSocket streaming ────────────────────────────────────────
  const startMicStreaming = useCallback(async (stream: MediaStream) => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    micCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    // ScriptProcessor: capture 4096-sample chunks, convert Float32→PCM16, send
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    micProcRef.current = proc;
    proc.onaudioprocess = (e) => {
      if (!callLiveRef.current || isMutedRef.current || isHeldRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const float = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(float.length);
      for (let i = 0; i < float.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, float[i] * 32768));
      const b64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
      ws.send(JSON.stringify({ user_audio_chunk: b64 }));
    };
    src.connect(proc);
    proc.connect(ctx.destination);
  }, []);

  const stopMicStreaming = useCallback(() => {
    if (micProcRef.current) { try { micProcRef.current.disconnect(); } catch {} micProcRef.current = null; }
    if (micCtxRef.current) { micCtxRef.current.close().catch(() => {}); micCtxRef.current = null; }
  }, []);

  // ── Connect ElevenLabs WebSocket ──────────────────────────────────────────────
  const connectElevenLabs = useCallback(async (stream: MediaStream) => {
    const agentId = EL_AGENT_ID;
    if (!agentId) {
      toast.error('ElevenLabs Agent ID not configured (VITE_ELEVENLABS_AGENT_ID)');
      onEnd(sessionId);
      return;
    }

    const queue = new AudioQueue();
    audioQueueRef.current = queue;

    queue.onPlaybackStart = () => setIsBotSpeaking(true);
    queue.onPlaybackEnd   = () => setIsBotSpeaking(false);

    // Get signed URL if API key provided (private agents), else connect directly
    let wsUrl = `${EL_WS_URL}?agent_id=${agentId}`;
    if (EL_API_KEY) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
          { headers: { 'xi-api-key': EL_API_KEY } }
        );
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.signed_url;
        }
      } catch { /* fall back to direct connection */ }
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send persona override so the agent behaves as our custom character
      ws.send(JSON.stringify({
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          agent: {
            prompt: { prompt: buildSystemPrompt() },
            first_message: buildFirstMessage(),
            ...(persona.elevenlabsVoiceId ? { voice: { voice_id: persona.elevenlabsVoiceId } } : {}),
          },
        },
      }));
      setWsReady(true);
      startMicStreaming(stream);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Keep-alive ping → pong
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', event_id: data.ping_event.event_id }));
          return;
        }

        // Audio chunk — enqueue for seamless playback
        if (data.type === 'audio') {
          if (!isHeldRef.current) queue.enqueue(data.audio_event.audio_base_64);
          return;
        }

        // Agent's final text response → transcript
        if (data.type === 'agent_response') {
          const text = data.agent_response_event?.agent_response?.trim();
          if (text) {
            pendingBotMsg.current = '';
            addMsg('assistant', text);
          }
          return;
        }

        // User transcript → transcript
        if (data.type === 'user_transcript') {
          const text = data.user_transcription_event?.user_transcript?.trim();
          if (text) {
            pendingUserMsg.current = '';
            addMsg('user', text);
          }
          return;
        }

        // Native interruption — ElevenLabs stops bot audio server-side
        if (data.type === 'interruption') {
          queue.interrupt();
          setIsBotSpeaking(false);
          return;
        }

        // Conversation ended by agent
        if (data.type === 'conversation_initiation_metadata') {
          // metadata received — connection confirmed
          return;
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onerror = () => {
      if (callLiveRef.current) toast.error('Voice connection lost — check your ElevenLabs config');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (callLiveRef.current) {
        // Unexpected close — end session gracefully
        setTimeout(() => { if (callLiveRef.current) handleEndRef.current?.(); }, 500);
      }
    };
  }, [sessionId, onEnd, buildSystemPrompt, buildFirstMessage, startMicStreaming, addMsg, persona.elevenlabsVoiceId]);

  // ── Session lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Mic permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 },
        });
        micStreamRef.current = stream;
      } catch {
        toast.error('Microphone access required');
        onEnd(sessionId);
        return;
      }

      // 2. Start backend session
      try { await sessionsApi.start(sessionId); } catch {}

      // 3. Three rings with animated dots
      for (let i = 0; i < 3; i++) {
        setTimeout(() => { if (!cancelled) setRingDot(i + 1); }, i * 2200);
      }
      await playRings();
      if (cancelled) return;

      // 4. Go live
      setPhase('active');
      startTimeRef.current = Date.now();
      callLiveRef.current = true;
      handleEndRef.current = handleEnd;

      // 5. Timer
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);

      // 6. Recording
      recording.startRecording(stream);

      // 7. Socket join
      socket.emit('session:join', { sessionId });

      // 8. Connect ElevenLabs
      await connectElevenLabs(stream);
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      callLiveRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
      audioQueueRef.current?.close();
      audioQueueRef.current = null;
      stopMicStreaming();
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      socket.emit('session:leave', { sessionId });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End call ──────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    handleEndRef.current = handleEnd;
    if (isEnding) return;
    setIsEnding(true);
    callLiveRef.current = false;

    // Clean up audio/WS
    wsRef.current?.close();
    wsRef.current = null;
    audioQueueRef.current?.close();
    audioQueueRef.current = null;
    stopMicStreaming();
    if (timerRef.current) clearInterval(timerRef.current);
    recording.stopRecording();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    endDataRef.current = { durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) };
    setShowAnalysisPrompt(true);
  }, [isEnding, stopMicStreaming, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep handleEndRef in sync
  useEffect(() => { handleEndRef.current = handleEnd; });

  const confirmEnd = async (analyze: boolean) => {
    setShowAnalysisPrompt(false);
    const durationSeconds = endDataRef.current?.durationSeconds ?? 0;
    try {
      await sessionsApi.end(sessionId, { durationSeconds, transcript: historyRef.current, skipAnalysis: !analyze });
      toast.success(analyze ? 'Session ended — AI is analysing…' : 'Session saved.');
      onEnd(sessionId);
    } catch (err: any) {
      toast.error('Could not end session: ' + err.message);
      setIsEnding(false);
    }
  };

  // ── Time limit enforcement ────────────────────────────────────────────────────
  useEffect(() => {
    if (!timeLimitMins || phase !== 'active' || isEnding) return;
    const limitMs = timeLimitMins * 60 * 1000;
    if (!timeLimitWarnRef.current && elapsed >= limitMs - 60_000 && elapsed < limitMs) {
      timeLimitWarnRef.current = true;
      toast('1 minute remaining', { icon: '⏱' });
    }
    if (elapsed >= limitMs) {
      toast('Time limit reached — ending session', { icon: '⏱' });
      handleEnd();
    }
  }, [elapsed, timeLimitMins, phase, isEnding, handleEnd]);

  // ── Controls ──────────────────────────────────────────────────────────────────
  const toggleMute = () => {
    setIsMuted(m => {
      const next = !m;
      isMutedRef.current = next;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
      }
      return next;
    });
  };

  const toggleHold = () => {
    setIsHeld(h => {
      const next = !h;
      isHeldRef.current = next;
      if (next) {
        // Pause: stop mic + pause queued audio
        audioQueueRef.current?.interrupt();
      }
      return next;
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
      <style>{`
        @keyframes rp{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.08);opacity:0}}
        @keyframes avr{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.1);opacity:1}}
        @keyframes wv{0%,100%{height:3px;opacity:.3}50%{height:14px;opacity:1}}
      `}</style>

      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative bg-bg-2 border-0 sm:border border-white/10 rounded-none sm:rounded-[24px] w-full sm:max-w-[880px] h-full sm:h-auto overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(91,111,255,0.08)]"
      >
        {/* ── RINGING ── */}
        {phase === 'ringing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-0">
            <div className="relative w-24 h-24 rounded-full overflow-hidden mb-5 flex-shrink-0">
              <div className="absolute inset-[-10px] rounded-full border-2 border-accent/35 z-10" style={{ animation: 'rp 1.4s ease-out infinite' }} />
              <div className="absolute inset-[-22px] rounded-full border-2 border-accent/18 z-10" style={{ animation: 'rp 1.4s ease-out 0.5s infinite' }} />
              <AvatarDisplay avatarId={persona.avatarId} size={96} />
            </div>
            <div className="font-display font-bold text-xl mb-1.5">{persona.name}</div>
            <div className="text-sm text-white/35 mb-4">{persona.title}</div>
            <div className="flex gap-2 mb-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={clsx('w-2.5 h-2.5 rounded-full transition-all duration-300', ringDot > i ? 'bg-accent scale-110' : 'bg-white/15')} />
              ))}
            </div>
            <div className="text-[12px] text-white/25 mb-6">Ringing…</div>
            <button
              onClick={() => onEnd(sessionId)}
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
                  <div className="text-[12px] text-white/35 font-mono flex items-center gap-2">
                    {fmt(elapsed)}
                    {timeLimitMins && (
                      <span className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded border',
                        elapsed >= timeLimitMins * 60 * 1000 - 60_000
                          ? 'text-accent-4 border-accent-4/30 bg-accent-4/10'
                          : 'text-white/30 border-white/10'
                      )}>
                        /{timeLimitMins}:00
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Speaking indicator — subtle wave bars, no text label */}
                {isBotSpeaking && (
                  <div className="flex items-center gap-1 h-5">
                    {[0, 0.12, 0.24, 0.36, 0.48].map(d => (
                      <div key={d} className="w-[3px] bg-accent rounded-full" style={{ height: '3px', animation: `wv 0.85s ease-in-out ${d}s infinite` }} />
                    ))}
                  </div>
                )}
                <span className="px-2.5 py-1 rounded-full bg-accent-3/10 border border-accent-3/20 text-[10px] text-accent-3 font-medium">● LIVE</span>
                {!wsReady && phase === 'active' && (
                  <span className="text-[10px] text-white/30 animate-pulse">Connecting…</span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row" style={{ height: 'clamp(320px, 55vh, 420px)' }}>
              {/* Avatar panel */}
              <div className={clsx(
                'flex-shrink-0 bg-bg-3 border-b sm:border-b-0 sm:border-r border-white/[0.07] flex items-center justify-center',
                sessionType === 'ONLINE_MEETING' ? 'sm:w-64 h-32 sm:h-auto' : 'sm:w-52 h-28 sm:h-auto'
              )}>
                <div className="flex flex-col items-center gap-3 p-4">
                  <div className="relative">
                    {/* Ripple ring when speaking */}
                    {isBotSpeaking && (
                      <>
                        <div className="absolute inset-[-8px] rounded-full border-2 border-accent/40 z-10" style={{ animation: 'rp 1.2s ease-out infinite' }} />
                        <div className="absolute inset-[-16px] rounded-full border border-accent/20 z-10" style={{ animation: 'rp 1.2s ease-out 0.4s infinite' }} />
                      </>
                    )}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
                      <AvatarDisplay avatarId={persona.avatarId} size={80} speaking={isBotSpeaking} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-sm">{persona.name}</div>
                    <div className="text-[11px] text-white/50">{persona.title}</div>
                  </div>
                  {/* Microphone status indicator */}
                  <div className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium transition-all',
                    isMuted
                      ? 'bg-accent-4/10 border-accent-4/25 text-accent-4'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/30'
                  )}>
                    {isMuted ? <><MicOff size={9} /> Muted</> : <><Mic size={9} /> Live</>}
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="flex-1 flex flex-col bg-bg-3 min-w-0">
                <div className="px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Transcript</span>
                  {isBotSpeaking && (
                    <div className="flex items-center gap-1 h-3.5">
                      {[0, 0.15, 0.3].map(d => (
                        <div key={d} className="w-0.5 bg-accent/60 rounded-full" style={{ height: '3px', animation: `wv 0.85s ease-in-out ${d}s infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {messages.length === 0 && (
                    <div className="text-center text-white/20 text-[12px] py-12 flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                        <Mic size={14} className="text-white/20" />
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
              <CtrlBtn
                icon={isMuted ? MicOff : Mic}
                active={!isMuted}
                muted={isMuted}
                onClick={toggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
              />
              <CtrlBtn
                icon={isHeld ? Play : Pause}
                active={isHeld}
                onClick={toggleHold}
                label={isHeld ? 'Resume' : 'Hold'}
              />
              <button
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
            <div className="w-11 h-11 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xl">📊</div>
            <div className="text-center">
              <div className="font-display font-bold text-[16px] mb-1.5">Analyze this session?</div>
              <p className="text-[12.5px] text-white/50 leading-relaxed">Get AI feedback on your pitch, objection handling, and framework score.</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => confirmEnd(false)}
                className="flex-1 py-2.5 rounded-[10px] bg-white/[0.05] border border-white/10 text-[13px] text-white/60 font-semibold hover:bg-white/[0.09] transition-colors"
              >
                Skip
              </button>
              <button
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

// ── Sub-components ────────────────────────────────────────────────────────────
function CtrlBtn({ icon: Icon, active, muted, onClick, label }: {
  icon: React.ElementType; active: boolean; muted?: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'w-11 h-11 rounded-[10px] flex items-center justify-center border transition-all',
        muted
          ? 'bg-accent-4/12 border-accent-4/40 text-accent-4'
          : active
          ? 'bg-accent/10 border-accent/40 text-accent'
          : 'bg-bg-3 border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08]'
      )}
    >
      <Icon size={16} />
    </button>
  );
}
