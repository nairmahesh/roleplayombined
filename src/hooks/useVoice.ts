// pitchiq/frontend/src/hooks/useVoice.ts
// Manages microphone capture → Deepgram STT → ElevenLabs TTS playback

import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { sessionsApi, voiceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface UseVoiceOptions {
  sessionId: string;
  voiceId: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAIResponse?: (text: string, timestampMs: number) => void;
  onError?: (err: string) => void;
}

export function useVoice({ sessionId, voiceId, onTranscript, onAIResponse, onError }: UseVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const socket = getSocket();

  // ─── Microphone capture ─────────────────────────────────────────────────────
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        // Send raw PCM to server WebSocket which proxies to Deepgram
        socket.emit('stt:audio', { sessionId, buffer: pcm16.buffer });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processorRef.current = processor;
      startTimeRef.current = Date.now();

      setIsListening(true);
    } catch (err: any) {
      onError?.(`Microphone error: ${err.message}`);
    }
  }, [isMuted, sessionId, socket, onError]);

  const stopMicrophone = useCallback(() => {
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    setIsListening(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    const track = mediaStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !track.enabled;
  }, []);

  // ─── TTS Playback ───────────────────────────────────────────────────────────
  const playTTS = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Stop any current audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.src = '';
        }

        setIsSpeaking(true);

        // Use fetch to stream audio from our API endpoint
        const url = voiceApi.getTTSUrl(voiceId);
        const audio = new Audio();
        currentAudioRef.current = audio;

        const token = useAuthStore.getState().accessToken;
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({ text }),
        }).then(async (res) => {
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          audio.src = objectUrl;
          audio.play();

          audio.onended = () => {
            URL.revokeObjectURL(objectUrl);
            setIsSpeaking(false);
            resolve();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            reject(new Error('Audio playback failed'));
          };
        });
      } catch (err: any) {
        setIsSpeaking(false);
        reject(err);
      }
    });
  }, [voiceId]);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      setIsSpeaking(false);
    }
  }, []);

  // ─── Socket event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const handleSTTFinal = async ({ transcript }: { transcript: string }) => {
      if (!transcript.trim()) return;
      onTranscript?.(transcript, true);

      const timestampMs = Date.now() - startTimeRef.current;

      // Save message and get AI response
      try {
        await sessionsApi.addMessage(sessionId, {
          role: 'user',
          content: transcript,
          timestampMs,
        });

        socket.emit('session:user_message', { sessionId, text: transcript, timestampMs });
      } catch (err: any) {
        onError?.(err.message);
      }
    };

    const handleSTTInterim = ({ transcript }: { transcript: string }) => {
      onTranscript?.(transcript, false);
    };

    const handleAIMessage = async ({ text, timestampMs }: { text: string; timestampMs: number }) => {
      onAIResponse?.(text, timestampMs);
      await playTTS(text);
    };

    socket.on('stt:final', handleSTTFinal);
    socket.on('stt:interim', handleSTTInterim);
    socket.on('session:ai_message', handleAIMessage);

    return () => {
      socket.off('stt:final', handleSTTFinal);
      socket.off('stt:interim', handleSTTInterim);
      socket.off('session:ai_message', handleAIMessage);
    };
  }, [sessionId, socket, onTranscript, onAIResponse, onError, playTTS]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopMicrophone();
      stopSpeaking();
    };
  }, [stopMicrophone, stopSpeaking]);

  const getTimestampMs = () => Date.now() - startTimeRef.current;

  return {
    isListening,
    isSpeaking,
    isMuted,
    startMicrophone,
    stopMicrophone,
    toggleMute,
    playTTS,
    stopSpeaking,
    getTimestampMs,
  };
}
