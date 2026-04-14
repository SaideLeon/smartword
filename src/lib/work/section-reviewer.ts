// src/lib/work/section-reviewer.ts
//
// ── AGENTE REVISOR DE SECÇÕES ───────────────────────────────────────────────
//
// Arquitectura de 2 passes para geração de conteúdo académico:
//
//   PASS 1 (externo, rápido): rascunho inicial ~300 palavras
//   AGENTE REVISOR:
//     1. Gera 10 perguntas específicas sobre o rascunho
//     2. Busca RAG em paralelo para cada pergunta (fontes do utilizador)
//     3. Fallback web: Gemini responde com conhecimento interno se RAG vazio
//     4. Constrói matriz de conhecimento → enrichedContext
//   PASS 2 (streaming visível): refinamento com enrichedContext como prioridade

import { geminiGenerateText } from '@/lib/gemini-resilient';
import { semanticSearch } from './rag-service';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  question: string;
  findings: string[];
  source: 'rag' | 'web';
}

export interface ReviewerResult {
  knowledgeMatrix: KnowledgeEntry[];
  enrichedContext: string;
  sourceCount: number;
  usedWeb: boolean;
  ragCount: number;
  questionCount: number;
}

// ── Geração de perguntas de revisão ──────────────────────────────────────────

async function generateReviewerQuestions(
  draft: string,
  sectionTitle: string,
  topic: string,
): Promise<string[]> {
  try {
    const result = await geminiGenerateText({
      messages: [
        {
          role: 'system',
          content:
            'Responde APENAS com as perguntas solicitadas, uma por linha, sem numeração, sem prefixos, sem explicação.',
        },
        {
          role: 'user',
          content: `Analisa este rascunho académico sobre "${topic}", secção "${sectionTitle}":

${draft.slice(0, 1600)}

Gera exactamente 10 perguntas específicas e directas cujas respostas (dados, autores, exemplos, definições) tornariam este texto academicamente mais rigoroso e fundamentado. Cada pergunta deve:
- Ser específica ao conteúdo do rascunho
- Terminar com "?"
- Apontar para lacunas concretas (definição, dado, autor, evidência)

Uma pergunta por linha, sem numeração.`,
        },
      ],
      temperature: 0.25,
      maxOutputTokens: 380,
    });

    return result
      .split('\n')
      .map(q => q.replace(/^\d+[.)]\s*[-•]?\s*/, '').trim())
      .filter(q => q.length > 15 && q.includes('?'))
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ── Busca RAG por pergunta ────────────────────────────────────────────────────

async function searchRagForQuestion(
  question: string,
  sessionId: string,
): Promise<string[]> {
  try {
    const chunks = await semanticSearch(sessionId, question, 4);
    return chunks
      .filter(c => c.score > 0.42)
      .map(c => c.chunk_text.slice(0, 480))
      .slice(0, 2);
  } catch {
    return [];
  }
}

// ── Pesquisa web automática (Gemini como fallback) ────────────────────────────
// Quando não há fontes RAG, o modelo responde com conhecimento académico
// estruturado — declarado claramente como "pesquisa automática" na UI.

async function searchWebFallback(
  question: string,
  topic: string,
  researchBrief: string | null,
): Promise<string> {
  try {
    const briefContext = researchBrief
      ? `\n\nFicha de pesquisa do tema:\n${researchBrief.slice(0, 600)}`
      : '';

    const result = await geminiGenerateText({
      messages: [
        {
          role: 'system',
          content:
            'Responde de forma concisa, factual e académica em português europeu. Inclui autores, datas e dados verificáveis quando disponíveis. Sê específico.',
        },
        {
          role: 'user',
          content: `Tema académico: "${topic}"${briefContext}

Pergunta: ${question}

Responde em máximo 110 palavras com dados concretos. Indica autor e ano sempre que possível (formato APA).`,
        },
      ],
      temperature: 0.1,
      maxOutputTokens: 190,
    });

    return result.trim();
  } catch {
    return '';
  }
}

// ── Construção da matriz de conhecimento ──────────────────────────────────────
// RAG em paralelo (sem rate limit entre sessões); web sequencial (conservador).

async function buildKnowledgeMatrix(
  questions: string[],
  sessionId: string,
  ragEnabled: boolean,
  topic: string,
  researchBrief: string | null,
): Promise<{ matrix: KnowledgeEntry[]; usedWeb: boolean; ragCount: number }> {
  const matrix: KnowledgeEntry[] = [];
  let usedWeb = false;
  let ragCount = 0;

  // ── Busca RAG em paralelo ─────────────────────────────────────────────────
  const ragResults: string[][] = ragEnabled
    ? await Promise.all(questions.map(q => searchRagForQuestion(q, sessionId)))
    : questions.map(() => []);

  // ── Processa resultados + fallback web onde RAG vazio ─────────────────────
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]!;
    const ragFindings = ragResults[i] ?? [];

    if (ragFindings.length > 0) {
      matrix.push({ question, findings: ragFindings, source: 'rag' });
      ragCount += ragFindings.length;
      continue;
    }

    // Fallback: pesquisa automática via Gemini
    const webResult = await searchWebFallback(question, topic, researchBrief);
    if (webResult) {
      matrix.push({ question, findings: [webResult], source: 'web' });
      usedWeb = true;
    }
  }

  return { matrix, usedWeb, ragCount };
}

