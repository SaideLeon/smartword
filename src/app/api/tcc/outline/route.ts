import { NextResponse } from 'next/server';
import { saveOutlineDraft } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const OUTLINE_SYSTEM = `És um especialista em metodologia académica e orientação de TCC (Trabalho de Conclusão de Curso).
Geras esboços estruturados, completos e academicamente sólidos em português europeu.

Ao gerar um esboço, segue SEMPRE esta estrutura em Markdown:
- Usa ## para os capítulos principais (Introdução, Revisão de Literatura, Metodologia, etc.)
- Usa ### para subsecções de cada capítulo
- Inclui uma breve descrição (1-2 frases) do que cada secção deve conter
- O esboço deve ser adequado para um TCC académico de nível universitário
- Adapta a estrutura ao tópico fornecido
- Define explicitamente que a redacção e referenciação seguem APA (7.ª edição)

Formato obrigatório de resposta:
# Esboço do TCC: [Título sugerido]

**Tópico:** [tópico]

---

## 1. Introdução
### 1.1 Contextualização
### 1.2 Problema de Pesquisa
...

Sê detalhado mas conciso em cada descrição. Não incluas texto de desenvolvimento, apenas o esboço estrutural.`;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:outline', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { sessionId, topic, suggestions } = await req.json();
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
          { role: 'system', content: OUTLINE_SYSTEM },
          { role: 'user', content: `Gera um esboço detalhado para um TCC sobre o seguinte tópico:\n\n"${topic}"${suggestionBlock}` },
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    // Acumula o texto completo para guardar no Supabase após o stream
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
        // Guarda o esboço completo no Supabase
        if (sessionId && accumulated) {
          try {
            await saveOutlineDraft(sessionId, accumulated);
          } catch (e) {
            console.error('Erro ao guardar esboço:', e);
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
