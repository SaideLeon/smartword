// lib/tcc/context-compressor.ts
// Agente de compressão de contexto para o modo TCC.
// Responsável por: decidir quando comprimir, gerar o resumo via IA, e guardar no Supabase.

import { supabase } from '@/lib/supabase';
import type { TccSession, TccSection, CompressionDecision, OptimisedContext } from './types';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// ── Constantes de controlo ────────────────────────────────────────────────────

/**
 * Número mínimo de secções desenvolvidas (não ainda no resumo) para activar compressão.
 * Valor 3: significa que quando existem 3+ secções completas fora do resumo, comprime.
 */
const COMPRESSION_THRESHOLD = 3;

/**
 * Número de secções recentes a manter sempre completas (nunca comprimidas).
 * As N secções mais recentes antes da actual são enviadas sem compressão.
 */
const RECENT_SECTIONS_TO_KEEP = 2;

// ── Decisão de compressão ────────────────────────────────────────────────────

/**
 * Analisa a sessão e decide se é necessário comprimir o contexto.
 * Retorna informação detalhada sobre o que está comprimido e o que está completo.
 */
export function analyseCompressionNeed(
  session: TccSession,
  targetSectionIndex: number,
): CompressionDecision {
  // Secções anteriores à que vamos desenvolver
  const priorSections = session.sections.filter(
    s => s.index < targetSectionIndex && s.status !== 'pending',
  );

  // Índice coberto pelo resumo actual (ou -1 se não houver resumo)
  const coveredUpTo = session.summary_covers_up_to ?? -1;

  // Secções já no resumo (não precisam de ser enviadas completas)
  const compressedSections = priorSections.filter(s => s.index <= coveredUpTo);

  // Secções desenvolvidas mas ainda não no resumo
  const developedButUncompressed = priorSections.filter(s => s.index > coveredUpTo);

  // Das não comprimidas, manter as N mais recentes sempre completas
  const sortedUncompressed = [...developedButUncompressed].sort((a, b) => b.index - a.index);
  const recentSections = sortedUncompressed.slice(0, RECENT_SECTIONS_TO_KEEP).reverse();

  // Candidatas a compressão: as que não são "recentes"
  const candidatesForCompression = sortedUncompressed.slice(RECENT_SECTIONS_TO_KEEP);

  const shouldCompress = candidatesForCompression.length >= COMPRESSION_THRESHOLD;

  return {
    shouldCompress,
    developedButUncompressed,
    compressedSections,
    recentSections,
  };
}

// ── Construção do contexto optimizado ────────────────────────────────────────

/**
 * Constrói o contexto optimizado para enviar à IA.
 * Combina: esboço + resumo comprimido (se existir) + secções recentes completas.
 */
export function buildOptimisedContext(
  session: TccSession,
  targetSectionIndex: number,
): OptimisedContext {
  const { recentSections, compressedSections } = analyseCompressionNeed(
    session,
    targetSectionIndex,
  );

  const compressionActive =
    session.context_summary !== null && compressedSections.length > 0;

  // Formata as secções recentes completas
  const recentSectionsContent = recentSections
    .filter(s => s.content)
    .map(s => `### ${s.title}\n${s.content}`)
    .join('\n\n');

  return {
    outline: session.outline_approved ?? '',
    contextSummary: session.context_summary,
    recentSectionsContent,
    compressionActive,
  };
}

// ── Prompt do agente de compressão ───────────────────────────────────────────

