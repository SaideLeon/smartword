export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value.trim());
}

export type NivelEnsino = 'Ensino Universitário' | 'Ensino Secundário' | 'Ensino Médio';

function parseNivelEnsino(value: unknown): NivelEnsino | null {
  if (value === 'Ensino Universitário' || value === 'Ensino Secundário' || value === 'Ensino Médio') {
    return value;
  }
  return null;
}

export function parseSessionPayload(payload: unknown): { sessionId: string; sectionIndex: number; nivelEnsino: NivelEnsino } | null {
  if (!payload || typeof payload !== 'object') return null;

  const sessionId = asTrimmedString((payload as Record<string, unknown>).sessionId);
  const sectionIndexRaw = (payload as Record<string, unknown>).sectionIndex;

  if (!sessionId) return null;
  if (!Number.isInteger(sectionIndexRaw) || typeof sectionIndexRaw !== 'number' || sectionIndexRaw < 0) {
    return null;
  }

  const nivelEnsino = parseNivelEnsino((payload as Record<string, unknown>).nivelEnsino);
  if (!nivelEnsino) return null;

  return { sessionId, sectionIndex: sectionIndexRaw, nivelEnsino };
}

export function parseChatMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const parsed: ChatMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;

    const role = (item as Record<string, unknown>).role;
    const content = asTrimmedString((item as Record<string, unknown>).content);

    if ((role !== 'user' && role !== 'assistant') || !content) {
      return null;
    }


    parsed.push({ role, content });
  }

  return parsed;
}

export function parseOutlinePayload(payload: unknown): { sessionId: string; topic: string; suggestions: string | null; nivelEnsino: NivelEnsino } | null {
  if (!payload || typeof payload !== 'object') return null;

  const sessionId = asTrimmedString((payload as Record<string, unknown>).sessionId);
  const topic = asTrimmedString((payload as Record<string, unknown>).topic);
  const suggestionsRaw = (payload as Record<string, unknown>).suggestions;

  if (!sessionId) return null;
  if (!topic) return null;

  let suggestions: string | null = null;
  if (typeof suggestionsRaw === 'string') {
    const normalized = suggestionsRaw.trim();
    suggestions = normalized || null;
  } else if (suggestionsRaw != null) {
    return null;
  }

  const nivelEnsino = parseNivelEnsino((payload as Record<string, unknown>).nivelEnsino);
  if (!nivelEnsino) return null;

  return { sessionId, topic, suggestions, nivelEnsino };
}

export function parseCoverAbstractPayload(payload: unknown): { theme: string; topic: string | null; outline: string | null } | null {
  if (!payload || typeof payload !== 'object') return null;

  const theme = asTrimmedString((payload as Record<string, unknown>).theme);
  const topicRaw = (payload as Record<string, unknown>).topic;
  const outlineRaw = (payload as Record<string, unknown>).outline;

  if (!theme) return null;

  let topic: string | null = null;
  if (typeof topicRaw === 'string') {
    const normalized = topicRaw.trim();
    topic = normalized || null;
  } else if (topicRaw != null) {
    return null;
  }

  let outline: string | null = null;
  if (typeof outlineRaw === 'string') {
    const normalized = outlineRaw.trim();
    outline = normalized || null;
  } else if (outlineRaw != null) {
    return null;
  }

  return { theme, topic, outline };
}
