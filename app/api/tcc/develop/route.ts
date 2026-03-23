import { NextResponse } from 'next/server';
import { getSession, saveSectionContent } from '@/lib/tcc/service';
import type { TccSection } from '@/lib/tcc/types';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

function buildSystemPrompt(
  outline: string,
  previousSections: TccSection[],
  currentSection: TccSection,
  topic: string,
): string {
  const prevContext = previousSections
    .filter(s => s.content)
    .map(s => `### ${s.title}\n${s.content}`)
    .join('\n\n');

  return `És um especialista académico a desenvolver um TCC sobre: "${topic}".

ESBOÇO APROVADO (âncora estrutural — segue esta estrutura):
${outline}

${prevContext ? `SECÇÕES JÁ DESENVOLVIDAS (mantém coerência e evita repetições):\n${prevContext}\n` : ''}

A TUA TAREFA AGORA:
Desenvolve APENAS a secção: "${currentSection.title}"

REGRAS ABSOLUTAS:
- Escreve APENAS o desenvolvimento da secção, sem qualquer introdução do tipo "Nesta secção..." ou "A seguir..."
- Sem preâmbulos, sem meta-comentários, sem conclusões sobre o que vem a seguir
- Texto académico puro, em português europeu, pronto para inserir directamente num TCC
- Mantém coerência terminológica com as secções anteriores
- Usa Markdown para formatação (negrito, listas quando necessário, sub-títulos com ###)
- Extensão adequada ao nível académico: entre 300 e 600 palavras por secção
- Não repitas conteúdo já desenvolvido nas secções anteriores`;
}

export async function POST(req: Request) {
  try {
    const { sessionId, sectionIndex } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    if (!session.outline_approved) return NextResponse.json({ error: 'Esboço ainda não aprovado' }, { status: 400 });

    const currentSection = session.sections.find(s => s.index === sectionIndex);
    if (!currentSection) return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });

    const previousSections = session.sections.filter(s => s.index < sectionIndex);

    const systemPrompt = buildSystemPrompt(
      session.outline_approved,
      previousSections,
      currentSection,
      session.topic,
    );

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Desenvolve a secção "${currentSection.title}" do TCC.` },
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    let accumulated = '';

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) accumulated += delta;
          } catch { /* ignorar */ }
        }

        controller.enqueue(chunk);
      },
      async flush() {
        if (sessionId && accumulated) {
          try {
            await saveSectionContent(sessionId, sectionIndex, accumulated, session.sections);
          } catch (e) {
            console.error('Erro ao guardar secção:', e);
          }
        }
      },
    });

    return new NextResponse(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