// ── Formatação do contexto enriquecido ────────────────────────────────────────

function buildEnrichedContext(matrix: KnowledgeEntry[]): string {
  if (matrix.length === 0) return '';

  const ragEntries = matrix.filter(e => e.source === 'rag');
  const webEntries = matrix.filter(e => e.source === 'web');

  const formatEntries = (entries: KnowledgeEntry[]) =>
    entries
      .map(
        e =>
          `↦ ${e.question}\n${e.findings.map(f => `   • ${f}`).join('\n')}`,
      )
      .join('\n\n');

  const ragBlock =
    ragEntries.length > 0
      ? `\n━━ ACHADOS DAS FONTES DO UTILIZADOR (PRIORIDADE MÁXIMA) ━━\n${formatEntries(ragEntries)}`
      : '';

  const webBlock =
    webEntries.length > 0
      ? `\n━━ ACHADOS DE PESQUISA AUTOMÁTICA (USE SE RELEVANTE) ━━\n${formatEntries(webEntries)}`
      : '';

  return `[BASE DE CONHECIMENTO RECUPERADA PELO AGENTE REVISOR]
${ragBlock}${webBlock}

INSTRUÇÃO DE INTEGRAÇÃO (OBRIGATÓRIA):
- Os achados acima têm PRIORIDADE sobre o teu conhecimento de treino.
- Integra os dados, autores e conceitos encontrados de forma natural no texto.
- Usa citações APA 7.ª edição para todos os achados que referenciem autores.
- NÃO reproduzas os achados literalmente — reformula e contextualiza academicamente.
- Se um achado contradisser algo no rascunho, prevalece o achado.`;
}

// ── API pública: agente revisor ───────────────────────────────────────────────

export async function runSectionReviewer(params: {
  draft: string;
  sectionTitle: string;
  topic: string;
  sessionId: string;
  ragEnabled: boolean;
  researchBrief?: string | null;
}): Promise<ReviewerResult> {
  const { draft, sectionTitle, topic, sessionId, ragEnabled, researchBrief = null } = params;

  const EMPTY: ReviewerResult = {
    knowledgeMatrix: [],
    enrichedContext: '',
    sourceCount: 0,
    usedWeb: false,
    ragCount: 0,
    questionCount: 0,
  };

  // Secções muito curtas ou sem conteúdo real não precisam de revisão
  if (draft.trim().length < 80) return EMPTY;

  // Passo 1 — Gerar perguntas de revisão
  const questions = await generateReviewerQuestions(draft, sectionTitle, topic);
  if (questions.length === 0) return EMPTY;

  // Passo 2 — Construir matriz de conhecimento
  const { matrix, usedWeb, ragCount } = await buildKnowledgeMatrix(
    questions,
    sessionId,
    ragEnabled,
    topic,
    researchBrief,
  );

  if (matrix.length === 0) {
    return { ...EMPTY, questionCount: questions.length };
  }

  // Passo 3 — Formatar contexto enriquecido
  const enrichedContext = buildEnrichedContext(matrix);
  const sourceCount = matrix.reduce((s, e) => s + e.findings.length, 0);

  return {
    knowledgeMatrix: matrix,
    enrichedContext,
    sourceCount,
    usedWeb,
    ragCount,
    questionCount: questions.length,
  };
}
