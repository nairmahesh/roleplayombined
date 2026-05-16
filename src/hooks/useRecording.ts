// pitchiq/frontend/src/hooks/useRecording.ts
// Captures session audio/video using MediaRecorder and uploads to S3 when done

import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface UseRecordingOptions {
  sessionId: string;
  mode: 'audio' | 'video'; // phone = audio only, meeting = video
}

export function useRecording({ sessionId, mode }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = mode === 'video'
      ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')
      : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm');

    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size < 1000) return; // Skip empty recordings

      try {
        // Upload through backend (avoids S3 CORS configuration)
        const form = new FormData();
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        form.append('file', blob, `recording.${ext}`);
        const { data } = await api.post(`/recordings/upload/${sessionId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const key: string = data.key;
        await api.patch(`/sessions/${sessionId}`, { recordingUrl: key });
        setRecordingKey(key);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status !== 503) {
          console.error('Recording upload failed:', err);
          toast.error('Recording upload failed — feedback still available');
        }
      }
    };

    // Record in 5-second chunks for reliability
    recorder.start(5000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [sessionId, mode]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setIsRecording(false);
  }, []);

  const getPlaybackUrl = useCallback(async (): Promise<string | null> => {
    if (!recordingKey) return null;
    try {
      const { data } = await api.get(`/recordings/playback/${sessionId}`);
      return data.url;
    } catch {
      return null;
    }
  }, [sessionId, recordingKey]);

  return {
    isRecording,
    recordingKey,
    startRecording,
    stopRecording,
    getPlaybackUrl,
  };
}
