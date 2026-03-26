'use client';

import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { ChatMessageContent } from '@/components/ChatMessageContent';
import { chatTheme, colors, editorTheme, fonts, gradients, withAlpha } from '@/lib/theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

export function AiChat({ onInsert, onReplace, onClose, isMobile = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [recentAction, setRecentAction] = useState<'insert' | 'replace' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const actionFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vars = useMemo(() => ({
    '--chat-bg': chatTheme.bg,
    '--chat-border': chatTheme.border,
    '--chat-border-alt': chatTheme.borderAlt,
    '--chat-accent': chatTheme.accent,
    '--chat-accent-dim': chatTheme.accentDim,
    '--chat-text': chatTheme.text,
    '--chat-text-muted': chatTheme.textMuted,
    '--chat-text-faint': chatTheme.textFaint,
    '--chat-user-bg': chatTheme.userBg,
    '--chat-assistant-bg': chatTheme.assistantBg,
    '--editor-surface': editorTheme.surface,
    '--editor-bg': editorTheme.bg,
    '--editor-caret': editorTheme.caretColor,
    '--text-dim': colors.textDim,
    '--text-faint': colors.textFaint,
    '--green': colors.green,
    '--gold-dark': colors.goldDark,
    '--gradient-gold': gradients.gold,
    '--font-label': fonts.label,
  } as CSSProperties), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (actionFeedbackTimeoutRef.current) clearTimeout(actionFeedbackTimeoutRef.current);
  }, []);

  const showActionFeedback = useCallback((action: 'insert' | 'replace') => {
    setRecentAction(action);
    if (actionFeedbackTimeoutRef.current) clearTimeout(actionFeedbackTimeoutRef.current);
    actionFeedbackTimeoutRef.current = setTimeout(() => {
      setRecentAction(current => (current === action ? null : current));
      actionFeedbackTimeoutRef.current = null;
    }, 2200);
  }, []);

  const handleInsert = useCallback((text: string) => {
    onInsert(text);
    showActionFeedback('insert');
  }, [onInsert, showActionFeedback]);

  const handleReplace = useCallback((text: string) => {
    onReplace(text);
    showActionFeedback('replace');
  }, [onReplace, showActionFeedback]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Erro na resposta');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              accumulated += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
            }
          } catch {
            // linha inválida, ignorar
          }
        }
      }
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '_Erro ao gerar resposta. Verifica a chave GROQ_API_KEY._',
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? '';

  return (
    <div style={vars} className={`flex h-full flex-col bg-[var(--chat-bg)] ${isMobile ? '' : 'border-l border-[var(--chat-border)]'}`}>
      <div className={`flex shrink-0 items-center justify-between border-b border-[var(--chat-border)] ${isMobile ? 'px-[0.85rem] py-3' : 'px-4 py-3'}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">✦</span>
          <span className="text-[13px] tracking-[0.06em] text-[var(--chat-accent)] [font-family:var(--font-label)]">IA · Gerar Markdown</span>
          {!isMobile && (
            <span className="rounded-[3px] bg-[var(--editor-surface)] px-1.5 py-px text-[10px] tracking-[0.05em] text-[var(--text-dim)] [font-family:var(--font-label)]">
              Groq · Llama 3.3
            </span>
          )}
        </div>
        <button className="press-feedback rounded px-1.5 py-0.5 text-xl leading-none text-[var(--text-faint)]" onClick={onClose} title="Fechar chat" aria-label="Fechar chat">×</button>
      </div>

      <div className={`flex flex-1 flex-col gap-4 overflow-y-auto ${isMobile ? 'p-[0.85rem]' : 'p-4'}`}>
        {messages.length === 0 && (
          <div className={`text-center ${isMobile ? 'mt-4' : 'mt-8'}`}>
            <div className="mb-3 text-[2rem]">✦</div>
            <p className="text-[13px] leading-[1.6] text-[var(--chat-text-faint)] [font-family:var(--font-label)]">
              Descreve o conteúdo que queres gerar.<br />
              A IA devolve Markdown com equações LaTeX<br />
              prontas para exportar para Word.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {[
                'Explica a fórmula de Bhaskara com exemplos',
                'Cria exercícios sobre logaritmos com soluções',
                'Resumo das propriedades das progressões aritméticas',
              ].map(sugestao => (
                <button
                  className={`press-feedback rounded border border-[var(--chat-border)] bg-[var(--editor-surface)] text-left tracking-[0.02em] text-[var(--chat-text-muted)] transition-colors hover:border-[var(--chat-accent-dim)] hover:text-[var(--chat-accent)] [font-family:var(--font-label)] ${isMobile ? 'px-[10px] py-[9px] text-[10px]' : 'px-[10px] py-1.5 text-[11px]'}`}
                  key={sugestao}
                  onClick={() => setInput(sugestao)}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col gap-[0.35rem]">
            <span
              className={`${msg.role === 'user' ? 'self-end' : 'self-start'} text-[10px] uppercase tracking-[0.08em] [font-family:var(--font-label)]`}
              style={{ color: msg.role === 'user' ? withAlpha(chatTheme.accent, '88') : withAlpha(colors.green, '88') }}
            >
              {msg.role === 'user' ? 'Tu' : '✦ IA'}
            </span>
            <div
              className={`${msg.role === 'user' ? 'self-end rounded-[8px_8px_2px_8px] border-[var(--chat-border)] bg-[var(--chat-user-bg)]' : 'self-start rounded-[8px_8px_8px_2px] border-[var(--chat-border-alt)] bg-[var(--chat-assistant-bg)]'} border px-[0.85rem] py-[0.6rem] ${isMobile ? 'max-w-full' : 'max-w-[90%]'}`}
            >
              <div className="flex flex-col gap-[0.2rem]">
                <ChatMessageContent content={msg.content} role={msg.role} />
                {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span className="inline-block h-[13px] w-[2px] animate-[blink_1s_step-end_infinite] bg-[var(--chat-accent)] align-text-bottom" />
                )}
              </div>
            </div>

            {msg.role === 'assistant' && i === messages.length - 1 && !streaming && msg.content && (
              <div className={`mt-1 flex flex-wrap gap-2 self-start ${isMobile ? 'w-full' : 'w-auto'}`}>
                <ActionButton
                  icon="↓"
                  label="Inserir"
                  title="Adiciona ao fim do editor"
                  onClick={() => handleInsert(msg.content)}
                  color={colors.green}
                  activeLabel="Inserido"
                  isActive={recentAction === 'insert'}
                />
                <ActionButton
                  icon="⟳"
                  label="Substituir"
                  title="Substitui todo o conteúdo do editor"
                  onClick={() => handleReplace(msg.content)}
                  color={colors.goldDark}
                  activeLabel="Substituído"
                  isActive={recentAction === 'replace'}
                />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {lastAssistant && !streaming && messages.length > 0 && (
        <div className={`flex shrink-0 gap-2 border-t border-[var(--chat-border-alt)] ${isMobile ? 'flex-col px-[0.85rem] py-3' : 'flex-row px-4 py-2'}`}>
          <button className="press-feedback flex-1 rounded border px-2 py-[5px] text-[11px] tracking-[0.04em] [font-family:var(--font-label)]" onClick={() => handleInsert(lastAssistant)} style={{ background: withAlpha(colors.green, '22'), borderColor: withAlpha(colors.green, '44'), color: colors.green }}>
            {recentAction === 'insert' ? '✓ Inserido no editor' : '↓ Inserir no editor'}
          </button>
          <button className="press-feedback flex-1 rounded border px-2 py-[5px] text-[11px] tracking-[0.04em] [font-family:var(--font-label)]" onClick={() => handleReplace(lastAssistant)} style={{ background: withAlpha(colors.goldDark, '22'), borderColor: withAlpha(chatTheme.accent, '44'), color: chatTheme.accent }}>
            {recentAction === 'replace' ? '✓ Editor substituído' : '⟳ Substituir editor'}
          </button>
        </div>
      )}

      <div className={`flex shrink-0 items-end gap-2 border-t border-[var(--chat-border)] ${isMobile ? 'px-[0.85rem] pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]' : 'px-4 py-3'}`}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Descreve o conteúdo a gerar… (Enter para enviar)"
          rows={2}
          className={`flex-1 resize-none rounded-[5px] border border-[var(--chat-border)] bg-[var(--editor-surface)] px-[10px] text-xs leading-[1.5] tracking-[0.02em] text-[var(--chat-text)] outline-none [caret-color:var(--editor-caret)] [font-family:var(--font-label)] focus:border-[color:var(--chat-accent)/0.55] ${isMobile ? 'py-[10px]' : 'py-2'}`}
        />
        <button
          className={`press-feedback flex shrink-0 items-center justify-center rounded-[5px] text-base transition-all ${isMobile ? 'h-[42px] w-[42px]' : 'h-9 w-9'}`}
          onClick={streaming ? () => abortRef.current?.abort() : send}
          style={{
            border: 'none',
            background: streaming ? '#3a1a1a' : input.trim() ? gradients.gold : editorTheme.surface,
            color: streaming ? '#c9503a' : input.trim() ? editorTheme.bg : colors.textDim,
          }}
          title={streaming ? 'Parar' : 'Enviar'}
          aria-label={streaming ? 'Parar geração' : 'Enviar mensagem'}
        >
          {streaming ? '■' : '↑'}
        </button>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ActionButton({
  icon, label, title, onClick, color, activeLabel, isActive = false,
}: {
  icon: string; label: string; title: string; onClick: () => void; color: string; activeLabel: string; isActive?: boolean;
}) {
  const vars = useMemo(() => ({
    '--action-color': color,
    '--action-bg': withAlpha(color, '22'),
    '--action-border': withAlpha(color, '44'),
    '--editor-surface': editorTheme.surface,
  } as CSSProperties), [color]);

  return (
    <button
      className="press-feedback flex items-center gap-[0.3rem] rounded border border-[var(--action-border)] bg-[var(--editor-surface)] px-[10px] py-1 text-[11px] tracking-[0.04em] text-[var(--action-color)] transition-all hover:border-[var(--action-color)] hover:bg-[var(--action-bg)] [font-family:var(--font-label)]"
      onClick={onClick}
      title={title}
      style={vars}
    >
      <span>{isActive ? '✓' : icon}</span>
      <span>{isActive ? activeLabel : label}</span>
    </button>
  );
}
