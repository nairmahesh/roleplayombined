// Online Meeting Room — Google Meet-style UI for ONLINE_MEETING sessions
// Handles camera/mic permission request, video tiles, screen share, recording, transcript chat

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Phone, BarChart3, Users, MessageSquare, X,
  MonitorPlay, Circle, Square, Download, Play,
  Film,
} from 'lucide-react';
import { sessionsApi, voiceApi } from '@/lib/api';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { connectSocket } from '@/lib/socket';
import { Framework, SessionType, FRAMEWORK_INFO } from '@/types';
import { AvatarDisplay } from '@/components/practice/PersonaAvatars';
import type { PersonaDisplay } from '@/components/practice/CallInterface';
import clsx from 'clsx';

const PERM_KEY = 'pitchiq-media-perm-granted';
export const RECORDINGS_LS_KEY = 'pitchiq-recordings';

export interface RecordingMeta {
  sessionId: string;
  recordedAt: string;
  durationMs: number;
  sizeBytes: number;
  objectUrl: string; // blob URL — only valid in the tab where it was created
}

interface Message { role: 'user' | 'assistant'; content: string; timestampMs: number; }

interface Props {
  sessionId: string;
  persona: PersonaDisplay;
  sessionType: SessionType;
  framework: Framework;
  timeLimitMins?: number | null;
  onEnd: (sessionId: string) => void;
  multiPersonas?: PersonaDisplay[];
}

