// Live call overlay — ElevenLabs Conversational AI via @elevenlabs/react SDK

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mic, MicOff, Phone, Pause, Play, BarChart3, Monitor, MonitorOff, Video, VideoOff, Users, Hand, MessageSquare, X, Share2, Maximize2, Minimize2 } from 'lucide-react';
import { sessionsApi } from '@/lib/api';

// ── ElevenLabs SDK shim (loaded dynamically so build succeeds without the package) ──
type ELStatus = 'disconnected' | 'connecting' | 'connected';
interface ELContext {
  startSession: (opts: any) => Promise<void>;
  endSession: () => void;
  status: ELStatus;
  isSpeaking: boolean;
  isMuted: boolean;
  setMuted: (v: boolean) => void;
}
const ELCtx = createContext<ELContext>({
  startSession: async () => {},
  endSession: () => {},
  status: 'disconnected',
  isSpeaking: false,
  isMuted: false,
  setMuted: () => {},
});

function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus]       = useState<ELStatus>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setMuted]       = useState(false);
  const wsRef = useRef<any>(null);

  const startSession = useCallback(async (opts: any) => {
    setStatus('connecting');
    try {
      const mod = await (new Function('s', 'return import(s)'))('@elevenlabs/react').catch(() => null);
      if (!mod) { toast.error('ElevenLabs SDK not available'); setStatus('disconnected'); return; }
      const { Conversation } = mod as any;
      const conv = await Conversation.startSession({
        ...opts,
        onMessage: opts.onMessage,
        onError: opts.onError,
        onModeChange: ({ mode }: any) => setIsSpeaking(mode?.mode === 'speaking'),
        onStatusChange: ({ status: s }: any) => setStatus(s),
        onDisconnect: opts.onDisconnect,
      });
      wsRef.current = conv;
      setStatus('connected');
    } catch (err: any) {
      setStatus('disconnected');
      opts.onError?.(err?.message ?? String(err));
    }
  }, []);

  const endSession = useCallback(() => {
    wsRef.current?.endSession?.().catch(() => {});
    wsRef.current = null;
    setStatus('disconnected');
    setIsSpeaking(false);
  }, []);

  return (
    <ELCtx.Provider value={{ startSession, endSession, status, isSpeaking, isMuted, setMuted }}>
      {children}
    </ELCtx.Provider>
  );
}

function useConversationControls() {
  const { startSession, endSession } = useContext(ELCtx);
  return { startSession, endSession };
}
function useConversationStatus() {
  const { status } = useContext(ELCtx);
  return { status };
}
function useConversationMode() {
  const { isSpeaking } = useContext(ELCtx);
  return { isSpeaking };
}
function useConversationInput() {
  const { isMuted, setMuted } = useContext(ELCtx);
  return { isMuted, setMuted };
}
// ── end shim ─────────────────────────────────────────────────────────────────

import { useRecording } from '@/hooks/useRecording';
import { useVoice } from '@/hooks/useVoice';
import { connectSocket } from '@/lib/socket';
import { Framework, SessionType, FRAMEWORK_INFO } from '@/types';
import { AvatarDisplay } from '@/components/practice/PersonaAvatars';
import { useElevenLabsStore } from '@/lib/store';
import clsx from 'clsx';

interface Message { role: 'user' | 'assistant'; content: string; timestampMs: number; speakerName?: string; }

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

