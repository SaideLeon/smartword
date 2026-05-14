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


export type PayloadParseError = 'invalid' | 'too_long';

function parseBoundedTrimmedString(value: unknown, maxChars: number): { value: string | null; error: PayloadParseError | null } {
  if (typeof value !== 'string') return { value: null, error: 'invalid' };
  const normalized = value.trim();
  if (!normalized) return { value: null, error: 'invalid' };
  if (normalized.length > maxChars) return { value: null, error: 'too_long' };
  return { value: normalized, error: null };
}

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

export function parseOutlinePayloadDetailed(payload: unknown):
  { value: { sessionId: string; topic: string; suggestions: string | null; nivelEnsino: NivelEnsino } | null; error: PayloadParseError | null } {
  if (!payload || typeof payload !== 'object') return { value: null, error: 'invalid' };

  const sessionId = asTrimmedString((payload as Record<string, unknown>).sessionId);
  const topicResult = parseBoundedTrimmedString((payload as Record<string, unknown>).topic, 500);
  const suggestionsRaw = (payload as Record<string, unknown>).suggestions;

  if (!sessionId) return { value: null, error: 'invalid' };
  if (topicResult.error) return { value: null, error: topicResult.error };

  let suggestions: string | null = null;
  if (typeof suggestionsRaw === 'string') {
    const normalized = suggestionsRaw.trim();
    if (normalized.length > 15_000) return { value: null, error: 'too_long' };
    suggestions = normalized || null;
  } else if (suggestionsRaw != null) {
    return { value: null, error: 'invalid' };
  }

  const nivelEnsino = parseNivelEnsino((payload as Record<string, unknown>).nivelEnsino);
  if (!nivelEnsino) return { value: null, error: 'invalid' };

  return { value: { sessionId, topic: topicResult.value!, suggestions, nivelEnsino }, error: null };
}

export function parseOutlinePayload(payload: unknown): { sessionId: string; topic: string; suggestions: string | null; nivelEnsino: NivelEnsino } | null {
  return parseOutlinePayloadDetailed(payload).value;
}

export function parseCoverAbstractPayloadDetailed(payload: unknown):
  { value: { theme: string; topic: string | null; outline: string | null } | null; error: PayloadParseError | null } {
  if (!payload || typeof payload !== 'object') return { value: null, error: 'invalid' };

  const themeResult = parseBoundedTrimmedString((payload as Record<string, unknown>).theme, 500);
  const topicRaw = (payload as Record<string, unknown>).topic;
  const outlineRaw = (payload as Record<string, unknown>).outline;

  if (themeResult.error) return { value: null, error: themeResult.error };

  let topic: string | null = null;
  if (typeof topicRaw === 'string') {
    const normalized = topicRaw.trim();
    if (normalized.length > 500) return { value: null, error: 'too_long' };
    topic = normalized || null;
  } else if (topicRaw != null) {
    return { value: null, error: 'invalid' };
  }

  let outline: string | null = null;
  if (typeof outlineRaw === 'string') {
    const normalized = outlineRaw.trim();
    if (normalized.length > 15_000) return { value: null, error: 'too_long' };
    outline = normalized || null;
  } else if (outlineRaw != null) {
    return { value: null, error: 'invalid' };
  }

  return { value: { theme: themeResult.value!, topic, outline }, error: null };
}

export function parseCoverAbstractPayload(payload: unknown): { theme: string; topic: string | null; outline: string | null } | null {
  return parseCoverAbstractPayloadDetailed(payload).value;
}
