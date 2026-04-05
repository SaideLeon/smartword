import { geminiGenerateText } from '@/lib/gemini-resilient';
import { buildContextInstruction, type ContextType } from '@/lib/tcc/context-detector';

export interface ResearchBrief {
  keywords: string[];
  brief: string;
}

type BriefMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type BriefRequest = {
  messages: BriefMessage[];
  temperature?: number;
  max_tokens?: number;
  model?: string;
};

function buildHeuristicBrief(topic: string, outline: string): ResearchBrief {
  const headings = outline
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => /^##\s+/.test(line) || /^###\s+/.test(line))
    .map(line => line.replace(/^###?\s+/, ''))
    .slice(0, 12);

  const keywords = Array.from(new Set([
    topic,
    ...headings.map(h => h.replace(/^\d+(\.\d+)?\.?\s*/, '').trim()),
  ])).filter(Boolean).slice(0, 10);

  const sectionGuidance = headings.length
    ? headings.map(h => `- ${h}: relacionar conceitos centrais do tema e exemplos aplicados.`).join('\n')
    : '- Introdução: contextualizar o tema e o problema.\n- Desenvolvimento: fundamentar conceitos com fontes credíveis.\n- Conclusão: sintetizar resultados e limites.';

  const brief = `## PALAVRAS-CHAVE
${keywords.map(k => `- ${k}`).join('\n')}

## FICHA TÉCNICA DE PESQUISA
- Tema delimitado: ${topic}
- Critérios de relevância: priorizar fontes académicas, institucionais e dados recentes.
- Principais achados: consolidar definições, contexto histórico e evidências empíricas verificáveis.
- Fontes recomendadas: livros didácticos, artigos científicos, relatórios institucionais e legislação aplicável.
- Limites e lacunas: assinalar ausência de dados locais ou divergência entre autores.

## DIRETRIZ DE USO
Reutilizar esta ficha em todas as secções, evitando repetição e mantendo coerência com o esboço.

## CONCEITOS OBRIGATÓRIOS POR SECÇÃO
${sectionGuidance}`;

  return { keywords, brief };
}

async function requestBrief(body: BriefRequest): Promise<any> {
  const text = await geminiGenerateText({
    model: body.model ?? 'gemini-3.1-flash-lite-preview',
    messages: body.messages,
    temperature: body.temperature ?? 0.2,
    maxOutputTokens: body.max_tokens ?? 900,
  });
  return { choices: [{ message: { content: text } }] };
}

function isRequestTooLargeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('413') ||
    message.toLowerCase().includes('request entity too large') ||
    message.toLowerCase().includes('request_too_large')
  );
}

function compactOutline(outline: string, maxChars: number): string {
  if (outline.length <= maxChars) return outline;

  const lines = outline
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => /^#{1,4}\s+/.test(line) || /^\d+[.)]\s+/.test(line));

  const compact = lines.join('\n');
  if (compact.length <= maxChars) return compact;

  return compact.slice(0, maxChars);
}

function parseKeywords(text: string): string[] {
  const keywordSection = text.match(/PALAVRAS-CHAVE(?:\s*\(.*?\))?:([\s\S]*?)(?:\n\n|\n##|$)/i)?.[1] ?? '';
  const candidates = keywordSection
    .split(/\n|,|;/)
    .map(item => item.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);

  return Array.from(new Set(candidates)).slice(0, 12);
}

export async function generateResearchBrief(
  topic: string,
  outline: string,
  contextType: ContextType = 'comparative',
): Promise<ResearchBrief> {
  const contextInstruction = buildContextInstruction(contextType);
  const basePrompt = (outlineExcerpt: string) => `Atua como um agente de pesquisa académica.
TEMA: "${topic}"
${contextInstruction}

ESBOÇO APROVADO:
${outlineExcerpt}

Tarefa obrigatória em 3 passos:
1) Seleciona palavras-chave de alta relevância para pesquisa web.
2) Usa pesquisa web UMA ÚNICA VEZ para recolher fontes e dados recentes relevantes.
3) Entrega uma FICHA TÉCNICA reutilizável em todas as secções.

Formato de resposta obrigatório (Markdown):
## PALAVRAS-CHAVE
- palavra 1
- palavra 2
(...)

## FICHA TÉCNICA DE PESQUISA
- Tema delimitado
- Critérios de relevância
- Principais achados com dados/contexto verificável
- Definições-chave (conceitos e termos técnicos)
- Autores/obras de referência (autor + contribuição)
- Fontes recomendadas (nome + link)
- Conceitos obrigatórios por secção do esboço
- Limites e lacunas

## REFERÊNCIAS BIBLIOGRÁFICAS SUGERIDAS
- [Autor, ano] Título — link directo

## DIRETRIZ DE USO
Explique como usar esta ficha técnica para manter relevância e coerência no desenvolvimento de cada secção sem nova pesquisa web.

Regras críticas:
- Não inventar factos, dados, autores ou publicações.
- Só incluir afirmações apoiadas em fonte explícita.
- Sempre que possível, indicar data da fonte e contexto temporal dos dados.
- Se houver lacunas ou conflito entre fontes, declarar explicitamente.`;

  // ── Geração via Gemini (sem Groq/tools) ───────────────────────────────────
  const fallbackOutlineBudgets = [1_500, 900, 600];
  for (let i = 0; i < fallbackOutlineBudgets.length; i++) {
    const outlineForPrompt = compactOutline(outline, fallbackOutlineBudgets[i]);
    const plainFallbackBody: BriefRequest = {
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        {
          role: 'system',
          content: 'És um investigador académico rigoroso. Produz resposta em português europeu.',
        },
        { role: 'user', content: basePrompt(outlineForPrompt) },
      ],
      temperature: 0.2,
      max_tokens: i === 0 ? 900 : 700,
    };

    try {
      const payload = await requestBrief(plainFallbackBody);
      const brief = payload.choices?.[0]?.message?.content?.trim();
      if (!brief) throw new Error('Resposta vazia no fallback sem tools');
      const keywords = parseKeywords(brief);
      return { keywords, brief };
    } catch (fallbackError) {
      if (isRequestTooLargeError(fallbackError) && i < fallbackOutlineBudgets.length - 1) {
        console.warn('[research] 413 no fallback sem tools; a reduzir prompt e tentar novamente.', {
          attempt: i + 1,
          nextOutlineBudget: fallbackOutlineBudgets[i + 1],
        });
        continue;
      }
      console.warn('[research] Falha no Gemini; a usar ficha heurística local.', fallbackError);
      break;
    }
  }

  // ── Fallback final: ficha heurística local (sem chamadas externas) ─────────
  return buildHeuristicBrief(topic, outline);
}
