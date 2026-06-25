export interface ChatworkMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatworkAgentRequest {
  documentMarkdown: string;
  command: string;
  selectedText?: string;
  messages?: ChatworkMessage[];
}

export interface ChatworkAgentEdit {
  type: 'replace-selection' | 'replace-document' | 'append-note';
  target: string;
  replacement: string;
  summary: string;
}

export interface ChatworkAgentResponse {
  reply: string;
  documentMarkdown: string;
  edits: ChatworkAgentEdit[];
}

export const CHATWORK_MAX_DOCUMENT_CHARS = 60_000;
export const CHATWORK_MAX_COMMAND_CHARS = 2_000;
export const CHATWORK_MAX_SELECTED_TEXT_CHARS = 10_000;

function limitText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxChars) return null;
  return trimmed;
}

export function parseChatworkAgentPayload(payload: unknown): ChatworkAgentRequest | null {
  const body = payload as Partial<ChatworkAgentRequest> | null;
  if (!body || typeof body !== 'object') return null;

  const documentMarkdown = limitText(body.documentMarkdown, CHATWORK_MAX_DOCUMENT_CHARS);
  const command = limitText(body.command, CHATWORK_MAX_COMMAND_CHARS);
  if (documentMarkdown === null || command === null || !command) return null;

  const selectedText = body.selectedText === undefined || body.selectedText === ''
    ? undefined
    : limitText(body.selectedText, CHATWORK_MAX_SELECTED_TEXT_CHARS);
  if (selectedText === null) return null;

  const messages = Array.isArray(body.messages)
    ? body.messages
      .slice(-8)
      .filter((msg): msg is ChatworkMessage => (
        msg !== null
        && typeof msg === 'object'
        && (msg.role === 'user' || msg.role === 'assistant')
        && typeof msg.content === 'string'
        && msg.content.length <= 2_000
      ))
    : [];

  return { documentMarkdown, command, selectedText, messages };
}

export function applyChatworkEdit(documentMarkdown: string, edit: ChatworkAgentEdit): string {
  if (edit.type === 'replace-document') return edit.replacement.trim();

  if (edit.type === 'replace-selection' && edit.target) {
    const index = documentMarkdown.indexOf(edit.target);
    if (index >= 0) {
      return `${documentMarkdown.slice(0, index)}${edit.replacement}${documentMarkdown.slice(index + edit.target.length)}`.trim();
    }
  }

  if (edit.type === 'append-note') {
    return `${documentMarkdown.trim()}\n\n> Nota do agente: ${edit.replacement.trim()}`.trim();
  }

  return documentMarkdown;
}

export function applyChatworkEdits(documentMarkdown: string, edits: ChatworkAgentEdit[]): string {
  return edits.reduce((current, edit) => applyChatworkEdit(current, edit), documentMarkdown);
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
}

export function parseChatworkAgentJson(raw: string, originalDocument: string): ChatworkAgentResponse {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return {
      reply: raw.trim() || 'Analisei o documento, mas não apliquei alterações automáticas.',
      documentMarkdown: originalDocument,
      edits: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<ChatworkAgentResponse>;
    const edits = Array.isArray(parsed.edits)
      ? parsed.edits.filter((edit): edit is ChatworkAgentEdit => (
        edit !== null
        && typeof edit === 'object'
        && (edit.type === 'replace-selection' || edit.type === 'replace-document' || edit.type === 'append-note')
        && typeof edit.target === 'string'
        && typeof edit.replacement === 'string'
        && typeof edit.summary === 'string'
      ))
      : [];

    const documentMarkdown = typeof parsed.documentMarkdown === 'string' && parsed.documentMarkdown.trim()
      ? parsed.documentMarkdown.trim()
      : applyChatworkEdits(originalDocument, edits);

    return {
      reply: typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : 'Alterações aplicadas ao documento.',
      documentMarkdown,
      edits,
    };
  } catch {
    return {
      reply: raw.trim() || 'A resposta do agente não pôde ser aplicada automaticamente.',
      documentMarkdown: originalDocument,
      edits: [],
    };
  }
}
