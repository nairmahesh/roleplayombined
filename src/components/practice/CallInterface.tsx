// pitchiq/frontend/src/components/practice/CallInterface.tsx
// Live call overlay — rings, bot picks up, continuous STT + TTS, interruption support

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mic, MicOff, Video, VideoOff, Monitor, Phone, Pause, Play } from 'lucide-react';
import { api, sessionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRecording } from '@/hooks/useRecording';
import { connectSocket } from '@/lib/socket';
import { Framework, SessionType, FRAMEWORK_INFO } from '@/types';
import { AvatarDisplay, AVATAR_VOICE_CONFIG, type AvatarId, type VoiceConfig } from '@/components/practice/PersonaAvatars';
import clsx from 'clsx';

const TTS_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

interface Message { role: 'user' | 'assistant'; content: string; timestampMs: number; }

export interface PersonaDisplay {
  name: string;
  title: string;
  emoji: string;
  avatarId?: string;
  elevenlabsVoiceId?: string;
}

interface Props {
  sessionId: string;
  persona: PersonaDisplay;
  sessionType: SessionType;
  framework: Framework;
  timeLimitMins?: number | null;
  onEnd: (sessionId: string) => void;
}

// ── Ring tone via Web Audio ───────────────────────────────────────────────────
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
      setTimeout(resolve, 3 * 2200 + 300);
    } catch { setTimeout(resolve, 2000); }
  });
}

// ── TTS via Web Speech API ────────────────────────────────────────────────────
function speakText(text: string, voiceCfg?: VoiceConfig, onDone?: () => void) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  if (voiceCfg) {
    u.lang  = voiceCfg.lang;
    u.pitch = voiceCfg.pitch;
    u.rate  = voiceCfg.rate;
    const langPrefix = voiceCfg.lang.split('-')[0];
    const v = voiceCfg.nameHints.reduce<SpeechSynthesisVoice | undefined>(
      (found, hint) => found || voices.find(v => v.name.includes(hint) && v.lang.startsWith(langPrefix)),
      undefined
    ) || voices.find(v => v.lang.startsWith(langPrefix)) || voices[0];
    if (v) u.voice = v;
  } else {
    const v = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')))
      || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (v) u.voice = v;
    u.rate = 1.0; u.pitch = 1.0;
  }
  u.volume = 1.0;
  let fired = false;
  const cb = () => { if (!fired) { fired = true; onDone?.(); } };
  u.onend  = cb;
  u.onerror = cb;
  setTimeout(() => window.speechSynthesis.speak(u), 200);
}

