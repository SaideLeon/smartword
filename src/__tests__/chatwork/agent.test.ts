import { describe, expect, it } from 'vitest';
import { applyChatworkEdit, parseChatworkAgentJson, parseChatworkAgentPayload } from '../../lib/chatwork/agent';

describe('chatwork agent helpers', () => {
  it('valida payloads de comandos do Chatwork', () => {
    expect(parseChatworkAgentPayload({ documentMarkdown: '# Título', command: 'melhora' })).toMatchObject({
      documentMarkdown: '# Título',
      command: 'melhora',
    });

    expect(parseChatworkAgentPayload({ documentMarkdown: '# Título', command: '' })).toBeNull();
  });

  it('aplica edição localizada quando há alvo no documento', () => {
    const updated = applyChatworkEdit('Introdução antiga\nConclusão', {
      type: 'replace-selection',
      target: 'Introdução antiga',
      replacement: 'Introdução melhorada',
      summary: 'Melhorou a introdução',
    });

    expect(updated).toBe('Introdução melhorada\nConclusão');
  });

  it('extrai JSON do agente e devolve documento actualizado', () => {
    const parsed = parseChatworkAgentJson('{"reply":"feito","documentMarkdown":"# Novo","edits":[]}', '# Antigo');

    expect(parsed.reply).toBe('feito');
    expect(parsed.documentMarkdown).toBe('# Novo');
  });
});