function buildCompressionPrompt(
  topic: string,
  outline: string,
  sectionsToCompress: TccSection[],
  existingSummary: string | null,
): string {
  const sectionsText = sectionsToCompress
    .map(s => `### ${s.title}\n${s.content}`)
    .join('\n\n---\n\n');

  const existingContext = existingSummary
    ? `\nRESUMO ANTERIOR (expandir e actualizar, não substituir):\n${existingSummary}\n`
    : '';

  return `És um agente de síntese académica especializado em TCCs.

TÓPICO DO TCC: "${topic}"

ESBOÇO ESTRUTURAL (âncora — nunca alterar):
${outline}
${existingContext}
SECÇÕES A COMPRIMIR:
${sectionsText}

A TUA TAREFA:
Gera um RESUMO DE CONTEXTO académico das secções acima. Este resumo será usado pela IA para manter coerência ao escrever as próximas secções.

O resumo deve conter:
1. **Argumentos centrais** já desenvolvidos (1-2 frases por secção)
2. **Terminologia específica** usada (lista compacta dos termos técnicos e definições adoptadas)
3. **Posicionamentos teóricos** assumidos (autores citados, correntes teóricas seguidas)
4. **Conclusões parciais** que influenciam o restante do trabalho
5. **Fios temáticos** a manter nas próximas secções

REGRAS ABSOLUTAS:
- Máximo 400 palavras no total
- Não reproduzires parágrafos inteiros — apenas síntese densa
- Formato: Markdown compacto com sub-títulos curtos
- Escreves em português europeu
- O objectivo é preservar coerência, não reproduzir conteúdo`;
}

// ── Geração do resumo via IA ─────────────────────────────────────────────────

/**
 * Chama a IA para gerar o resumo comprimido das secções.
 * Usa o mesmo modelo e API que o resto do sistema.
 */
async function generateCompressionSummary(
  topic: string,
  outline: string,
  sectionsToCompress: TccSection[],
  existingSummary: string | null,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada');

  const prompt = buildCompressionPrompt(topic, outline, sectionsToCompress, existingSummary);

  const response = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Gera o resumo de contexto agora.' },
      ],
      stream: false,        // compressão não precisa de streaming
      max_tokens: 600,      // limite apertado — queremos síntese densa
      temperature: 0.2,     // baixa temperatura para consistência
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro na API de compressão: ${err}`);
  }

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content ?? '';

  if (!summary.trim()) throw new Error('Resumo gerado está vazio');

  return summary.trim();
}

// ── Guardar resumo no Supabase ───────────────────────────────────────────────

async function saveCompressionResult(
  sessionId: string,
  summary: string,
  coversUpTo: number,
): Promise<void> {
  const { error } = await supabase
    .from('tcc_sessions')
    .update({
      context_summary:      summary,
      summary_covers_up_to: coversUpTo,
      summary_updated_at:   new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw new Error(`Erro ao guardar resumo: ${error.message}`);
}

// ── Função principal: comprimir se necessário ────────────────────────────────

/**
 * Ponto de entrada principal.
 * Verifica se é necessário comprimir, e se sim, gera e guarda o resumo.
 * Retorna a sessão actualizada (com o novo resumo, se gerado).
 */
export async function compressContextIfNeeded(
  session: TccSession,
  targetSectionIndex: number,
): Promise<TccSession> {
  const decision = analyseCompressionNeed(session, targetSectionIndex);

  if (!decision.shouldCompress) {
    // Sem necessidade de compressão — devolve a sessão inalterada
    return session;
  }

  // Determina quais secções comprimir nesta ronda
  // (tudo o que está desenvolvido, excepto as N secções mais recentes)
  const priorSections = session.sections.filter(
    s => s.index < targetSectionIndex && s.status !== 'pending',
  );

  const coveredUpTo = session.summary_covers_up_to ?? -1;

  // Ordenadas por índice, as não recentes e ainda não comprimidas
  const sortedUncompressed = priorSections
    .filter(s => s.index > coveredUpTo)
    .sort((a, b) => a.index - b.index);

  // Comprime tudo excepto as RECENT_SECTIONS_TO_KEEP mais recentes
  const toCompress = sortedUncompressed.slice(0, -RECENT_SECTIONS_TO_KEEP);

  if (toCompress.length === 0) return session;

  const newCoveredUpTo = toCompress[toCompress.length - 1].index;

  // Gera o novo resumo (acumula com o anterior se existir)
  const newSummary = await generateCompressionSummary(
    session.topic,
    session.outline_approved ?? '',
    toCompress,
    session.context_summary,
  );

  // Persiste no Supabase
  await saveCompressionResult(session.id, newSummary, newCoveredUpTo);

  // Devolve sessão actualizada localmente para uso imediato
  return {
    ...session,
    context_summary:      newSummary,
    summary_covers_up_to: newCoveredUpTo,
    summary_updated_at:   new Date().toISOString(),
  };
}