export function CallInterface({ sessionId, persona, sessionType, framework, timeLimitMins, onEnd }: Props) {
  const [phase, setPhase] = useState<'ringing' | 'active'>('ringing');
  const [ringDot, setRingDot] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [botState, setBotStateVal] = useState<'idle' | 'speaking' | 'thinking'>('idle');
  const [youState, setYouStateVal] = useState<'idle' | 'listening'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(sessionType === 'ONLINE_MEETING');
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false);

  const startTimeRef    = useRef(Date.now());
  const endDataRef      = useRef<{ durationSeconds: number } | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const elAudioRef      = useRef<HTMLAudioElement | null>(null);
  const abortCtrlRef    = useRef<AbortController | null>(null);
  const llmAbortRef     = useRef<AbortController | null>(null);
  const handleEndRef    = useRef<(() => void) | null>(null);
  const micStreamRef    = useRef<MediaStream | null>(null);
  const timeLimitWarnRef = useRef(false);
  const recogRef        = useRef<any>(null);
  const recGateRef      = useRef(false);   // true = block new STT submissions
  const recActiveRef    = useRef(false);
  const callLiveRef     = useRef(false);
  const botSpeakRef     = useRef(false);
  const openingDoneRef  = useRef(false);
  const historyRef      = useRef<Message[]>([]);
  const transcriptRef   = useRef<HTMLDivElement>(null);
  // ── Barge-in detection via AudioContext analyser ──────────────────────────
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const bargeinLoopRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const bargeinCountRef   = useRef(0);   // consecutive above-threshold frames needed
  const wasInterruptedRef = useRef(false);
  const isMutedRef        = useRef(false);
  const isHeldRef         = useRef(false);
  const botActiveRef      = useRef(false);
  const socket = connectSocket();

  const recording = useRecording({ sessionId, mode: sessionType === 'ONLINE_MEETING' ? 'video' : 'audio' });

  const tsNow = () => Date.now() - startTimeRef.current;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, 50);
  }, []);

  const addMsg = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: Message = { role, content, timestampMs: tsNow() };
    historyRef.current = [...historyRef.current, msg];
    setMessages(prev => [...prev, msg]);
    scrollToBottom();
  }, []);

  // ── Sync mute/hold state into refs (used inside interval closures) ───────────
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isHeldRef.current = isHeld; }, [isHeld]);

  // ── Stop all bot audio immediately (used by barge-in) ────────────────────────
  const stopBotAudio = useCallback(() => {
    window.speechSynthesis.cancel();
    if (abortCtrlRef.current) { abortCtrlRef.current.abort(); abortCtrlRef.current = null; }
    if (llmAbortRef.current) { llmAbortRef.current.abort(); llmAbortRef.current = null; }
    if (elAudioRef.current) { elAudioRef.current.pause(); elAudioRef.current = null; }
    botSpeakRef.current = false;
    setBotStateVal('idle');
  }, []);

  // ── TTS — streaming via MediaSource API for low-latency playback ─────────────
  const botSpeak = useCallback((text: string, onDone?: () => void) => {
    botSpeakRef.current = true;
    recGateRef.current = true;
    setBotStateVal('speaking');
    setYouStateVal('idle');
    // Kill recognition so buffered echo audio is discarded, not delivered later
    const prev = recogRef.current;
    recogRef.current = null;
    recActiveRef.current = false;
    if (prev) try { prev.abort(); } catch {}

    let doneCalled = false;
    const done = () => {
      if (doneCalled) return;
      doneCalled = true;
      botSpeakRef.current = false;
      setBotStateVal('idle');
      onDone?.();
    };
    const webSpeechFallback = () => {
      if (doneCalled) return;
      const voiceCfg = persona.avatarId ? AVATAR_VOICE_CONFIG[persona.avatarId as AvatarId] : undefined;
      speakText(text, voiceCfg, done);
    };

    if (!persona.elevenlabsVoiceId) { webSpeechFallback(); return; }

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    const streamTTS = async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const resp = await fetch(`${TTS_BASE}/voice/tts/${persona.elevenlabsVoiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text }),
          signal: ctrl.signal,
        });

        if (!resp.ok || !resp.body) throw new Error('TTS failed');

        // MediaSource streaming — audio starts on first chunk (~200ms) instead of full download
        const mimeType = 'audio/mpeg';
        if ('MediaSource' in window && MediaSource.isTypeSupported(mimeType)) {
          const ms = new MediaSource();
          const audioUrl = URL.createObjectURL(ms);
          const audio = new Audio(audioUrl);
          elAudioRef.current = audio;

          audio.onended = () => { URL.revokeObjectURL(audioUrl); elAudioRef.current = null; done(); };
          audio.onerror  = () => { URL.revokeObjectURL(audioUrl); elAudioRef.current = null; webSpeechFallback(); };

          ms.addEventListener('sourceopen', async () => {
            try {
              const sb = ms.addSourceBuffer(mimeType);
              const reader = resp.body!.getReader();
              let streamEnded = false;

              const pump = async () => {
                if (ctrl.signal.aborted) return;
                try {
                  const { done: d, value } = await reader.read();
                  if (d || ctrl.signal.aborted) {
                    streamEnded = true;
                    if (!sb.updating && ms.readyState === 'open') ms.endOfStream();
                    return;
                  }
                  if (sb.updating) {
                    await new Promise<void>(r => sb.addEventListener('updateend', r as any, { once: true }));
                  }
                  if (ms.readyState !== 'open') return;
                  sb.appendBuffer(value);
                } catch { /* stream aborted or ended */ }
              };

              sb.addEventListener('updateend', () => {
                // Start playing as soon as the first chunk is buffered
                if (audio.paused) audio.play().catch(() => {});
                if (streamEnded) {
                  try { if (ms.readyState === 'open') ms.endOfStream(); } catch {}
                } else {
                  pump();
                }
              });

              pump();
            } catch { webSpeechFallback(); }
          });

          // Trigger sourceopen — play() before data is fine, browser will wait
          audio.play().catch(() => {});
        } else {
          // Fallback for browsers without MediaSource support (Safari on older iOS)
          const blob = await resp.blob();
          if (ctrl.signal.aborted) { done(); return; }
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          elAudioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(audioUrl); elAudioRef.current = null; done(); };
          audio.onerror  = () => { URL.revokeObjectURL(audioUrl); elAudioRef.current = null; webSpeechFallback(); };
          audio.play().catch(() => webSpeechFallback());
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') { done(); return; }
        webSpeechFallback();
      }
    };

    streamTTS();
  }, [persona.avatarId, persona.elevenlabsVoiceId]);

  // ── Get AI response — SSE stream, TTS sentence-by-sentence ─────────────────
  const getBotReply = useCallback(async (userText: string) => {
    if (botActiveRef.current) return;
    botActiveRef.current = true;
    setBotStateVal('thinking');
    recGateRef.current = true;

    const ctrl = new AbortController();
    llmAbortRef.current = ctrl;

    // Sentence queue — TTS fires on each complete sentence as it arrives
    const sentenceQueue: string[] = [];
    let ttsActive = false;
    let streamDone = false;
    let wantsToEnd = false;
    let accumulated = '';
    let fullClean = '';

    let afterAllFired = false;
    const afterAll = () => {
      if (afterAllFired) return;
      afterAllFired = true;
      botActiveRef.current = false;
      if (fullClean) {
        historyRef.current = [...historyRef.current, { role: 'assistant', content: fullClean, timestampMs: tsNow() }];
        setMessages(prev => [...prev, { role: 'assistant', content: fullClean, timestampMs: tsNow() }]);
        scrollToBottom();
      }
      if (wantsToEnd) {
        setTimeout(() => { if (callLiveRef.current) handleEndRef.current?.(); }, 1200);
      } else if (callLiveRef.current && !isMutedRef.current && !isHeldRef.current) {
        setTimeout(startListening, 700);
      }
    };

    const flushNext = () => {
      if (ttsActive || sentenceQueue.length === 0) return;
      ttsActive = true;
      const sentence = sentenceQueue.shift()!;
      botSpeak(sentence, () => {
        ttsActive = false;
        if (sentenceQueue.length > 0) {
          flushNext();
        } else if (streamDone) {
          afterAll();
        }
      });
    };

    // Extract complete sentences from buffer, push to queue
    const extractSentences = (buf: string, force = false): string => {
      let rest = buf;
      for (;;) {
        const m = rest.match(/^([\s\S]+?[.!?])(?:\s+|$)([\s\S]*)$/);
        if (!m) break;
        const s = m[1].trim();
        rest = m[2];
        if (s.length >= 4) { sentenceQueue.push(s); flushNext(); }
      }
      if (force && rest.trim().length >= 2) { sentenceQueue.push(rest.trim()); flushNext(); }
      return rest;
    };

    try {
      const token = useAuthStore.getState().accessToken;
      const resp = await fetch(`${TTS_BASE}/sessions/${sessionId}/respond/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userMessage: userText }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) throw new Error('stream failed');

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let lineBuf = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuf += dec.decode(value, { stream: true });
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.done) {
              const full: string = ev.full ?? '';
              wantsToEnd = full.includes('[END_CALL]');
              fullClean = full.replace(/\s*\[END_CALL\]\s*/g, '').trim();
              streamDone = true;
              accumulated = accumulated.replace(/\s*\[END_CALL\]\s*/g, '');
              accumulated = extractSentences(accumulated, true);
              if (!ttsActive && sentenceQueue.length === 0) afterAll();
            } else if (typeof ev.t === 'string') {
              accumulated += ev.t;
              accumulated = extractSentences(accumulated);
            }
          } catch { /* ignore malformed SSE line */ }
        }
      }
    } catch (e: any) {
      botActiveRef.current = false;
      if (e?.name === 'AbortError') return;
      // SSE stream failed — fall back to non-streaming endpoint so bot still speaks
      try {
        const { response } = await sessionsApi.getAIResponse(sessionId, userText);
        const fallbackWantsEnd = response.includes('[END_CALL]');
        const clean = response.replace(/\s*\[END_CALL\]\s*/g, '').trim();
        if (clean) {
          botSpeak(clean, () => {
            historyRef.current = [...historyRef.current, { role: 'assistant', content: clean, timestampMs: tsNow() }];
            setMessages(prev => [...prev, { role: 'assistant', content: clean, timestampMs: tsNow() }]);
            scrollToBottom();
            sessionsApi.addMessage(sessionId, { role: 'assistant', content: clean, timestampMs: tsNow() }).catch(() => {});
            if (fallbackWantsEnd) {
              setTimeout(() => { if (callLiveRef.current) handleEndRef.current?.(); }, 1200);
            } else if (callLiveRef.current && !isMutedRef.current && !isHeldRef.current) {
              setTimeout(startListening, 700);
            }
          });
        }
      } catch {
        recGateRef.current = false;
        if (callLiveRef.current && !isMutedRef.current && !isHeldRef.current) startListening();
      }
    } finally {
      llmAbortRef.current = null;
    }
  }, [sessionId, botSpeak, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Continuous STT ──────────────────────────────────────────────────────────
  const buildRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onstart = () => {
      recActiveRef.current = true;
      if (!recGateRef.current && !isMutedRef.current && !isHeldRef.current) setYouStateVal('listening');
    };

    r.onresult = (e: any) => {
      if (recGateRef.current || isMutedRef.current || isHeldRef.current) return;
      let final2 = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (e.results[i].isFinal) {
          final2 += alt.transcript;
        }
      }
      if (final2.trim().length >= 2) {
        const text = final2.trim();
        addMsg('user', text);
        sessionsApi.addMessage(sessionId, { role: 'user', content: text, timestampMs: tsNow() }).catch(() => {});
        setYouStateVal('idle');
        recGateRef.current = true;
        const msgToSend = wasInterruptedRef.current ? `[interrupted] ${text}` : text;
        wasInterruptedRef.current = false;
        getBotReply(msgToSend);
      }
    };

    r.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      recActiveRef.current = false;
      if (callLiveRef.current && recogRef.current === r)
        setTimeout(() => { if (callLiveRef.current && !recActiveRef.current) try { r.start(); } catch {} }, 500);
    };

    r.onend = () => {
      recActiveRef.current = false;
      if (!callLiveRef.current) { setYouStateVal('idle'); return; }
      // Only auto-restart if this instance is still current (not replaced by botSpeak)
      if (recogRef.current !== r) return;
      setTimeout(() => {
        if (callLiveRef.current && !recActiveRef.current && recogRef.current === r)
          try { r.start(); } catch {}
      }, 50);
    };

    return r;
  }, [addMsg, getBotReply, sessionId]);

  const startListening = useCallback(() => {
    recGateRef.current = false;
    const r = buildRecognition();
    if (!r) return;
    recogRef.current = r;
    try { r.start(); } catch {}
  }, [buildRecognition]);

  const resumeListening = useCallback(() => {
    if (isMuted || isHeld) return;
    recGateRef.current = false;
    if (recActiveRef.current) setYouStateVal('listening');
  }, [isMuted, isHeld]);

  const stopListening = useCallback(() => {
    callLiveRef.current = false;
    recGateRef.current = true;
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch {}
      recogRef.current = null;
    }
    recActiveRef.current = false;
  }, []);

  // ── Session start ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Request mic permission first
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
      } catch { toast.error('Microphone access required'); onEnd(sessionId); return; }

      // Wire up AudioContext analyser for barge-in RMS detection
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(micStream).connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {}

      // 2. Start session on backend
      try { await sessionsApi.start(sessionId); } catch {}

      // 3. Ring animation
      for (let i = 0; i < 3; i++) {
        setTimeout(() => setRingDot(i + 1), i * 2200);
      }
      await playRings();

      // 4. Switch to active
      setPhase('active');
      startTimeRef.current = Date.now();
      callLiveRef.current = true;
      handleEndRef.current = handleEnd;

      // Barge-in detection: poll mic RMS ~12x/sec; require 4 consecutive frames
      // above threshold (~320ms of sustained voice) to avoid false triggers from
      // background noise spikes or short acoustic events.
      bargeinCountRef.current = 0;
      bargeinLoopRef.current = setInterval(() => {
        if (!botSpeakRef.current || isMutedRef.current || isHeldRef.current) {
          bargeinCountRef.current = 0;
          return;
        }
        if (!analyserRef.current) return;
        const buf = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(buf);
        let rms = 0;
        for (const v of buf) rms += v * v;
        rms = Math.sqrt(rms / buf.length);
        if (rms > 0.05) {
          bargeinCountRef.current += 1;
          if (bargeinCountRef.current >= 4) {
            bargeinCountRef.current = 0;
            window.speechSynthesis.cancel();
            if (abortCtrlRef.current) { abortCtrlRef.current.abort(); abortCtrlRef.current = null; }
            if (llmAbortRef.current) { llmAbortRef.current.abort(); llmAbortRef.current = null; }
            if (elAudioRef.current) { elAudioRef.current.pause(); elAudioRef.current = null; }
            botSpeakRef.current = false;
            setBotStateVal('idle');
            wasInterruptedRef.current = true;
            const prev = recogRef.current;
            recogRef.current = null;
            recActiveRef.current = false;
            recGateRef.current = false;
            if (prev) try { prev.abort(); } catch {}
            setTimeout(() => { if (callLiveRef.current && !isMutedRef.current && !isHeldRef.current) startListening(); }, 300);
          }
        } else {
          bargeinCountRef.current = 0;
        }
      }, 80);

      // 5. Start recording + call timer
      if (micStreamRef.current) recording.startRecording(micStreamRef.current);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);

      // 6. Get opening line from backend
      socket.emit('session:join', { sessionId });
      setBotStateVal('thinking');
      socket.emit('session:start', { sessionId }, (res: any) => {
        if (res?.opening && !openingDoneRef.current) {
          openingDoneRef.current = true;
          addMsg('assistant', res.opening);
          botSpeak(res.opening, () => {
            if (callLiveRef.current) setTimeout(startListening, 350);
          });
        }
      });
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (bargeinLoopRef.current) { clearInterval(bargeinLoopRef.current); bargeinLoopRef.current = null; }
      stopListening();
      window.speechSynthesis.cancel();
      if (elAudioRef.current) { elAudioRef.current.pause(); elAudioRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      socket.emit('session:leave', { sessionId });
    };
  }, []);

  // ── End call ─────────────────────────────────────────────────────────────────
  const handleEnd = () => {
    handleEndRef.current = handleEnd;
    if (isEnding) return;
    setIsEnding(true);
    stopListening();
    if (bargeinLoopRef.current) { clearInterval(bargeinLoopRef.current); bargeinLoopRef.current = null; }
    window.speechSynthesis.cancel();
    if (elAudioRef.current) { elAudioRef.current.pause(); elAudioRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    recording.stopRecording();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    endDataRef.current = { durationSeconds: Math.round((Date.now() - startTimeRef.current) / 1000) };
    setShowAnalysisPrompt(true);
  };

  const confirmEnd = async (analyze: boolean) => {
    setShowAnalysisPrompt(false);
    const durationSeconds = endDataRef.current?.durationSeconds ?? 0;
    try {
      await sessionsApi.end(sessionId, {
        durationSeconds,
        transcript: historyRef.current,
        skipAnalysis: !analyze,
      });
      toast.success(analyze ? 'Session ended — AI is analysing…' : 'Session saved.');
      onEnd(sessionId);
    } catch (err: any) {
      toast.error('Could not end session: ' + err.message);
      setIsEnding(false);
    }
  };

  // Auto-end when time limit is reached
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
  }, [elapsed, timeLimitMins, phase, isEnding]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const toggleMute = () => {
    setIsMuted(m => {
      if (!m) { stopListening(); setYouStateVal('idle'); }
      else { callLiveRef.current = true; setTimeout(startListening, 400); }
      return !m;
    });
  };

  const toggleHold = () => {
    setIsHeld(h => {
      if (!h) {
        recGateRef.current = true;
        window.speechSynthesis.pause();
        if (elAudioRef.current) elAudioRef.current.pause();
      } else {
        window.speechSynthesis.resume();
        if (elAudioRef.current) elAudioRef.current.play();
        setTimeout(startListening, 500);
      }
      return !h;
    });
  };

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4"
    >
      {/* Global keyframes — must persist across ringing→active phase change */}
      <style>{`@keyframes rp{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.08);opacity:0}}@keyframes avr{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.1);opacity:1}}`}</style>
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
            <div className="text-sm text-white/35 mb-4">{ringDot === 0 ? 'Calling…' : 'Ringing…'}</div>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={clsx('w-2.5 h-2.5 rounded-full transition-colors duration-300', ringDot > i ? 'bg-accent' : 'bg-white/15')} />
              ))}
            </div>
            <button
              onClick={() => onEnd(sessionId)}
              className="mt-8 px-6 py-2.5 bg-accent-4/15 text-accent-4 border border-accent-4/25 rounded-[9px] text-[12.5px] font-semibold cursor-pointer hover:bg-accent-4/25 transition-colors"
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
                {botState === 'thinking' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-5/10 border border-accent-5/20">
                    <span className="text-[10px] text-accent-5">Thinking…</span>
                  </div>
                )}
                {botState === 'speaking' && (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20">
                    <WaveBars />
                    <span className="text-[10px] text-accent">Speaking</span>
                  </div>
                )}
                <span className="px-2.5 py-1 rounded-full bg-accent-3/10 border border-accent-3/20 text-[10px] text-accent-3 font-medium">● LIVE</span>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row" style={{ height: 'clamp(320px, 55vh, 400px)' }}>
              {/* Video / avatar panels */}
              {sessionType === 'ONLINE_MEETING' ? (
                <div className="w-[260px] flex-shrink-0 grid grid-rows-2 border-r border-white/[0.07]">
                  <div className="relative bg-bg-3 flex items-center justify-center border-b border-white/[0.07]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                        {botState === 'speaking' && <div className="absolute inset-[-4px] rounded-full border-2 border-accent z-10" style={{ animation: 'avr 1.1s ease-in-out infinite' }} />}
                        <AvatarDisplay avatarId={persona.avatarId} size={64} speaking={botState === 'speaking'} />
                      </div>
                      <div className="text-[11px] text-white/65">{persona.name.split(' ')[0]}</div>
                      <StateTag state={botState} />
                    </div>
                  </div>
                  <div className="relative bg-bg-4 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-bg-4 border-2 border-white/10 flex items-center justify-center text-3xl">🎤</div>
                      <div className="text-[11px] text-white/65">You</div>
                      <StateTag state={youState === 'listening' ? 'listening' : 'idle'} />
                    </div>
                  </div>
                </div>
              ) : (
                /* Phone mode — single bot avatar */
                <div className="w-full sm:w-52 h-28 sm:h-auto bg-bg-3 border-b sm:border-b-0 sm:border-r border-white/[0.07] flex flex-row sm:flex-col items-center justify-center gap-3 px-4 sm:px-0 flex-shrink-0">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
                    {botState === 'speaking' && <div className="absolute inset-[-5px] rounded-full border-2 border-accent z-10 animate-[avr_1.1s_ease-in-out_infinite]" />}
                    <AvatarDisplay avatarId={persona.avatarId} size={80} speaking={botState === 'speaking'} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-center text-sm">{persona.name}</div>
                    <div className="text-[11px] text-white/65 text-center">{persona.title}</div>
                  </div>
                  <StateTag state={botState} />
                  <div className="mt-2"><StateTag state={youState === 'listening' ? 'listening' : 'idle'} prefix="You:" /></div>
                </div>
              )}

              {/* Transcript */}
              <div className="flex-1 flex flex-col bg-bg-3">
                <div className="px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Live Transcript</span>
                </div>
                <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5">
                  {messages.length === 0 && (
                    <div className="text-center text-white/25 text-xs py-8">Connecting…</div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <span className={clsx('text-[10px] font-bold', msg.role === 'assistant' ? 'text-[#9BA8FF]' : 'text-accent-3')}>
                        {msg.role === 'assistant' ? persona.name.split(' ')[0] : 'You'}
                      </span>
                      <p className="text-[12.5px] leading-relaxed text-white/75">{msg.content}</p>
                    </div>
                  ))}
                  {botState === 'thinking' && (
                    <div>
                      <span className="text-[10px] font-bold text-[#9BA8FF]">{persona.name.split(' ')[0]}</span>
                      <div className="flex gap-1 items-center h-5 mt-1">
                        {[0, 0.2, 0.4].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2.5 px-6 py-3.5 border-t border-white/[0.07]">
              <CtrlBtn icon={isMuted ? MicOff : Mic} active={!isMuted} muted={isMuted} onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'} />
              {sessionType === 'ONLINE_MEETING' && (
                <CtrlBtn icon={isCameraOn ? Video : VideoOff} active={isCameraOn} onClick={() => setIsCameraOn(v => !v)} label="Camera" />
              )}
              {sessionType === 'ONLINE_MEETING' && (
                <CtrlBtn icon={Monitor} active={false} onClick={() => toast('Screen share coming soon!')} label="Share" />
              )}
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
      </motion.div>

      {/* ── Analysis prompt modal ── */}
      {showAnalysisPrompt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[24px]">
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

function WaveBars() {
  return (
    <div className="flex items-center gap-0.5 h-3.5">
      {[0, 0.15, 0.3, 0.45, 0.6].map(d => (
        <div key={d} className="w-0.5 bg-accent rounded-full" style={{ height: '3px', animation: `wv 0.85s ease-in-out ${d}s infinite` }} />
      ))}
      <style>{`@keyframes wv{0%,100%{height:3px;opacity:.3}50%{height:14px;opacity:1}}`}</style>
    </div>
  );
}

function StateTag({ state, prefix }: { state: string; prefix?: string }) {
  const configs: Record<string, { cls: string; label: string }> = {
    speaking:  { cls: 'bg-accent/15 border-accent/30 text-accent', label: 'speaking' },
    listening: { cls: 'bg-accent-3/10 border-accent-3/20 text-accent-3', label: 'listening' },
    thinking:  { cls: 'bg-accent-5/10 border-accent-5/20 text-accent-5', label: 'thinking…' },
    idle:      { cls: 'bg-white/[0.04] border-white/[0.08] text-white/30', label: 'idle' },
  };
  const cfg = configs[state] || configs.idle;
  return (
    <div className={clsx('text-[9.5px] font-semibold px-2 py-0.5 rounded-full border', cfg.cls)}>
      {prefix ? `${prefix} ${cfg.label}` : cfg.label}
    </div>
  );
}

function CtrlBtn({ icon: Icon, active, muted, onClick, label }: {
  icon: React.ElementType; active: boolean; muted?: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'w-10 h-10 rounded-[10px] flex items-center justify-center border transition-all',
        muted ? 'bg-accent-4/12 border-accent-4 text-accent-4' :
        active ? 'bg-accent/10 border-accent text-accent' :
                 'bg-bg-3 border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08]'
      )}
    >
      <Icon size={15} />
    </button>
  );
}