// ── Meeting join animation (shorter — just 1.5s) ──────────────────────────────
function playMeetingJoin(): Promise<void> {
  return new Promise(resolve => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.4);
      setTimeout(resolve, 1500);
    } catch { setTimeout(resolve, 1000); }
  });
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
  const { agentId: EL_AGENT_ID, apiKey: EL_API_KEY } = useElevenLabsStore();
  const isMeeting = sessionType === 'ONLINE_MEETING';
  const useSocketVoice = !EL_AGENT_ID;

  const [phase, setPhase] = useState<'ringing' | 'active'>('ringing');
  const [ringDot, setRingDot] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [isHeld, setIsHeld] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false);

  // Meeting-room-specific state
  const [isCamOn, setIsCamOn]                 = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream]       = useState<MediaStream | null>(null);
  const [isHandRaised, setIsHandRaised]       = useState(false);
  const [showChat, setShowChat]               = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [activeSpeaker, setActiveSpeaker]     = useState<'user' | 'ai'>('ai');
  const [camStream, setCamStream]             = useState<MediaStream | null>(null);

  const userVideoRef   = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const startTimeRef     = useRef(Date.now());
  const endDataRef       = useRef<{ durationSeconds: number } | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLimitWarnRef = useRef(false);
  const historyRef       = useRef<Message[]>([]);
  const transcriptRef    = useRef<HTMLDivElement>(null);
  const handleEndRef     = useRef<(() => void) | null>(null);
  const isEndingRef      = useRef(false);

  const socket = connectSocket();
  const recording = useRecording({ sessionId, mode: isMeeting ? 'video' : 'audio' });

  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking: isBotSpeaking } = useConversationMode();
  const { isMuted: elMuted, setMuted } = useConversationInput();

  // Socket-based voice fallback (used when ElevenLabs is not configured)
  const socketVoice = useVoice({
    sessionId,
    voiceId: persona.elevenlabsVoiceId ?? '',
    onTranscript: (text, isFinal) => { if (isFinal) {} },
    onAIResponse: (text, timestampMs) => {
      const msg: Message = {
        role: 'assistant', content: text, timestampMs,
        speakerName: persona.name,
      };
      historyRef.current = [...historyRef.current, msg];
      setMessages(prev => [...prev, msg]);
      setActiveSpeaker('ai');
    },
    onError: (err) => toast.error(err),
  });

  const isMuted = useSocketVoice ? socketVoice.isMuted : elMuted;
  const isBotSpeakingFinal = useSocketVoice ? socketVoice.isSpeaking : isBotSpeaking;
  const isConnected = useSocketVoice ? phase === 'active' : status === 'connected';

  // Update active speaker indicator
  useEffect(() => {
    if (isBotSpeakingFinal) setActiveSpeaker('ai');
    else if (!isMuted) setActiveSpeaker('user');
  }, [isBotSpeakingFinal, isMuted]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, 50);
  }, []);

  const addMsg = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: Message = {
      role, content,
      timestampMs: Date.now() - startTimeRef.current,
      speakerName: role === 'assistant' ? persona.name : 'You',
    };
    historyRef.current = [...historyRef.current, msg];
    setMessages(prev => [...prev, msg]);
    sessionsApi.addMessage(sessionId, { role, content, timestampMs: msg.timestampMs }).catch(() => {});
    scrollToBottom();
  }, [sessionId, scrollToBottom, persona.name]);

  const buildSystemPrompt = useCallback(() => {
    if (persona.systemPrompt) return persona.systemPrompt;
    const meetingCtx = isMeeting
      ? `You are joining a video meeting. Be professional and concise as if on a Google Meet or Teams call. `
      : '';
    return (
      `You are ${persona.name}, ${persona.title}. ` +
      meetingCtx +
      `You are in a sales call roleplay. Act naturally as this persona — be realistic, slightly busy, ` +
      `raise objections, ask clarifying questions, and respond to the salesperson's pitch. ` +
      `Never break character. Keep responses concise and conversational (1-3 sentences). ` +
      `If the salesperson makes a compelling case, show buying signals. ` +
      `Use the ${FRAMEWORK_INFO[framework].label} sales framework context in your responses.`
    );
  }, [persona, framework, isMeeting]);

  const buildFirstMessage = useCallback(() => {
    if (persona.firstMessage) return persona.firstMessage;
    if (isMeeting) {
      const greetings = [
        `Hi, can everyone hear me okay? ${persona.name.split(' ')[0]} here.`,
        `Good to see you — I'm ${persona.name.split(' ')[0]}, let's get started.`,
        `Thanks for joining. ${persona.name.split(' ')[0]} — go ahead whenever you're ready.`,
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    const greetings = [
      `${persona.name.split(' ')[0]} speaking.`,
      `This is ${persona.name.split(' ')[0]}, go ahead.`,
      `Hello, ${persona.name.split(' ')[0]} here.`,
      `${persona.name.split(' ')[0]}, hi — I've only got a few minutes.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }, [persona, isMeeting]);

  const getSignedUrl = useCallback(async (): Promise<string | null> => {
    if (!EL_API_KEY || !EL_AGENT_ID) return null;
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${EL_AGENT_ID}`,
        { headers: { 'xi-api-key': EL_API_KEY } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.signed_url;
      }
    } catch { /* fall back to agentId */ }
    return null;
  }, [EL_AGENT_ID, EL_API_KEY]);

  // ── Start camera for meeting mode ─────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCamStream(stream);
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        toast('Camera blocked — click the camera icon in your browser address bar to allow access', { duration: 6000 });
      }
      setIsCamOn(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      setCamStream(null);
    }
  }, [camStream]);

  // ── Screen share ──────────────────────────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      toast('Screen sharing stopped');
      return;
    }
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        setScreenStream(null);
      };
      setScreenStream(stream);
      setIsScreenSharing(true);
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
      toast.success('Screen sharing started');
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        toast.error('Screen sharing was denied. Please allow screen sharing in your browser when prompted.');
      } else if (err?.name !== 'AbortError') {
        toast('Screen sharing cancelled');
      }
    }
  }, [isScreenSharing, screenStream]);

  // ── Session lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        const constraints = isMeeting ? { audio: true, video: true } : { audio: true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isMeeting) {
          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length > 0) {
            const videoStream = new MediaStream(videoTracks);
            setCamStream(videoStream);
            if (userVideoRef.current) userVideoRef.current.srcObject = videoStream;
          }
          const audioOnlyStream = new MediaStream(stream.getAudioTracks());
          stream = audioOnlyStream;
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          toast.error(
            'Microphone access denied. Click the microphone icon in your browser address bar and select "Allow", then try again.',
            { duration: 8000 }
          );
        } else if (err?.name === 'NotFoundError') {
          toast.error('No microphone found. Please connect a microphone and try again.');
        } else {
          toast.error('Could not access microphone. Please check your browser permissions.');
        }
        onEnd(sessionId);
        return;
      }

      try { await sessionsApi.start(sessionId); } catch {}

      if (isMeeting) {
        await playMeetingJoin();
        if (!cancelled) {
          setPhase('active');
          startTimeRef.current = Date.now();
          timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
          recording.startRecording(stream);
          socket.emit('session:join', { sessionId });
        }
      } else {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => { if (!cancelled) setRingDot(i + 1); }, i * 2200);
        }
        await playRings();
        if (cancelled) return;
        setPhase('active');
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
        recording.startRecording(stream);
        socket.emit('session:join', { sessionId });
      }

      if (cancelled) return;

      if (useSocketVoice) {
        // No ElevenLabs — use socket-based STT/AI/TTS pipeline
        await socketVoice.startMicrophone();
      } else {
        const signedUrl = await getSignedUrl();
        const overrides = {
          agent: {
            prompt: { prompt: buildSystemPrompt() },
            firstMessage: buildFirstMessage(),
          },
          ...(persona.elevenlabsVoiceId ? { tts: { voiceId: persona.elevenlabsVoiceId } } : {}),
        };
        try {
          await startSession({
            ...(signedUrl ? { signedUrl } : { agentId: EL_AGENT_ID }),
            overrides,
            onMessage: ({ message, source }: { message: string; source: string }) => {
              if (message?.trim()) {
                addMsg(source === 'ai' ? 'assistant' : 'user', message.trim());
              }
            },
            onError: (msg: string) => {
              if (!cancelled) toast.error(`Voice connection error: ${msg}`);
            },
            onDisconnect: () => {
              if (!cancelled && !isEndingRef.current) handleEndRef.current?.();
            },
          } as any);
        } catch (err: any) {
          if (!cancelled) toast.error('Could not connect to ElevenLabs: ' + err.message);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (useSocketVoice) { socketVoice.stopMicrophone(); } else { try { endSession(); } catch {} }
      socket.emit('session:leave', { sessionId });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep camera video ref in sync
  useEffect(() => {
    if (userVideoRef.current && camStream) {
      userVideoRef.current.srcObject = camStream;
    }
  }, [camStream, phase]);

  // Keep screen share video ref in sync
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream, phase]);

  // ── End call ──────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);

    if (useSocketVoice) { socketVoice.stopMicrophone(); socketVoice.stopSpeaking(); } else { try { endSession(); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);
    recording.stopRecording?.();
    stopCamera();
    screenStream?.getTracks().forEach(t => t.stop());

    endDataRef.current = { durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) };
    setShowAnalysisPrompt(true);
  }, [endSession, recording, stopCamera, screenStream]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toggleMicMute = () => {
    if (useSocketVoice) { socketVoice.toggleMute(); }
    else { setMuted(!isMuted); }
  };

  const toggleHold = () => {
    setIsHeld(h => {
      const next = !h;
      if (useSocketVoice) { socketVoice.toggleMute(); } else { setMuted(next); }
      return next;
    });
  };

  const toggleCam = () => {
    if (isCamOn) {
      stopCamera();
      setIsCamOn(false);
    } else {
      startCamera().then(() => setIsCamOn(true));
    }
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
        @keyframes wv{0%,100%{height:3px;opacity:.3}50%{height:14px;opacity:1}}
        @keyframes speak-pulse{0%,100%{opacity:.4;transform:scale(.96)}50%{opacity:1;transform:scale(1)}}
      `}</style>

      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className={clsx(
          'relative bg-bg-2 border-0 sm:border border-white/10 rounded-none sm:rounded-[24px] w-full overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(91,111,255,0.08)]',
          isMeeting
            ? isFullscreen
              ? 'h-full sm:max-w-full sm:rounded-none'
              : 'h-full sm:max-w-[1100px] sm:h-[90vh]'
            : 'h-full sm:h-auto sm:max-w-[880px]'
        )}
      >
        {/* ── PHONE RINGING ── */}
        {phase === 'ringing' && !isMeeting && (
          <div className="flex flex-col items-center justify-center py-16 gap-0">
            <div className="relative w-24 h-24 rounded-full overflow-hidden mb-5 flex-shrink-0">
              <div className="absolute inset-[-10px] rounded-full border-2 border-accent/35 z-10" style={{ animation: 'rp 1.4s ease-out infinite' }} />
              <div className="absolute inset-[-22px] rounded-full border-2 border-accent/18 z-10" style={{ animation: 'rp 1.4s ease-out 0.5s infinite' }} />
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
              onClick={() => onEnd(sessionId)}
              className="px-6 py-2.5 bg-accent-4/15 text-accent-4 border border-accent-4/25 rounded-[9px] text-[12.5px] font-semibold cursor-pointer hover:bg-accent-4/25 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── MEETING JOINING ── */}
        {phase === 'ringing' && isMeeting && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div className="relative">
              <div className="absolute inset-[-12px] rounded-full border-2 border-accent/30 z-10" style={{ animation: 'rp 1.6s ease-out infinite' }} />
              <div className="w-20 h-20 rounded-full overflow-hidden">
                <AvatarDisplay avatarId={persona.avatarId} size={80} />
              </div>
            </div>
            <div className="text-center">
              <div className="font-display font-bold text-xl mb-1">{persona.name}</div>
              <div className="text-sm text-white/65">{persona.title}</div>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-white/60">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Joining meeting room…
            </div>
          </div>
        )}

        {/* ── PHONE ACTIVE CALL ── */}
        {phase === 'active' && !isMeeting && (
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
                {isBotSpeakingFinal && (
                  <div className="flex items-center gap-1 h-5">
                    {[0, 0.12, 0.24, 0.36, 0.48].map(d => (
                      <div key={d} className="w-[3px] bg-accent rounded-full" style={{ height: '3px', animation: `wv 0.85s ease-in-out ${d}s infinite` }} />
                    ))}
                  </div>
                )}
                <span className="px-2.5 py-1 rounded-full bg-accent-3/10 border border-accent-3/20 text-[10px] text-accent-3 font-medium">● LIVE</span>
                {!isConnected && phase === 'active' && (
                  <span className="text-[10px] text-white/55 animate-pulse">Connecting…</span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row" style={{ height: 'clamp(320px, 55vh, 420px)' }}>
              {/* Avatar panel */}
              <div className="flex-shrink-0 bg-bg-3 border-b sm:border-b-0 sm:border-r border-white/[0.07] flex items-center justify-center sm:w-52 h-28 sm:h-auto">
                <div className="flex flex-col items-center gap-3 p-4">
                  <div className="relative">
                    {isBotSpeakingFinal && (
                      <>
                        <div className="absolute inset-[-8px] rounded-full border-2 border-accent/40 z-10" style={{ animation: 'rp 1.2s ease-out infinite' }} />
                        <div className="absolute inset-[-16px] rounded-full border border-accent/20 z-10" style={{ animation: 'rp 1.2s ease-out 0.4s infinite' }} />
                      </>
                    )}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
                      <AvatarDisplay avatarId={persona.avatarId} size={80} speaking={isBotSpeakingFinal} />
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
                  {isBotSpeakingFinal && (
                    <div className="flex items-center gap-1 h-3.5">
                      {[0, 0.15, 0.3].map(d => (
                        <div key={d} className="w-0.5 bg-accent/60 rounded-full" style={{ height: '3px', animation: `wv 0.85s ease-in-out ${d}s infinite` }} />
                      ))}
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
              <CtrlBtn icon={isMuted ? MicOff : Mic} active={!isMuted} muted={isMuted} onClick={toggleMicMute} label={isMuted ? 'Unmute' : 'Mute'} />
              <CtrlBtn icon={isHeld ? Play : Pause} active={isHeld} onClick={toggleHold} label={isHeld ? 'Resume' : 'Hold'} />
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

        {/* ── ONLINE MEETING ROOM ── */}
        {phase === 'active' && isMeeting && (
          <div className="flex flex-col h-full">
            {/* Meeting header bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07] bg-black/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-3 animate-pulse" />
                  <span className="text-[13px] font-semibold">{persona.name}</span>
                  <span className="text-[11px] text-white/45">·</span>
                  <span className="text-[11px] text-white/55">{FRAMEWORK_INFO[framework].label}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-[12px] text-white/65 tabular-nums">{fmt(elapsed)}</div>
                {timeLimitMins && (
                  <span className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded border',
                    elapsed >= timeLimitMins * 60 * 1000 - 60_000
                      ? 'text-accent-4 border-accent-4/30 bg-accent-4/10'
                      : 'text-white/45 border-white/[0.08]'
                  )}>
                    /{timeLimitMins}:00
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-3/10 border border-accent-3/20 text-accent-3 font-medium">● LIVE</span>
                <button
                  onClick={() => setIsFullscreen(v => !v)}
                  className="w-7 h-7 flex items-center justify-center rounded-[7px] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
            </div>

            {/* Main meeting area */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Video grid area */}
              <div className="flex-1 min-w-0 flex flex-col bg-[#1a1a2e] relative">
                {/* Screen share view */}
                {isScreenSharing && (
                  <div className="flex-1 relative bg-black flex items-center justify-center">
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      muted
                      className="max-w-full max-h-full object-contain"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-[7px] text-[11px] text-white/80">
                      <Monitor size={11} className="text-accent" /> You are presenting
                    </div>
                  </div>
                )}

                {/* Video tiles grid */}
                <div className={clsx(
                  'grid gap-2 p-3',
                  isScreenSharing
                    ? 'grid-cols-2 h-36 flex-shrink-0'
                    : 'flex-1 grid-rows-1',
                  !isScreenSharing && 'grid-cols-2'
                )}>
                  {/* AI Persona tile */}
                  <div className={clsx(
                    'relative rounded-[12px] overflow-hidden bg-[#0d0d1a] border flex items-center justify-center',
                    activeSpeaker === 'ai' && isBotSpeakingFinal
                      ? 'border-accent/60 shadow-[0_0_0_2px_rgba(91,111,255,0.4)]'
                      : 'border-white/[0.07]'
                  )}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        {isBotSpeakingFinal && (
                          <>
                            <div className="absolute inset-[-6px] rounded-full border-2 border-accent/50 z-10" style={{ animation: 'rp 1.1s ease-out infinite' }} />
                            <div className="absolute inset-[-14px] rounded-full border border-accent/25 z-10" style={{ animation: 'rp 1.1s ease-out 0.4s infinite' }} />
                          </>
                        )}
                        <div className="w-16 h-16 rounded-full overflow-hidden">
                          <AvatarDisplay avatarId={persona.avatarId} size={64} speaking={isBotSpeakingFinal} />
                        </div>
                      </div>
                      {/* Speaker diarisation waveform */}
                      {isBotSpeakingFinal && (
                        <div className="flex items-end gap-[3px] h-5">
                          {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.35, 0.2].map((d, i) => (
                            <div key={i} className="w-[3px] bg-accent rounded-full" style={{ height: '4px', animation: `wv 0.7s ease-in-out ${d}s infinite` }} />
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Name tag */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-[6px]">
                      <span className="text-[11px] font-medium text-white">{persona.name}</span>
                      {isBotSpeakingFinal && <span className="w-1.5 h-1.5 rounded-full bg-accent-3 animate-pulse flex-shrink-0" />}
                    </div>
                    {/* Speaker label */}
                    {activeSpeaker === 'ai' && isBotSpeakingFinal && (
                      <div className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-accent/20 border border-accent/30 text-accent">Speaking</div>
                    )}
                  </div>

                  {/* User tile */}
                  <div className={clsx(
                    'relative rounded-[12px] overflow-hidden bg-[#0d1a0d] border flex items-center justify-center',
                    activeSpeaker === 'user' && !isMuted
                      ? 'border-accent-3/60 shadow-[0_0_0_2px_rgba(6,214,160,0.35)]'
                      : 'border-white/[0.07]'
                  )}>
                    {isCamOn && camStream ? (
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
                          <span className="text-2xl font-bold text-white/40">Y</span>
                        </div>
                        {!isMuted && !isCamOn && (
                          <div className="flex items-end gap-[3px] h-5">
                            {[0, 0.1, 0.2, 0.15, 0.25, 0.18, 0.08].map((d, i) => (
                              <div key={i} className="w-[3px] bg-accent-3/70 rounded-full" style={{ height: '4px', animation: `wv 0.8s ease-in-out ${d}s infinite` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Name + status */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-[6px]">
                      <span className="text-[11px] font-medium text-white">You</span>
                      {isMuted && <MicOff size={9} className="text-accent-4 flex-shrink-0" />}
                      {!isCamOn && <VideoOff size={9} className="text-accent-4 flex-shrink-0" />}
                      {isHandRaised && <Hand size={9} className="text-amber-400 flex-shrink-0" />}
                      {!isMuted && activeSpeaker === 'user' && <span className="w-1.5 h-1.5 rounded-full bg-accent-3 animate-pulse flex-shrink-0" />}
                    </div>
                    {activeSpeaker === 'user' && !isMuted && (
                      <div className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-accent-3/20 border border-accent-3/30 text-accent-3">Speaking</div>
                    )}
                  </div>
                </div>

                {/* Screen share banner when not sharing */}
                {!isScreenSharing && (
                  <div className="flex items-center justify-center gap-2 py-2 bg-black/20 border-t border-white/[0.05] flex-shrink-0">
                    <button
                      onClick={toggleScreenShare}
                      className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      <Share2 size={11} /> Share your screen to present
                    </button>
                  </div>
                )}
              </div>

              {/* Right panel — transcript / chat */}
              <div className={clsx(
                'flex-shrink-0 border-l border-white/[0.07] flex flex-col bg-bg-2 transition-all',
                (showChat || !isScreenSharing) ? 'w-72' : 'w-0 overflow-hidden'
              )}>
                {/* Panel tabs */}
                <div className="flex border-b border-white/[0.07] flex-shrink-0">
                  <button
                    onClick={() => setShowChat(false)}
                    className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors', !showChat ? 'text-white border-b-2 border-accent' : 'text-white/45 hover:text-white/70')}
                  >
                    <Mic size={10} /> Transcript
                  </button>
                  <button
                    onClick={() => setShowChat(true)}
                    className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors', showChat ? 'text-white border-b-2 border-accent' : 'text-white/45 hover:text-white/70')}
                  >
                    <MessageSquare size={10} /> Chat
                  </button>
                </div>

                {/* Transcript */}
                {!showChat && (
                  <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <Mic size={16} className="text-white/20" />
                        <p className="text-[11px] text-white/35">Transcript will appear here with speaker labels</p>
                        <p className="text-[10px] text-white/25">Speaker diarisation enabled</p>
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className={clsx(
                          'text-[9.5px] font-semibold uppercase tracking-wider',
                          msg.role === 'user' ? 'text-accent-3/70' : 'text-accent/70'
                        )}>
                          {msg.speakerName}
                          <span className="ml-1.5 font-normal normal-case tracking-normal text-white/25">
                            {Math.floor(msg.timestampMs / 60000)}:{String(Math.floor((msg.timestampMs % 60000) / 1000)).padStart(2, '0')}
                          </span>
                        </span>
                        <div className={clsx(
                          'px-3 py-2 rounded-[10px] text-[11.5px] leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-accent-3/10 border border-accent-3/15 text-white/85'
                            : 'bg-white/[0.04] border border-white/[0.06] text-white/70'
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isBotSpeakingFinal && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-accent/70">{persona.name}</span>
                        <div className="px-3 py-2 rounded-[10px] bg-white/[0.04] border border-white/[0.06] flex items-center gap-1.5">
                          {[0, 0.15, 0.3].map(d => (
                            <div key={d} className="w-1 h-1 rounded-full bg-accent/50" style={{ animation: `speak-pulse 1s ease-in-out ${d}s infinite` }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat panel */}
                {showChat && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <MessageSquare size={20} className="text-white/20" />
                    <p className="text-[11.5px] text-white/40">In-meeting chat</p>
                    <p className="text-[10px] text-white/25">Messages sent here are visible to all attendees</p>
                  </div>
                )}

                {/* Participant count */}
                <div className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-1.5 flex-shrink-0">
                  <Users size={10} className="text-white/35" />
                  <span className="text-[10px] text-white/40">2 participants</span>
                  <span className="ml-auto text-[9px] text-accent-3/50 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-3/50" /> Diarisation on
                  </span>
                </div>
              </div>
            </div>

            {/* Meeting controls bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.07] bg-black/40 flex-shrink-0">
              {/* Left controls */}
              <div className="flex items-center gap-1.5">
                <MeetingCtrlBtn
                  icon={isMuted ? MicOff : Mic}
                  label={isMuted ? 'Unmute' : 'Mute'}
                  active={!isMuted}
                  danger={isMuted}
                  onClick={toggleMicMute}
                />
                <MeetingCtrlBtn
                  icon={isCamOn ? Video : VideoOff}
                  label={isCamOn ? 'Stop Video' : 'Start Video'}
                  active={isCamOn}
                  danger={!isCamOn}
                  onClick={toggleCam}
                />
                <MeetingCtrlBtn
                  icon={isScreenSharing ? MonitorOff : Monitor}
                  label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
                  active={isScreenSharing}
                  onClick={toggleScreenShare}
                />
              </div>

              {/* Center controls */}
              <div className="flex items-center gap-1.5">
                <MeetingCtrlBtn
                  icon={Hand}
                  label={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                  active={isHandRaised}
                  onClick={() => { setIsHandRaised(v => !v); if (!isHandRaised) toast('Hand raised'); }}
                />
                <MeetingCtrlBtn
                  icon={Users}
                  label="Participants"
                  active={showParticipants}
                  onClick={() => setShowParticipants(v => !v)}
                />
                <MeetingCtrlBtn
                  icon={MessageSquare}
                  label="Chat"
                  active={showChat}
                  onClick={() => setShowChat(v => !v)}
                />
              </div>

              {/* Right — end */}
              <button
                onClick={handleEnd}
                disabled={isEnding}
                className="flex items-center gap-2 px-5 py-2 rounded-[10px] bg-accent-4 text-white text-[12.5px] font-bold hover:bg-red-500 transition-all shadow-[0_4px_20px_rgba(255,107,107,0.3)] disabled:opacity-50"
              >
                <X size={13} />
                {isEnding ? 'Ending…' : 'Leave Meeting'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Analysis prompt modal ── */}
      <AnimatePresence>
        {showAnalysisPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-bg-2 border border-white/10 rounded-[18px] p-7 w-[340px] flex flex-col items-center gap-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            >
              <div className="w-11 h-11 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center"><BarChart3 size={20} className="text-accent" /></div>
              <div className="text-center">
                <div className="font-display font-bold text-[16px] mb-1.5">Analyze this session?</div>
                <p className="text-[12.5px] text-white/70 leading-relaxed">Get AI feedback on your pitch, objection handling, and framework score.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => confirmEnd(false)}
                  className="flex-1 py-2.5 rounded-[10px] bg-white/[0.05] border border-white/10 text-[13px] text-white/75 font-semibold hover:bg-white/[0.09] transition-colors"
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
      </AnimatePresence>
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
          : 'bg-bg-3 border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08]'
      )}
    >
      <Icon size={16} />
    </button>
  );
}

function MeetingCtrlBtn({ icon: Icon, label, active, danger, onClick }: {
  icon: React.ElementType; label: string; active?: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-[9px] transition-all min-w-[52px]',
        danger
          ? 'bg-accent-4/12 text-accent-4 hover:bg-accent-4/20'
          : active
          ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
          : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
      )}
    >
      <Icon size={17} />
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}
