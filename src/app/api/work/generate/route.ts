import { NextResponse } from 'next/server';
import { saveWorkOutlineDraft } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM = `És um especialista em metodologia académica do ensino secundário e médio em Moçambique.
Vais gerar um esboço orientador para um trabalho escolar sobre o tópico fornecido.

O trabalho tem SEMPRE estas secções fixas (não adicionares nem removeres nenhuma), na sessão "3. Desenvolvimento Teórico" deve haver titulos do tema(exemplo: 3.1 Conceito de correio eletronico, 3.2 Historia de correio eletronico), a estrutura principal é essa:
1. Introdução
2. Objectivos e Metodologia
3. Desenvolvimento Teórico
4. Conclusão
5. Referências Bibliográficas

Para cada secção, descreve em 2-4 frases o que o aluno deve abordar nessa secção, tendo em conta o tópico específico.
Usa Markdown: ## para o título de cada secção, texto corrido para a descrição.
NÃO incluas "Índice" em nenhuma posição do esboço, pois o índice é gerado automaticamente no Microsoft Word.
Norma de redacção obrigatória para todo o trabalho: APA (7.ª edição).
Escreve em português europeu/moçambicano. Sê concreto e útil — o esboço serve de guia para o desenvolvimento posterior.`;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'work:generate', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { topic, sessionId, suggestions } = await req.json();
    const cleanedSuggestions = typeof suggestions === 'string' ? suggestions.trim() : '';
    const suggestionBlock = cleanedSuggestions
      ? `\n\nSugestões de ajuste dadas pelo utilizador para esta nova versão do esboço:\n${cleanedSuggestions}\n\nAplica estas sugestões com prioridade e regenera o esboço completo.`
      : '';

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Gera o esboço orientador para um trabalho escolar sobre: "${topic}"${suggestionBlock}` },
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.4,
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
            await saveWorkOutlineDraft(sessionId, accumulated);
          } catch (e) {
            console.error('Erro ao guardar esboço do trabalho:', e);
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