// ── Permission Gate ────────────────────────────────────────────────────────────
function PermissionGate({ onGranted, onDenied }: { onGranted: (stream: MediaStream) => void; onDenied: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStorage.setItem(PERM_KEY, '1');
      onGranted(stream);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowed')) {
        setError('Camera and microphone access was denied. Please allow access in your browser settings.');
      } else if (msg.includes('NotFound')) {
        setError('No camera or microphone found. Please connect a device and try again.');
      } else {
        setError(`Could not access media: ${msg}`);
      }
      setRequesting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-[#202124] flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex flex-col items-center gap-6 max-w-sm w-full text-center"
      >
        {/* Camera preview placeholder */}
        <div className="w-36 h-36 rounded-full bg-[#3c4043] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <Video size={48} className="text-white/30" />
          </div>
          {/* Animated rings */}
          <div className="absolute inset-[-12px] rounded-full border-2 border-white/10 animate-[rp_2s_ease-out_infinite]" style={{ animation: 'none', borderStyle: 'dashed' }} />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Ready to join?</h2>
          <p className="text-[13px] text-white/60 leading-relaxed">
            PitchIQ needs access to your <strong className="text-white/80">camera and microphone</strong> for this meeting. Your video is only used locally — nothing is uploaded.
          </p>
        </div>

        {/* Feature list */}
        <div className="w-full flex flex-col gap-2">
          {[
            { icon: Video, label: 'See yourself during the call' },
            { icon: Mic, label: 'Talk to the AI persona' },
            { icon: MonitorPlay, label: 'Optional screen share' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5 rounded-[10px] bg-white/[0.04] border border-white/[0.06]">
              <Icon size={14} className="text-white/60 flex-shrink-0" />
              <span className="text-[12.5px] text-white/75">{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="w-full px-4 py-3 rounded-[10px] bg-red-500/10 border border-red-500/20 text-[12px] text-red-300 text-left">
            {error}
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button
            onClick={onDenied}
            className="flex-1 py-2.5 rounded-[10px] bg-white/[0.05] border border-white/10 text-[13px] text-white/70 font-semibold hover:bg-white/[0.09] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={request}
            disabled={requesting}
            className="flex-1 py-2.5 rounded-[10px] bg-[#1a73e8] text-white text-[13px] font-bold hover:bg-[#1557b0] transition-colors disabled:opacity-50"
          >
            {requesting ? 'Requesting…' : 'Allow & Join'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main export — wraps with ConversationProvider ──────────────────────────────
export function OnlineMeetingRoom(props: Props) {
  return (
    <ConversationProvider>
      <OnlineMeetingRoomInner {...props} />
    </ConversationProvider>
  );
}

// ── Inner room ─────────────────────────────────────────────────────────────────
function OnlineMeetingRoomInner({ sessionId, persona, framework, timeLimitMins, onEnd, multiPersonas = [] }: Props) {
  const { startSession, endSession, status, isSpeaking: isBotSpeaking, isMuted, setMuted } = useConversation();

  // Media streams
  const [localStream, setLocalStream]       = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream]     = useState<MediaStream | null>(null);
  const [permGranted, setPermGranted]       = useState(() => !!localStorage.getItem(PERM_KEY));

  // UI state
  const [camOn, setCamOn]                   = useState(true);
  const [micOn, setMicOn]                   = useState(true);
  const [screenOn, setScreenOn]             = useState(false);
  const [sidePanel, setSidePanel]           = useState<'chat' | 'people' | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [elapsed, setElapsed]               = useState(0);
  const [isEnding, setIsEnding]             = useState(false);
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [recordingBlob, setRecordingBlob]   = useState<Blob | null>(null);
  const [recordingObjectUrl, setRecordingObjectUrl] = useState<string | null>(null);
  const [showRecordingReview, setShowRecordingReview] = useState(false);
  const [videoPlaying, setVideoPlaying]     = useState(false);
  const [phase, setPhase]                   = useState<'joining' | 'active'>('joining');

  const localVideoRef    = useRef<HTMLVideoElement>(null);
  const screenVideoRef   = useRef<HTMLVideoElement>(null);
  const reviewVideoRef   = useRef<HTMLVideoElement>(null);
  const transcriptRef    = useRef<HTMLDivElement>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef     = useRef(Date.now());
  const historyRef       = useRef<Message[]>([]);
  const isEndingRef      = useRef(false);
  const handleEndRef     = useRef<(() => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const everConnectedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const endDataRef       = useRef<{ durationSeconds: number } | null>(null);
  const socket = connectSocket();
  const isConnected = status === 'connected';
  const allPersonas = multiPersonas.length > 0 ? [persona, ...multiPersonas] : [persona];

  // ── Attach local stream to video element ──────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // ── Start meeting after permissions granted ───────────────────────────────
  const startMeeting = useCallback(async (stream: MediaStream) => {
    setLocalStream(stream);
    setPermGranted(true);
    setPhase('active');
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
    socket.emit('session:join', { sessionId });
    try { await sessionsApi.start(sessionId); } catch {}

    // Connect ElevenLabs
    let signedUrl: string | null = null;
    try {
      signedUrl = await voiceApi.getSignedUrl(persona.personaId);
    } catch {
      toast.error('Could not connect to voice AI — check server config');
      onEnd(sessionId);
      return;
    }

    if (!signedUrl) {
      toast.error('Voice AI is not available in demo mode. Connect a backend with a valid ElevenLabs API key to enable live calls.', { duration: 8000 });
      onEnd(sessionId);
      return;
    }

    const overrides = persona.elevenlabsVoiceId ? { tts: { voiceId: persona.elevenlabsVoiceId } } : undefined;
    sessionStartedRef.current = true;
    startSession({
      signedUrl,
      overrides,
      onConnect: () => { everConnectedRef.current = true; },
      onMessage: ({ message, source }: { message: string; source: string }) => {
        if (message?.trim()) addMsg(source === 'ai' ? 'assistant' : 'user', message.trim());
      },
      onError: (msg: string) => toast.error(`Voice AI error: ${msg}`, { duration: 8000 }),
      onDisconnect: () => {
        if (sessionStartedRef.current && !isEndingRef.current && everConnectedRef.current) {
          handleEndRef.current?.();
        }
      },
    });
  }, [sessionId, persona, onEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start if already granted
  useEffect(() => {
    if (!permGranted) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(startMeeting)
      .catch(() => setPermGranted(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try { endSession(); } catch {}
      localStream?.getTracks().forEach(t => t.stop());
      screenStream?.getTracks().forEach(t => t.stop());
      socket.emit('session:leave', { sessionId });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addMsg = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: Message = { role, content, timestampMs: Date.now() - startTimeRef.current };
    historyRef.current = [...historyRef.current, msg];
    setMessages(prev => [...prev, msg]);
    sessionsApi.addMessage(sessionId, { role, content, timestampMs: msg.timestampMs }).catch(() => {});
    setTimeout(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, 50);
  }, [sessionId]);

  // ── Camera toggle ──────────────────────────────────────────────────────────
  const toggleCam = () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (track) { track.enabled = !camOn; setCamOn(v => !v); }
  };

  // ── Mic toggle ────────────────────────────────────────────────────────────
  const toggleMic = () => {
    setMicOn(v => {
      const next = !v;
      setMuted(!next);
      if (localStream) {
        localStream.getAudioTracks().forEach(t => { t.enabled = next; });
      }
      return next;
    });
  };

  // ── Screen share ──────────────────────────────────────────────────────────
  const toggleScreen = async () => {
    if (screenOn) {
      screenStream?.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setScreenOn(false);
    } else {
      try {
        const stream = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c: object) => Promise<MediaStream> })
          .getDisplayMedia({ video: true, audio: true });
        stream.getVideoTracks()[0].onended = () => { setScreenStream(null); setScreenOn(false); };
        setScreenStream(stream);
        setScreenOn(true);
      } catch { /* user cancelled */ }
    }
  };

  // ── Local recording ───────────────────────────────────────────────────────
  const recordingChunksRef = useRef<Blob[]>([]);

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      const tracks: MediaStreamTrack[] = [];
      if (localStream) tracks.push(...localStream.getTracks());
      if (screenStream) tracks.push(...screenStream.getTracks());
      if (tracks.length === 0) { toast.error('No media to record'); return; }
      recordingChunksRef.current = [];
      const combined = new MediaStream(tracks);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const mr = new MediaRecorder(combined, { mimeType });
      mr.ondataavailable = e => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setRecordingObjectUrl(url);
        // Persist metadata to localStorage for future reference
        saveRecordingMeta(sessionId, blob.size, url);
        toast.success('Recording ready — review it after the call');
      };
      mr.start(1000); // collect in 1s chunks
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      toast.success('Recording started');
    }
  };

  // Persist recording metadata (not the blob itself — too large for LS)
  // We store the object URL (valid for this session tab) + size + timestamp
  const saveRecordingMeta = (sid: string, size: number, url: string) => {
    try {
      const key = 'pitchiq-recordings';
      const existing = JSON.parse(localStorage.getItem(key) || '[]') as RecordingMeta[];
      const entry: RecordingMeta = {
        sessionId: sid,
        recordedAt: new Date().toISOString(),
        durationMs: elapsed,
        sizeBytes: size,
        objectUrl: url, // valid only in this tab/session
      };
      // Keep latest 20 recordings
      const updated = [entry, ...existing.filter(r => r.sessionId !== sid)].slice(0, 20);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch { /* storage full */ }
  };

  // ── End call ───────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);
    try { endSession(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    localStream?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    endDataRef.current = { durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) };
    // If actively recording, stop it — onstop will set recordingBlob and then we show review
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setRecordingObjectUrl(url);
        saveRecordingMeta(sessionId, blob.size, url);
        setShowRecordingReview(true); // show review before analysis
      };
      mediaRecorderRef.current.stop();
    } else if (recordingBlob) {
      // Recording already done — show review directly
      setShowRecordingReview(true);
    } else {
      setShowAnalysisPrompt(true);
    }
  }, [endSession, isRecording, localStream, screenStream, recordingBlob, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handleEndRef.current = handleEnd; });

  // ── Time limit ─────────────────────────────────────────────────────────────
  const timeLimitWarnRef = useRef(false);
  useEffect(() => {
    if (!timeLimitMins || phase !== 'active' || isEnding) return;
    const limitMs = timeLimitMins * 60 * 1000;
    if (!timeLimitWarnRef.current && elapsed >= limitMs - 60_000 && elapsed < limitMs) {
      timeLimitWarnRef.current = true; toast('1 minute remaining');
    }
    if (elapsed >= limitMs) { toast('Time limit reached'); handleEnd(); }
  }, [elapsed, timeLimitMins, phase, isEnding, handleEnd]);

  const confirmEnd = async (analyze: boolean) => {
    setShowAnalysisPrompt(false);
    const durationSeconds = endDataRef.current?.durationSeconds ?? 0;
    try {
      await sessionsApi.end(sessionId, { durationSeconds, transcript: historyRef.current, skipAnalysis: !analyze });
      toast.success(analyze ? 'Session ended — AI is analysing…' : 'Session saved.');
      onEnd(sessionId);
    } catch (err: unknown) {
      toast.error('Could not end session: ' + (err instanceof Error ? err.message : String(err)));
      isEndingRef.current = false; setIsEnding(false);
    }
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // ── Permission gate (first time) ──────────────────────────────────────────
  if (!permGranted) {
    return (
      <PermissionGate
        onGranted={startMeeting}
        onDenied={() => onEnd(sessionId)}
      />
    );
  }

  // ── Meeting room UI ────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#202124' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background: '#202124' }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-[15px] text-white/90">PitchIQ</span>
          <span className="text-white/30">·</span>
          <span className="text-[13px] text-white/60 font-mono">{fmt(elapsed)}</span>
          {timeLimitMins && (
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded border font-medium',
              elapsed >= timeLimitMins * 60 * 1000 - 60_000
                ? 'text-red-400 border-red-400/30 bg-red-400/10'
                : 'text-white/40 border-white/10'
            )}>/{timeLimitMins}:00</span>
          )}
          {phase === 'active' && (
            <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-green-400/30 bg-green-400/10 text-green-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {isConnected ? 'Live' : 'Connecting…'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-white/50">{FRAMEWORK_INFO[framework].label}</span>
          {isRecording && (
            <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-red-400/30 bg-red-400/10 text-red-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              REC
            </span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Video grid */}
        <div className="flex-1 flex flex-col min-w-0 relative p-3 gap-3">

          {/* Screen share — takes primary position when active */}
          {screenOn && screenStream && (
            <div className="flex-1 min-h-0 relative rounded-[14px] overflow-hidden bg-black">
              <video
                ref={el => {
                  (screenVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                  if (el && screenStream) el.srcObject = screenStream;
                }}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-3 text-[11px] text-white/60 bg-black/40 px-2 py-0.5 rounded">
                Your screen
              </div>
            </div>
          )}

          {/* Persona + self tiles */}
          <div className={clsx(
            'grid gap-3',
            screenOn
              ? 'flex-shrink-0 grid-cols-3 h-36'
              : `flex-1 min-h-0 ${allPersonas.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`,
          )}>

            {/* Persona tiles */}
            {allPersonas.map((p, idx) => (
              <div
                key={idx}
                className={clsx(
                  'relative rounded-[14px] overflow-hidden flex flex-col items-center justify-center',
                  !screenOn && idx === 0 && allPersonas.length === 1 ? '' : '',
                )}
                style={{ background: '#3c4043', minHeight: screenOn ? 0 : 180 }}
              >
                {/* Speaking pulse rings */}
                {isBotSpeaking && idx === 0 && (
                  <>
                    <div className="absolute inset-0 rounded-[14px] border-2 border-[#1a73e8]/60 z-10 animate-pulse" />
                  </>
                )}
                <div className={clsx('relative', screenOn ? 'w-14 h-14' : 'w-24 h-24 sm:w-32 sm:h-32')}>
                  <AvatarDisplay avatarId={p.avatarId} size={screenOn ? 56 : 128} speaking={idx === 0 && isBotSpeaking} />
                </div>
                {!screenOn && (
                  <div className="mt-3 text-center">
                    <div className="text-[13px] font-semibold text-white">{p.name}</div>
                    <div className="text-[11px] text-white/60">{p.title}</div>
                  </div>
                )}
                {/* Name bar (bottom left) */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-0.5">
                  {idx === 0 && isBotSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-pulse" />}
                  <span className="text-[11px] text-white/80">{p.name}</span>
                </div>
              </div>
            ))}

            {/* Self tile */}
            <div
              className="relative rounded-[14px] overflow-hidden flex flex-col items-center justify-center"
              style={{ background: '#3c4043', minHeight: screenOn ? 0 : 180 }}
            >
              {camOn && localStream ? (
                <video
                  ref={el => {
                    (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                    if (el && localStream) el.srcObject = localStream;
                  }}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className={clsx(
                    'rounded-full bg-[#5f6368] flex items-center justify-center',
                    screenOn ? 'w-10 h-10' : 'w-16 h-16'
                  )}>
                    <VideoOff size={screenOn ? 14 : 22} className="text-white/60" />
                  </div>
                  {!screenOn && <span className="text-[11px] text-white/50">Camera off</span>}
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-0.5">
                {!micOn && <MicOff size={10} className="text-red-400" />}
                <span className="text-[11px] text-white/80">You (Rep)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side panel — chat / people */}
        <AnimatePresence>
          {sidePanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 overflow-hidden flex flex-col border-l"
              style={{ background: '#292a2d', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <span className="text-[13px] font-semibold text-white">
                  {sidePanel === 'chat' ? 'In-call messages' : 'People'}
                </span>
                <button onClick={() => setSidePanel(null)} className="text-white/50 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              {sidePanel === 'people' && (
                <div className="flex flex-col gap-1 p-3">
                  {allPersonas.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-white/[0.04]">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <AvatarDisplay avatarId={p.avatarId} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold truncate">{p.name}</div>
                        <div className="text-[10.5px] text-white/50 truncate">{p.title}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#1a73e8]/30 text-[#1a73e8]/80">AI</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-white/[0.04]">
                    <div className="w-8 h-8 rounded-full bg-[#5f6368] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-white">Y</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold">You (Rep)</div>
                      <div className="text-[10.5px] text-white/50">Host</div>
                    </div>
                  </div>
                </div>
              )}

              {sidePanel === 'chat' && (
                <>
                  <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                    {messages.length === 0 && (
                      <div className="text-center text-white/40 text-[12px] py-12">
                        Conversation will appear here
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={clsx('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                        <span className="text-[10px] text-white/40 mb-1 px-1">
                          {msg.role === 'user' ? 'You' : persona.name}
                        </span>
                        <div className={clsx(
                          'max-w-[85%] px-3 py-2 rounded-[12px] text-[12.5px] leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-[#1a73e8]/25 border border-[#1a73e8]/20 text-white/90'
                            : 'bg-white/[0.07] border border-white/[0.07] text-white/75'
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls — Google Meet style */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4" style={{ background: '#202124' }}>
        {/* Left: time */}
        <div className="hidden sm:flex items-center gap-2 w-40">
          <span className="text-[12px] text-white/50 font-mono">{fmt(elapsed)}</span>
        </div>

        {/* Center: controls */}
        <div className="flex items-center gap-2">
          <MeetBtn
            icon={micOn ? Mic : MicOff}
            label={micOn ? 'Mute' : 'Unmute'}
            active={micOn}
            danger={!micOn}
            onClick={toggleMic}
          />
          <MeetBtn
            icon={camOn ? Video : VideoOff}
            label={camOn ? 'Turn off cam' : 'Turn on cam'}
            active={camOn}
            danger={!camOn}
            onClick={toggleCam}
          />
          <MeetBtn
            icon={screenOn ? MonitorOff : Monitor}
            label={screenOn ? 'Stop sharing' : 'Present now'}
            active={screenOn}
            onClick={toggleScreen}
          />
          <MeetBtn
            icon={isRecording ? Square : Circle}
            label={isRecording ? 'Stop recording' : 'Record'}
            active={isRecording}
            danger={isRecording}
            onClick={toggleRecording}
          />

          {/* Leave */}
          <button
            type="button"
            onClick={handleEnd}
            disabled={isEnding}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500 text-white text-[13px] font-bold hover:bg-red-600 transition-all disabled:opacity-50 ml-2"
          >
            <Phone size={14} className="rotate-[135deg]" />
            {isEnding ? 'Leaving…' : 'Leave call'}
          </button>
        </div>

        {/* Right: chat / people */}
        <div className="hidden sm:flex items-center gap-1 w-40 justify-end">
          <MeetBtn
            icon={MessageSquare}
            label="Chat"
            active={sidePanel === 'chat'}
            onClick={() => setSidePanel(p => p === 'chat' ? null : 'chat')}
            badge={messages.length > 0 && sidePanel !== 'chat' ? messages.length : undefined}
          />
          <MeetBtn
            icon={Users}
            label="People"
            active={sidePanel === 'people'}
            onClick={() => setSidePanel(p => p === 'people' ? null : 'people')}
          />
        </div>
      </div>

      {/* ── Recording review modal ── */}
      <AnimatePresence>
        {showRecordingReview && recordingObjectUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.93, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="flex flex-col gap-0 w-full max-w-2xl rounded-[20px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
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
                      {recordingBlob ? `${(recordingBlob.size / (1024 * 1024)).toFixed(1)} MB` : ''} · {fmt(elapsed)} duration · saved locally
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Download button */}
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = recordingObjectUrl;
                      a.download = `pitchiq-session-${sessionId}.webm`;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-white/10 text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>

              {/* Video player */}
              <div className="relative bg-black" style={{ aspectRatio: '16/9', maxHeight: '55vh' }}>
                <video
                  ref={reviewVideoRef}
                  src={recordingObjectUrl}
                  className="w-full h-full object-contain"
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onEnded={() => setVideoPlaying(false)}
                  controls
                  style={{ maxHeight: '55vh' }}
                />
                {/* Play overlay (shows until first play) */}
                {!videoPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onClick={() => reviewVideoRef.current?.play()}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors">
                      <Play size={26} className="text-white ml-1" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[11.5px] text-white/40 leading-relaxed">
                  Recording is stored in your browser for this session. Download to keep it permanently.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowRecordingReview(false); setShowAnalysisPrompt(true); }}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#1a73e8] text-white text-[13px] font-bold hover:bg-[#1557b0] transition-colors"
                >
                  Continue <BarChart3 size={13} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Analysis prompt modal ── */}
      <AnimatePresence>
        {showAnalysisPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col gap-5 items-center bg-[#292a2d] border border-white/10 rounded-[20px] p-7 w-[360px] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            >
              <div className="w-11 h-11 rounded-full bg-[#1a73e8]/15 border border-[#1a73e8]/25 flex items-center justify-center">
                <BarChart3 size={20} className="text-[#1a73e8]" />
              </div>
              <div className="text-center">
                <div className="font-bold text-[16px] text-white mb-1.5">Analyze this session?</div>
                <p className="text-[12.5px] text-white/60 leading-relaxed">Get AI feedback on your pitch, objection handling, and framework score.</p>
              </div>

              {/* Recording summary chip */}
              {recordingBlob && (
                <div className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <Film size={14} className="text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-white/80">Recording saved</div>
                    <div className="text-[10.5px] text-white/45">{(recordingBlob.size / (1024 * 1024)).toFixed(1)} MB · browser storage</div>
                  </div>
                  <button
                    onClick={() => setShowRecordingReview(true)}
                    className="text-[11px] text-[#1a73e8] hover:text-[#4d96ef] font-medium flex-shrink-0 transition-colors"
                  >
                    Review
                  </button>
                </div>
              )}

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
                  className="flex-1 py-2.5 rounded-[10px] bg-[#1a73e8] text-white text-[13px] font-bold hover:bg-[#1557b0] transition-colors"
                >
                  Analyze
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Control button ─────────────────────────────────────────────────────────────
function MeetBtn({
  icon: Icon, label, active, danger, onClick, badge,
}: {
  icon: React.ElementType; label: string; active?: boolean; danger?: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'relative flex flex-col items-center gap-0.5 w-12 h-12 rounded-full justify-center transition-all hover:scale-105 active:scale-95',
        danger ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : active ? 'bg-white/[0.12] text-white hover:bg-white/[0.18]' : 'bg-[#3c4043] text-white/70 hover:bg-[#4a4d50] hover:text-white',
      )}
    >
      <Icon size={18} />
      {badge != null && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1a73e8] text-white text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

