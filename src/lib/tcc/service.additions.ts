// lib/tcc/service.additions.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// ATENÇÃO: Este ficheiro NÃO é autónomo.
// Contém APENAS as adições a fazer no teu ficheiro existente:
//   src/lib/tcc/service.ts
//
// Copia cada bloco para o sítio correcto no service.ts existente.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextType } from '@/lib/tcc/context-detector';

// ── 1. Adicionar ao bloco de imports existente no service.ts ─────────────────
//
// import type { ContextType } from '@/lib/tcc/context-detector';


// ── 2. Nova função — guardar o context_type na sessão ────────────────────────
// Adiciona esta função ao service.ts, junto das outras funções de update.

export async function saveContextType(
  sessionId: string,
  contextType: ContextType,
): Promise<void> {
  const { error } = await supabase
    .from('tcc_sessions')
    .update({ context_type: contextType })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Erro ao guardar context_type: ${error.message}`);
  }
}


// ── 3. Actualizar o tipo TccSession em lib/tcc/types.ts ─────────────────────
// Adiciona o campo opcional ao tipo existente:
//
// export type TccSession = {
//   ...campos existentes...
//   context_type?: ContextType;   // ← adicionar esta linha
// };


// ── 4. Actualizar generateResearchBrief em lib/research/brief.ts ─────────────
// A função precisa de aceitar o contextType para usar fontes adequadas.
// Altera a assinatura de:
//
//   export async function generateResearchBrief(topic: string, outline: string)
//
// Para:
//
//   export async function generateResearchBrief(
//     topic: string,
//     outline: string,
//     contextType: ContextType = 'comparative',
//   )
//
// E no system prompt do brief, adiciona no início:
//
//   import { buildContextInstruction } from '@/lib/tcc/context-detector';
//   ...
//   const contextInstruction = buildContextInstruction(contextType);
//   // injecta contextInstruction no system prompt do brief
