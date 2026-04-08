export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const LIMITS = {
  chatMessagesMax: 50,
  chatMessageMaxChars: 8000,
  topicMin: 3,
  topicMax: 500,
  themeMin: 3,
  themeMax: 300,
  suggestionsMax: 2000,
  outlineMax: 15000,
  sessionIdMax: 100,
} as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value.trim());
}

export function parseSessionPayload(payload: unknown): { sessionId: string; sectionIndex: number } | null {
  if (!payload || typeof payload !== 'object') return null;

  const sessionId = asTrimmedString((payload as Record<string, unknown>).sessionId);
  const sectionIndexRaw = (payload as Record<string, unknown>).sectionIndex;

  if (!sessionId || sessionId.length > LIMITS.sessionIdMax) return null;
  if (!Number.isInteger(sectionIndexRaw) || typeof sectionIndexRaw !== 'number' || sectionIndexRaw < 0) {
    return null;
  }

  return { sessionId, sectionIndex: sectionIndexRaw };
}

export function parseChatMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > LIMITS.chatMessagesMax) {
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

    if (content.length > LIMITS.chatMessageMaxChars) {
      return null;
    }

    parsed.push({ role, content });
  }

  return parsed;
}

export function parseOutlinePayload(payload: unknown): { sessionId: string; topic: string; suggestions: string | null } | null {
  if (!payload || typeof payload !== 'object') return null;

  const sessionId = asTrimmedString((payload as Record<string, unknown>).sessionId);
  const topic = asTrimmedString((payload as Record<string, unknown>).topic);
  const suggestionsRaw = (payload as Record<string, unknown>).suggestions;

  if (!sessionId || sessionId.length > LIMITS.sessionIdMax) return null;
  if (!topic || topic.length < LIMITS.topicMin || topic.length > LIMITS.topicMax) return null;

  let suggestions: string | null = null;
  if (typeof suggestionsRaw === 'string') {
    const normalized = suggestionsRaw.trim();
    if (normalized.length > LIMITS.suggestionsMax) return null;
    suggestions = normalized || null;
  } else if (suggestionsRaw != null) {
    return null;
  }

  return { sessionId, topic, suggestions };
}

export function parseCoverAbstractPayload(payload: unknown): { theme: string; topic: string | null; outline: string | null } | null {
  if (!payload || typeof payload !== 'object') return null;

  const theme = asTrimmedString((payload as Record<string, unknown>).theme);
  const topicRaw = (payload as Record<string, unknown>).topic;
  const outlineRaw = (payload as Record<string, unknown>).outline;

  if (!theme || theme.length < LIMITS.themeMin || theme.length > LIMITS.themeMax) return null;

  let topic: string | null = null;
  if (typeof topicRaw === 'string') {
    const normalized = topicRaw.trim();
    if (normalized.length > LIMITS.topicMax) return null;
    topic = normalized || null;
  } else if (topicRaw != null) {
    return null;
  }

  let outline: string | null = null;
  if (typeof outlineRaw === 'string') {
    const normalized = outlineRaw.trim();
    if (normalized.length > LIMITS.outlineMax) return null;
    outline = normalized || null;
  } else if (outlineRaw != null) {
    return null;
  }

  return { theme, topic, outline };
}
