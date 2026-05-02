import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

const ALLOWED = new Set(['image/png', 'image/jpeg']);
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function collectGeminiKey(): string | null {
  const vals = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS]
    .filter(Boolean)
    .flatMap(v => String(v).split(',').map(x => x.trim()).filter(Boolean));
  for (let i = 1; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) vals.push(k);
  }
  return vals[0] ?? null;
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'requerimento:extract', maxRequests: 8, windowMs: 60_000 });
  if (limited) return limited;
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const form = await req.formData();
    const image = form.get('image');
    if (!(image instanceof File)) return NextResponse.json({ error: 'Imagem ausente.' }, { status: 400 });
    const mime = image.type.split(';')[0].trim().toLowerCase();
    if (!ALLOWED.has(mime)) return NextResponse.json({ error: 'Use PNG ou JPG.' }, { status: 400 });
    if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Imagem demasiado grande (máx 6MB).' }, { status: 400 });

    const apiKey = collectGeminiKey();
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });

    const bytes = new Uint8Array(await image.arrayBuffer());
    const b64 = Buffer.from(bytes).toString('base64');
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [
        { text: 'Extrai os dados de um documento pessoal/requerimento e devolve APENAS JSON com chaves: fullName,fatherName,motherName,birthDate,birthPlace,docNumber,docIssueDate,docIssuePlace,institution,courseName,courseLevel,turma,submissionCity,submissionDate,recipientName,recipientModule,recipientCity. Se faltar, devolve string vazia.' },
        { inlineData: { mimeType: mime, data: b64 } },
      ] }],
      config: { temperature: 0.1, maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'MINIMAL' as any } },
    });

    const raw = String(result?.text ?? '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[requerimento/extract] erro', error);
    return NextResponse.json({ error: 'Falha ao extrair dados da imagem.' }, { status: 500 });
  }
}
