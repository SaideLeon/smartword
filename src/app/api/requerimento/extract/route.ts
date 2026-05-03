import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function toSmartTitleCase(input: string): string {
  return input
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word ? word[0].toLocaleUpperCase('pt-PT') + word.slice(1) : word)
    .join(' ');
}

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
    const front = form.get('frontImage');
    const back = form.get('backImage');
    if (!(front instanceof File) || !(back instanceof File)) return NextResponse.json({ error: 'Envie frente e verso.' }, { status: 400 });

    const frontMime = front.type.split(';')[0].trim().toLowerCase();
    const backMime = back.type.split(';')[0].trim().toLowerCase();
    if (!ALLOWED.has(frontMime) || !ALLOWED.has(backMime)) return NextResponse.json({ error: 'Use PNG ou JPG em ambas imagens.' }, { status: 400 });
    if (front.size > MAX_IMAGE_BYTES || back.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Imagem demasiado grande (máx 6MB por ficheiro).' }, { status: 400 });

    const apiKey = collectGeminiKey();
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });

    const frontB64 = Buffer.from(new Uint8Array(await front.arrayBuffer())).toString('base64');
    const backB64 = Buffer.from(new Uint8Array(await back.arrayBuffer())).toString('base64');
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [
        { text: `As duas imagens são frente e verso do documento. Extrai os dados de identidade/académicos e devolve APENAS JSON com chaves: fullName,fatherName,motherName,birthDate,birthPlace,docNumber,docIssueDate,docIssuePlace,institution,courseName,courseLevel,turma,submissionCity,submissionDate,recipientName,recipientModule,recipientCity. Se faltar, devolve string vazia.
IMPORTANTE: para campos pessoais textuais (nome, nomes dos pais, naturalidade e local de emissão), devolve em capitalização normal: primeira letra maiúscula e restantes minúsculas, nunca tudo em maiúsculas.` },
        { inlineData: { mimeType: frontMime, data: frontB64 } },
        { inlineData: { mimeType: backMime, data: backB64 } },
      ] }],
      config: { temperature: 0.1, maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'MINIMAL' as any } },
    });

    const raw = String(result?.text ?? '').replace(/```json|```/g, '').trim();
    const jsonSlice = raw.match(/\{[\s\S]*\}/)?.[0] ?? '';
    if (!jsonSlice) {
      return NextResponse.json({ error: 'A IA não devolveu JSON válido.', raw: raw.slice(0, 400) }, { status: 422 });
    }
    const parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
    const keys = ['fullName','fatherName','motherName','birthDate','birthPlace','docNumber','docIssueDate','docIssuePlace','institution','courseName','courseLevel','turma','submissionCity','submissionDate','recipientName','recipientModule','recipientCity','recipientTitle','city','courseHeader'];
    const clean: Record<string, string> = {};
    const personalCaseFields = new Set(['fullName','fatherName','motherName','birthPlace','docIssuePlace','recipientName','recipientCity']);
    for (const k of keys) {
      const rawValue = typeof parsed[k] === 'string' ? parsed[k].trim().slice(0, 500) : '';
      clean[k] = personalCaseFields.has(k) ? toSmartTitleCase(rawValue) : rawValue;
    }
    return NextResponse.json(clean);
  } catch (error) {
    console.error('[requerimento/extract] erro', error);
    return NextResponse.json({ error: 'Falha ao extrair dados da imagem.' }, { status: 500 });
  }
}
