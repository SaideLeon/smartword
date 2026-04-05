// src/lib/tcc/context-compressor.ts
// Agente de compressão de contexto para o modo TCC.

import { createClient } from '@/lib/supabase';
import type { TccSession, TccSection, CompressionDecision, OptimisedContext } from './types';
import { geminiGenerateText } from '@/lib/gemini-resilient';

// ── Constantes de controlo ────────────────────────────────────────────────────

const COMPRESSION_THRESHOLD = 1;
const RECENT_SECTIONS_TO_KEEP = 1;

// ── Decisão de compressão ────────────────────────────────────────────────────

export function analyseCompressionNeed(
  session: TccSession,
  targetSectionIndex: number,
): CompressionDecision {
  const priorSections = session.sections.filter(
    s => s.index < targetSectionIndex && s.status !== 'pending',
  );

  const coveredUpTo = session.summary_covers_up_to ?? -1;

  const compressedSections        = priorSections.filter(s => s.index <= coveredUpTo);
  const developedButUncompressed  = priorSections.filter(s => s.index > coveredUpTo);

  const sortedUncompressed = [...developedButUncompressed].sort((a, b) => b.index - a.index);
  const recentSections     = sortedUncompressed.slice(0, RECENT_SECTIONS_TO_KEEP).reverse();
  const candidatesForCompression = sortedUncompressed.slice(RECENT_SECTIONS_TO_KEEP);

  const shouldCompress = candidatesForCompression.length >= COMPRESSION_THRESHOLD;

  return { shouldCompress, developedButUncompressed, compressedSections, recentSections };
}

// ── Construção do contexto optimizado ────────────────────────────────────────

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

async function generateCompressionSummary(
  topic: string,
  outline: string,
  sectionsToCompress: TccSection[],
  existingSummary: string | null,
): Promise<string> {
  const prompt = buildCompressionPrompt(topic, outline, sectionsToCompress, existingSummary);

  const summary = await geminiGenerateText({
    model: 'gemini-3.1-flash-lite-preview',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Gera o resumo de contexto agora.' },
    ],
    maxOutputTokens: 600,
    temperature: 0.2,
  });

  if (!summary.trim()) throw new Error('Resumo gerado está vazio');

  return summary.trim();
}

// ── Guardar resumo no Supabase ───────────────────────────────────────────────

async function saveCompressionResult(
  sessionId: string,
  summary: string,
  coversUpTo: number,
): Promise<void> {
  // Usa o cliente autenticado para que o RLS permita a operação
  const supabase = await createClient();

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

export async function compressContextIfNeeded(
  session: TccSession,
  targetSectionIndex: number,
): Promise<TccSession> {
  const decision = analyseCompressionNeed(session, targetSectionIndex);

  if (!decision.shouldCompress) return session;

  const priorSections = session.sections.filter(
    s => s.index < targetSectionIndex && s.status !== 'pending',
  );

  const coveredUpTo = session.summary_covers_up_to ?? -1;

  const sortedUncompressed = priorSections
    .filter(s => s.index > coveredUpTo)
    .sort((a, b) => a.index - b.index);

  const toCompress = sortedUncompressed.slice(0, -RECENT_SECTIONS_TO_KEEP);

  if (toCompress.length === 0) return session;

  const newCoveredUpTo = toCompress[toCompress.length - 1].index;

  const newSummary = await generateCompressionSummary(
    session.topic,
    session.outline_approved ?? '',
    toCompress,
    session.context_summary,
  );

  await saveCompressionResult(session.id, newSummary, newCoveredUpTo);

  return {
    ...session,
    context_summary:      newSummary,
    summary_covers_up_to: newCoveredUpTo,
    summary_updated_at:   new Date().toISOString(),
  };
}
