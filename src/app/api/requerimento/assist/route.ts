import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { geminiGenerateText } from '@/lib/gemini-resilient';
import { PROMPT_INJECTION_GUARD, wrapUserInput } from '@/lib/prompt-sanitizer';

const MAX_INPUT_CHARS = 1200;
function safeString(v: unknown, max = 2400): string { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

function normalizeRequestPurpose(value: string): string {
  const cleaned = value.trim().replace(/^[\-–—:\s]+/, '');
  return cleaned
    .replace(/^solicita(?:ç|c)ão\s+de\s+/i, '')
    .replace(/^pedido\s+de\s+/i, '')
    .replace(/^requerimento\s+de\s+/i, '')
    .replace(/^solicitar\s+/i, '')
    .trim();
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'requerimento:assist', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
    if (!brief || brief.length > MAX_INPUT_CHARS) return NextResponse.json({ error: 'Descrição inválida ou demasiado longa.' }, { status: 400 });

    const raw = await geminiGenerateText({ temperature: 0.3, maxOutputTokens: 900, messages: [
      { role: 'system', content: `${PROMPT_INJECTION_GUARD}
És um redactor formal de requerimentos académicos em português de Moçambique.
Responde APENAS em JSON válido no formato: requestPurpose, section1Title, section1Content, section2Title, section2Content, section3Title, section3Content.

REGRAS CRÍTICAS DE CONTEÚDO:
1) A secção "Identificação do Projecto" NÃO é para justificar o requerimento, nem para explicar para que serve o pedido.
2) "Identificação do Projecto" deve ser uma apresentação breve e objectiva do projecto a aprovar: nome do projecto, natureza, objectivo geral e estado de desenvolvimento.
3) Evita frases como "o presente requerimento visa..." dentro de section1Content.
4) A justificativa/viabilidade, quando existir, vai na secção 2.
5) Se não fizer sentido incluir secção, devolve título e conteúdo vazios.
6) Em requestPurpose, devolve APENAS o complemento directo após "venho solicitar ..." sem prefixos como "Solicitação de", "Pedido de" ou frase nominal autónoma.

EXEMPLO CORRECTO para section1Content (estilo):
"O projecto proposto denomina-se Muneri, uma plataforma digital de geração de documentos académicos com recurso a Inteligência Artificial. A plataforma encontra-se em desenvolvimento activo pelo formando e visa facilitar a elaboração de trabalhos escolares com maior rapidez e organização."

EXEMPLO INCORRECTO para section1Content:
"O presente requerimento visa submeter à apreciação superior..."` },
      { role: 'user', content: `Descrição breve:\n${wrapUserInput('user_brief', brief)}` },
    ] });

    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
    return NextResponse.json({
      requestPurpose: normalizeRequestPurpose(safeString(parsed.requestPurpose, 5000)),
      section1Title: safeString(parsed.section1Title),
      section1Content: safeString(parsed.section1Content, 5000),
      section2Title: safeString(parsed.section2Title),
      section2Content: safeString(parsed.section2Content, 5000),
      section3Title: safeString(parsed.section3Title),
      section3Content: safeString(parsed.section3Content, 5000),
    });
  } catch (error) {
    console.error('[requerimento/assist] erro', error);
    return NextResponse.json({ error: 'Falha ao gerar sugestão automática.' }, { status: 500 });
  }
}
