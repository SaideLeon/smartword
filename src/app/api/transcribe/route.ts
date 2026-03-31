import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getGroqApiKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (!process.env.GROQ_API_KEYS) return null;
  const first = process.env.GROQ_API_KEYS.split(',').map(v => v.trim()).find(Boolean);
  return first ?? null;
}

export async function POST(request: Request) {
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
