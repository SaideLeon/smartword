// ─────────────────────────────────────────────────────────────────────────────
// PATCH para src/lib/validation/input-guards.ts
//
// Substitui APENAS a função parseOutlinePayload.
// Adiciona o campo opcional workType: 'academic' | 'project'.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkType } from '@/lib/work/types';

const VALID_WORK_TYPES: WorkType[] = ['academic', 'project'];

export function parseOutlinePayload(
  payload: unknown,
): { sessionId: string; topic: string; suggestions: string | null; workType: WorkType } | null {
  if (!payload || typeof payload !== 'object') return null;

  const p = payload as Record<string, unknown>;

  const sessionId = typeof p.sessionId === 'string' ? p.sessionId.trim() : '';
  const topic     = typeof p.topic     === 'string' ? p.topic.trim()     : '';

  if (!sessionId || sessionId.length > 100) return null;
  if (!topic || topic.length < 3 || topic.length > 500) return null;

  let suggestions: string | null = null;
  if (typeof p.suggestions === 'string') {
    const normalized = p.suggestions.trim();
    if (normalized.length > 2000) return null;
    suggestions = normalized || null;
  } else if (p.suggestions != null) {
    return null;
  }

  const workTypeRaw = typeof p.workType === 'string' ? p.workType.trim() : 'academic';
  const workType: WorkType = VALID_WORK_TYPES.includes(workTypeRaw as WorkType)
    ? (workTypeRaw as WorkType)
    : 'academic';

  return { sessionId, topic, suggestions, workType };
}
