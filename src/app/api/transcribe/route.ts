import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
]);

function getGroqApiKey() {
  const collected: string[] = [];

  if (process.env.GROQ_API_KEY) {
    collected.push(...process.env.GROQ_API_KEY.split(',').map(v => v.trim()).filter(Boolean));
  }

  if (process.env.GROQ_API_KEYS) {
    collected.push(...process.env.GROQ_API_KEYS.split(',').map(v => v.trim()).filter(Boolean));
  }

  for (let i = 1; i <= 20; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`]?.trim();
    if (key) collected.push(key);
  }

  return collected[0] ?? null;
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, {
    scope: 'transcribe:post',
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ API key não configurada.' }, { status: 500 });
    }

    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro de áudio ausente.' }, { status: 400 });
    }
    if (!ALLOWED_AUDIO_MIME_TYPES.has(audio.type)) {
      return NextResponse.json(
        { error: 'Tipo MIME de áudio não suportado.' },
        { status: 400 },
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: 'Ficheiro demasiado grande (máx 25 MB).' },
        { status: 400 },
      );
    }

    const groqForm = new FormData();
    groqForm.append('file', audio, audio.name || 'speech.webm');
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('temperature', '0');
    groqForm.append('language', 'pt');
    groqForm.append('response_format', 'verbose_json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqForm,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message ?? 'Falha ao transcrever áudio.';
      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json({ text: data?.text ?? '' });
  } catch (error) {
    console.error('[api/transcribe] erro', error);
    return NextResponse.json({ error: 'Erro interno no serviço de transcrição.' }, { status: 500 });
  }
}
