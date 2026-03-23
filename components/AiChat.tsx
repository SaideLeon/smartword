'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessageContent } from '@/components/ChatMessageContent';

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } catch (err: any) {
      if (err.name !== 'AbortError') {
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
        background: '#0d0c0b',
        borderLeft: isMobile ? 'none' : '1px solid #2a2520',
      }}
    >
      {/* Header do chat */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0.75rem 0.85rem' : '0.75rem 1rem',
          borderBottom: '1px solid #2a2520',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '16px' }}>✦</span>
          <span
            style={{
              fontSize: '13px',
              fontFamily: 'monospace',
              color: '#c9a96e',
              letterSpacing: '0.06em',
            }}
          >
            IA · Gerar Markdown
          </span>
          {!isMobile && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#3a3530',
                background: '#1a1714',
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
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#5a5248',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '2px 6px',
            borderRadius: '3px',
          }}
          title="Fechar chat"
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
            <p style={{ color: '#4a4440', fontSize: '13px', fontFamily: 'monospace', lineHeight: 1.6 }}>
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
                  key={sugestao}
                  onClick={() => setInput(sugestao)}
                  style={{
                    background: '#1a1714',
                    border: '1px solid #2a2520',
                    borderRadius: '4px',
                    color: '#8a7d6e',
                    fontFamily: 'monospace',
                    fontSize: isMobile ? '10px' : '11px',
                    padding: isMobile ? '9px 10px' : '6px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    letterSpacing: '0.02em',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#c9a96e44';
                    (e.currentTarget as HTMLButtonElement).style.color = '#c9a96e';
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2520';
                    (e.currentTarget as HTMLButtonElement).style.color = '#8a7d6e';
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
                fontFamily: 'monospace',
                color: msg.role === 'user' ? '#c9a96e88' : '#4a7c5988',
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
                background: msg.role === 'user' ? '#1e1b18' : '#141210',
                border: `1px solid ${msg.role === 'user' ? '#2a2520' : '#1e1b18'}`,
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
                      background: '#c9a96e',
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
                  onClick={() => onInsert(msg.content)}
                  color="#4a7c59"
                />
                <ActionButton
                  icon="⟳"
                  label="Substituir"
                  title="Substitui todo o conteúdo do editor"
                  onClick={() => onReplace(msg.content)}
                  color="#8b6914"
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
            borderTop: '1px solid #1e1b18',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => onInsert(lastAssistant)}
            style={quickBtnStyle('#4a7c5922', '#4a7c59')}
          >
            ↓ Inserir no editor
          </button>
          <button
            onClick={() => onReplace(lastAssistant)}
            style={quickBtnStyle('#8b691422', '#c9a96e')}
          >
            ⟳ Substituir editor
          </button>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: isMobile ? '0.75rem 0.85rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' : '0.75rem 1rem',
          borderTop: '1px solid #2a2520',
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
            background: '#1a1714',
            border: '1px solid #2a2520',
            borderRadius: '5px',
            color: '#d4cec7',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: isMobile ? '10px' : '8px 10px',
            outline: 'none',
            resize: 'none',
            letterSpacing: '0.02em',
            lineHeight: 1.5,
            caretColor: '#c9a96e',
          }}
          onFocus={e => (e.target.style.borderColor = '#c9a96e55')}
          onBlur={e => (e.target.style.borderColor = '#2a2520')}
        />
        <button
          onClick={streaming ? () => abortRef.current?.abort() : send}
          style={{
            width: isMobile ? 42 : 36,
            height: isMobile ? 42 : 36,
            borderRadius: '5px',
            border: 'none',
            background: streaming
              ? '#3a1a1a'
              : input.trim()
              ? 'linear-gradient(135deg, #c9a96e 0%, #8b6914 100%)'
              : '#1a1714',
            color: streaming ? '#c9503a' : input.trim() ? '#0f0e0d' : '#3a3530',
            fontSize: '16px',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={streaming ? 'Parar' : 'Enviar'}
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
  icon, label, title, onClick, color,
}: {
  icon: string; label: string; title: string; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: '#1a1714',
        border: `1px solid ${color}44`,
        borderRadius: '4px',
        color,
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '4px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.04em',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLButtonElement).style.background = `${color}22`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = color;
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLButtonElement).style.background = '#1a1714';
        (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}44`;
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function quickBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1,
    background: bg,
    border: `1px solid ${color}44`,
    borderRadius: '4px',
    color,
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '5px 8px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  };
}
