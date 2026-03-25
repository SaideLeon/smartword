'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessageContent } from '@/components/ChatMessageContent';
import { chatTheme, colors, editorTheme, fonts, gradients, ghostButtonStyle, withAlpha } from '@/lib/theme';

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

    // Adiciona mensagem do assistente vazia para streaming
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: chatTheme.bg,
        borderLeft: isMobile ? 'none' : `1px solid ${chatTheme.border}`,
      }}
    >
      {/* Header do chat */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0.75rem 0.85rem' : '0.75rem 1rem',
          borderBottom: `1px solid ${chatTheme.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '16px' }}>✦</span>
          <span
            style={{
              fontSize: '13px',
              fontFamily: fonts.label,
              color: chatTheme.accent,
              letterSpacing: '0.06em',
            }}
          >
            IA · Gerar Markdown
          </span>
          {!isMobile && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: fonts.label,
                color: colors.textDim,
                background: editorTheme.surface,
                padding: '1px 6px',
                borderRadius: '3px',
                letterSpacing: '0.05em',
              }}
            >
              Groq · Llama 3.3
            </span>
          )}
        </div>
        <button
          className="press-feedback"
          onClick={onClose}
          style={ghostButtonStyle(colors.textFaint)}
          title="Fechar chat"
          aria-label="Fechar chat"
        >
          ×
        </button>
      </div>

      {/* Mensagens */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '0.85rem' : '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: isMobile ? '1rem' : '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✦</div>
            <p style={{ color: chatTheme.textFaint, fontSize: '13px', fontFamily: fonts.label, lineHeight: 1.6 }}>
              Descreve o conteúdo que queres gerar.<br />
              A IA devolve Markdown com equações LaTeX<br />
              prontas para exportar para Word.
            </p>
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                'Explica a fórmula de Bhaskara com exemplos',
                'Cria exercícios sobre logaritmos com soluções',
                'Resumo das propriedades das progressões aritméticas',
              ].map(sugestao => (
                <button
                  className="press-feedback"
                  key={sugestao}
                  onClick={() => setInput(sugestao)}
                  style={{
                    background: editorTheme.surface,
                    border: `1px solid ${chatTheme.border}`,
                    borderRadius: '4px',
                    color: chatTheme.textMuted,
                    fontFamily: fonts.label,
                    fontSize: isMobile ? '10px' : '11px',
                    padding: isMobile ? '9px 10px' : '6px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    letterSpacing: '0.02em',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = chatTheme.accentDim;
                    (e.currentTarget as HTMLButtonElement).style.color = chatTheme.accent;
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = chatTheme.border;
                    (e.currentTarget as HTMLButtonElement).style.color = chatTheme.textMuted;
                  }}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span
              style={{
                fontSize: '10px',
                fontFamily: fonts.label,
                color: msg.role === 'user' ? withAlpha(chatTheme.accent, '88') : withAlpha(colors.green, '88'),
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'user' ? 'Tu' : '✦ IA'}
            </span>
            <div
              style={{
                maxWidth: isMobile ? '100%' : '90%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? chatTheme.userBg : chatTheme.assistantBg,
                border: `1px solid ${msg.role === 'user' ? chatTheme.border : chatTheme.borderAlt}`,
                borderRadius: msg.role === 'user' ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                padding: '0.6rem 0.85rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <ChatMessageContent content={msg.content} role={msg.role} />
                {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '13px',
                      background: chatTheme.accent,
                      marginLeft: '2px',
                      verticalAlign: 'text-bottom',
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Botões de acção na última mensagem do assistente */}
            {msg.role === 'assistant' && i === messages.length - 1 && !streaming && msg.content && (
              <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.25rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
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

      {/* Botões de inserção rápida se houver resposta */}
      {lastAssistant && !streaming && messages.length > 0 && (
        <div
          style={{
            padding: isMobile ? '0.75rem 0.85rem' : '0.5rem 1rem',
            borderTop: `1px solid ${chatTheme.borderAlt}`,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          <button
            className="press-feedback"
            onClick={() => handleInsert(lastAssistant)}
            style={quickBtnStyle(withAlpha(colors.green, '22'), colors.green)}
          >
            {recentAction === 'insert' ? '✓ Inserido no editor' : '↓ Inserir no editor'}
          </button>
          <button
            className="press-feedback"
            onClick={() => handleReplace(lastAssistant)}
            style={quickBtnStyle(withAlpha(colors.goldDark, '22'), chatTheme.accent)}
          >
            {recentAction === 'replace' ? '✓ Editor substituído' : '⟳ Substituir editor'}
          </button>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: isMobile ? '0.75rem 0.85rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' : '0.75rem 1rem',
          borderTop: `1px solid ${chatTheme.border}`,
          flexShrink: 0,
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Descreve o conteúdo a gerar… (Enter para enviar)"
          rows={2}
          style={{
            flex: 1,
            background: editorTheme.surface,
            border: `1px solid ${chatTheme.border}`,
            borderRadius: '5px',
            color: chatTheme.text,
            fontFamily: fonts.label,
            fontSize: '12px',
            padding: isMobile ? '10px' : '8px 10px',
            outline: 'none',
            resize: 'none',
            letterSpacing: '0.02em',
            lineHeight: 1.5,
            caretColor: editorTheme.caretColor,
          }}
          onFocus={e => (e.target.style.borderColor = withAlpha(chatTheme.accent, '55'))}
          onBlur={e => (e.target.style.borderColor = chatTheme.border)}
        />
        <button
          className="press-feedback"
          onClick={streaming ? () => abortRef.current?.abort() : send}
          style={{
            width: isMobile ? 42 : 36,
            height: isMobile ? 42 : 36,
            borderRadius: '5px',
            border: 'none',
            background: streaming
              ? '#3a1a1a'
              : input.trim()
              ? gradients.gold
              : editorTheme.surface,
            color: streaming ? '#c9503a' : input.trim() ? editorTheme.bg : colors.textDim,
            fontSize: '16px',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
  return (
    <button
      className="press-feedback"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: editorTheme.surface,
        border: `1px solid ${withAlpha(color, '44')}`,
        borderRadius: '4px',
        color,
        fontFamily: fonts.label,
        fontSize: '11px',
        padding: '4px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.04em',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLButtonElement).style.background = withAlpha(color, '22');
        (e.currentTarget as HTMLButtonElement).style.borderColor = color;
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLButtonElement).style.background = editorTheme.surface;
        (e.currentTarget as HTMLButtonElement).style.borderColor = withAlpha(color, '44');
      }}
    >
      <span>{isActive ? '✓' : icon}</span>
      <span>{isActive ? activeLabel : label}</span>
    </button>
  );
}

function quickBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1,
    background: bg,
    border: `1px solid ${withAlpha(color, '44')}`,
    borderRadius: '4px',
    color,
    fontFamily: fonts.label,
    fontSize: '11px',
    padding: '5px 8px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  };
}
