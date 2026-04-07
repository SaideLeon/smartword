import { NextResponse } from 'next/server';
import { saveOutlineDraft } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseOutlinePayload } from '@/lib/validation/input-guards';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';
import { requireAuth } from '@/lib/api-auth';

const OUTLINE_SYSTEM = `${PROMPT_INJECTION_GUARD}

És um especialista em metodologia académica e orientação de TCC (Trabalho de Conclusão de Curso).
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
  const limited = await enforceRateLimit(req, { scope: 'tcc:outline', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const parsedPayload = parseOutlinePayload(await req.json());
    if (!parsedPayload) {
      return NextResponse.json({ error: 'Payload inválido ou demasiado longo' }, { status: 400 });
    }

    const { sessionId, topic, suggestions } = parsedPayload;
    const suggestionBlock = suggestions
      ? `\n\nSugestões de ajuste dadas pelo utilizador para esta nova versão do esboço:\n${wrapUserInput('user_suggestions', suggestions)}\n\nAplica estas sugestões com prioridade e regenera o esboço completo.`
      : '';

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: OUTLINE_SYSTEM },
        { role: 'user', content: `Gera um esboço detalhado para um TCC sobre o seguinte tópico:\n\n${wrapUserInput('user_topic', topic)}${suggestionBlock}` },
      ],
      maxOutputTokens: 2048,
      temperature: 0.4,
    });

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

    return new NextResponse(stream.pipeThrough(transformStream), {
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
