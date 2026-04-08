'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

interface Props {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

function getPreferredMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function AudioInputButton({ onTranscription, disabled = false, className = '', title }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const unsupported = useMemo(() => (
    typeof window !== 'undefined' && (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
  ), []);

  const stopStream = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.stop();
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (isTranscribing || disabled || unsupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (!blob.size) return;
          setIsTranscribing(true);
          const form = new FormData();
          const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
          form.append('audio', blob, `speech.${extension}`);

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: form,
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            const reason = typeof payload?.error === 'string' ? payload.error : 'Falha na transcrição';
            const detail = payload?.details ? ` | detalhes: ${JSON.stringify(payload.details)}` : '';
            throw new Error(`${reason} (HTTP ${res.status})${detail}`);
          }
          const data = await res.json();
          if (typeof data.text === 'string' && data.text.trim()) {
            onTranscription(data.text.trim());
          }
        } catch (error) {
          console.error('[AudioInputButton] Erro ao transcrever áudio', error);
        } finally {
          setIsTranscribing(false);
          stopStream();
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      stopStream();
    }
  }, [disabled, isTranscribing, onTranscription, stopStream, unsupported]);

  const handleClick = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }
    await startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isTranscribing || unsupported}
      title={title ?? (isRecording ? 'Parar gravação' : 'Gravar áudio')}
      aria-label={title ?? (isRecording ? 'Parar gravação' : 'Gravar áudio')}
      className={`flex shrink-0 items-center justify-center rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
        isRecording
          ? 'border-red-500/50 bg-red-900/30 text-red-300'
          : 'border-[var(--panel-border,#2e2e2e)] text-[var(--panel-text-dim,#9ca3af)] hover:border-[var(--panel-accent,#7dd3fc)] hover:text-[var(--panel-accent,#7dd3fc)]'
      } ${className}`}
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
