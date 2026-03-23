// app/api/tcc/develop/route.ts  (versão actualizada — substitui o original)
// Integra compressão de contexto automática antes de desenvolver cada secção.

import { NextResponse } from 'next/server';
import { getSession, saveSectionContent } from '@/lib/tcc/service';
import { compressContextIfNeeded, buildOptimisedContext } from '@/lib/tcc/context-compressor';
import type { TccSection } from '@/lib/tcc/types';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// ── System prompt com contexto optimizado ────────────────────────────────────

function buildSystemPrompt(
  topic:          string,
  outline:        string,
  contextSummary: string | null,
  recentSectionsContent: string,
  currentSection: TccSection,
  compressionActive: boolean,
): string {

  // Bloco de contexto histórico: resumo comprimido OU secções completas
  const historicalContext = compressionActive && contextSummary
    ? `CONTEXTO DAS SECÇÕES ANTERIORES (síntese comprimida — mantém coerência com estes pontos):
${contextSummary}`
    : '';

  // Secções recentes completas (sempre presentes se existirem)
  const recentContext = recentSectionsContent
    ? `SECÇÕES IMEDIATAMENTE ANTERIORES (completas — para continuidade directa):
${recentSectionsContent}`
    : '';

  // Indicador de estado para o modelo
  const contextNote = compressionActive
    ? `[NOTA: As secções mais antigas foram comprimidas num resumo de contexto para optimizar a janela de tokens. As ${recentSectionsContent ? '2 secções' : '0 secções'} mais recentes estão completas acima.]`
    : '';

  return `És um especialista académico a desenvolver um TCC sobre: "${topic}".

ESBOÇO APROVADO (âncora estrutural — segue esta estrutura):
${outline}

${historicalContext}

${recentContext}

${contextNote}

A TUA TAREFA AGORA:
Desenvolve APENAS a secção: "${currentSection.title}"

REGRAS ABSOLUTAS:
- Escreve APENAS o desenvolvimento da secção, sem qualquer introdução do tipo "Nesta secção..." ou "A seguir..."
- Sem preâmbulos, sem meta-comentários, sem conclusões sobre o que vem a seguir
- Texto académico puro, em português europeu, pronto para inserir directamente num TCC
- Mantém coerência terminológica com o contexto fornecido acima
- Usa Markdown para formatação (negrito, listas quando necessário, sub-títulos com ###)
- Extensão adequada ao nível académico: entre 300 e 600 palavras por secção
- Não repitas conteúdo já mencionado no contexto histórico ou nas secções recentes`.trim();
}

// ── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { sessionId, sectionIndex } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
    }

    // 1. Carregar sessão
    let session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }
    if (!session.outline_approved) {
      return NextResponse.json({ error: 'Esboço ainda não aprovado' }, { status: 400 });
    }

    const currentSection = session.sections.find(s => s.index === sectionIndex);
    if (!currentSection) {
      return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });
    }

    // 2. Comprimir contexto se necessário (automático, transparente para o utilizador)
    session = await compressContextIfNeeded(session, sectionIndex);

    // 3. Construir contexto optimizado para enviar à IA
    const optimised = buildOptimisedContext(session, sectionIndex);

    // 4. Construir system prompt com contexto optimizado
    const systemPrompt = buildSystemPrompt(
      session.topic,
      optimised.outline,
      optimised.contextSummary,
      optimised.recentSectionsContent,
      currentSection,
      optimised.compressionActive,
    );

    // 5. Chamar a IA em streaming
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

    // 6. Stream com acumulação para guardar no Supabase no final
    let accumulated = '';
    const compressionWasActive = optimised.compressionActive;

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

    // Adiciona header a indicar se compressão foi usada (útil para debug/UI)
    return new NextResponse(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type':           'text/event-stream',
        'Cache-Control':          'no-cache',
        'Connection':             'keep-alive',
        'X-Context-Compressed':   compressionWasActive ? 'true' : 'false',
        'X-Summary-Covers-Up-To': String(session.summary_covers_up_to ?? -1),
      },
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
