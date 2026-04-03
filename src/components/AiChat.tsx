'use client';

// AiChat.tsx — redesenhado com contraste, hierarquia visual e renderização melhorados

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import { ChatMessageContent } from '@/components/ChatMessageContent';
import { AudioInputButton } from '@/components/AudioInputButton';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  tokenEstimate: number;
}

interface Props {
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'muneri-chat-history-v2';
const MAX_SESSIONS = 20;

// ── Utilitários ───────────────────────────────────────────────────────────────

function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeTitle(userMessage: string): string {
  return userMessage.trim().slice(0, 52) + (userMessage.length > 52 ? '…' : '');
}

function estimateTokens(messages: Message[]): number {
  return Math.round(messages.reduce((acc, m) => acc + m.content.length / 4, 0));
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (d >= 7) return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  if (d >= 1) return `${d}d atrás`;
  if (h >= 1) return `${h}h atrás`;
  if (m >= 1) return `${m}m atrás`;
  return 'agora';
}

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch { /* quota exceeded */ }
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AiChat({ onInsert, onReplace, onClose, isMobile = false }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [recentAction, setRecentAction] = useState<'insert' | 'replace' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSessions(loadSessions()); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowHistory(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => () => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const persistSession = useCallback((id: string, msgs: Message[], existingSessions: ChatSession[]) => {
    if (msgs.length === 0) return existingSessions;
    const firstUser = msgs.find(m => m.role === 'user');
    const title = firstUser ? makeTitle(firstUser.content) : 'Nova conversa';
    const now = Date.now();
    const updated: ChatSession = {
      id,
      title,
      messages: msgs,
      createdAt: existingSessions.find(s => s.id === id)?.createdAt ?? now,
      updatedAt: now,
      tokenEstimate: estimateTokens(msgs),
    };
    const next = [updated, ...existingSessions.filter(s => s.id !== id)].slice(0, MAX_SESSIONS);
    saveSessions(next);
    return next;
  }, []);

  const startNewSession = useCallback(() => {
    if (messages.length > 0 && currentSessionId) {
      setSessions(prev => persistSession(currentSessionId, messages, prev));
    }
    const id = generateId();
    setCurrentSessionId(id);
    setMessages([]);
    setInput('');
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [messages, currentSessionId, persistSession]);

  const resumeSession = useCallback((session: ChatSession) => {
    if (messages.length > 0 && currentSessionId) {
      setSessions(prev => persistSession(currentSessionId, messages, prev));
    }
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [messages, currentSessionId, persistSession]);

  const deleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      saveSessions(next);
      return next;
    });
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId]);

  const copyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgIdx(idx);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedMsgIdx(null), 1800);
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const sessId = currentSessionId ?? generateId();
    if (!currentSessionId) setCurrentSessionId(sessId);

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    const newMessages: Message[] = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const assistantPlaceholder: Message = { role: 'assistant', content: '', timestamp: Date.now() };
    setMessages(prev => [...prev, assistantPlaceholder]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error('Erro na resposta');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
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
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  timestamp: Date.now(),
                };
                return updated;
              });
            }
          } catch { /* ignorar */ }
        }
      }

      const finalMsgs: Message[] = [
        ...newMessages,
        { role: 'assistant', content: accumulated, timestamp: Date.now() },
      ];
      setMessages(finalMsgs);
      setSessions(prev => persistSession(sessId, finalMsgs, prev));
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const errorMsgs: Message[] = [
          ...newMessages,
          {
            role: 'assistant',
            content: '_Erro ao gerar resposta. Verifica a ligação e tenta novamente._',
            timestamp: Date.now(),
          },
        ];
        setMessages(errorMsgs);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, currentSessionId, persistSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showActionFeedback = useCallback((action: 'insert' | 'replace') => {
    setRecentAction(action);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => setRecentAction(null), 2200);
  }, []);

  const handleInsert = useCallback((text: string) => {
    onInsert(text);
    showActionFeedback('insert');
  }, [onInsert, showActionFeedback]);

  const handleReplace = useCallback((text: string) => {
    onReplace(text);
    showActionFeedback('replace');
  }, [onReplace, showActionFeedback]);

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? '';

  const filteredSessions = useMemo(() => {
    if (!historySearch.trim()) return sessions;
    const q = historySearch.toLowerCase();
    return sessions.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.messages.some(m => m.content.toLowerCase().includes(q)),
    );
  }, [sessions, historySearch]);

  const SUGGESTIONS = [
    'Explica a fórmula de Bhaskara com exemplos',
    'Cria exercícios sobre logaritmos com soluções',
    'Resumo das propriedades das progressões aritméticas',
  ];

  return (
    <div className="ac-root flex h-full overflow-hidden">

      {/* ── Painel de histórico ─────────────────────────────────────────────── */}
      {showHistory && (
        <div
          className="ac-history flex flex-col"
          style={{
            width: isMobile ? '100%' : '230px',
            flexShrink: 0,
            position: isMobile ? 'absolute' : 'relative',
            inset: isMobile ? 0 : 'auto',
            zIndex: isMobile ? 10 : 'auto',
          }}
        >
          <div className="ac-history-header flex items-center justify-between px-3 py-3">
            <span className="ac-label-xs ac-accent">HISTÓRICO</span>
            <div className="flex gap-1.5">
              <button onClick={startNewSession} className="ac-btn-ghost ac-accent" style={{ fontSize: 11, padding: '3px 8px' }}>
                + Nova
              </button>
              {isMobile && (
                <button onClick={() => setShowHistory(false)} className="ac-btn-close">×</button>
              )}
            </div>
          </div>

          <div className="px-3 py-2">
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Pesquisar…"
              className="ac-search-input"
            />
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredSessions.length === 0 && (
              <p className="ac-empty-state">
                {historySearch ? 'Nenhum resultado' : 'Sem conversas ainda.'}
              </p>
            )}
            {filteredSessions.map(s => (
              <div
                key={s.id}
                onClick={() => resumeSession(s)}
                className={`ac-session-item ${currentSessionId === s.id ? 'ac-session-active' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className={`ac-session-title ${currentSessionId === s.id ? 'ac-accent' : ''}`}>
                    {s.title}
                  </p>
                  <button
                    onClick={e => deleteSession(s.id, e)}
                    className="ac-btn-close"
                    title="Eliminar"
                  >×</button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="ac-label-xxs ac-faint">{formatRelativeTime(s.updatedAt)}</span>
                  <span className="ac-label-xxs ac-faint">· ~{s.tokenEstimate} tok</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Área de chat ──────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col ac-chat-area">

        {/* Header */}
        <div className="ac-header flex shrink-0 items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => setShowHistory(v => !v)}
            className={`ac-btn-icon ${showHistory ? 'ac-btn-icon-active' : ''}`}
            title="Histórico (Ctrl+K)"
            aria-label="Abrir histórico"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="1" y="6.25" width="8" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="1" y="10.5" width="10" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>✦</span>
            <span className="ac-label-xs ac-accent" style={{ letterSpacing: '0.08em' }}>
              IA · MATEMÁTICA
            </span>
            {messages.length > 0 && (
              <span className="ac-badge">{messages.length} msg</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button onClick={startNewSession} className="ac-btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}>
                + Nova
              </button>
            )}
            <button onClick={onClose} className="ac-btn-close" style={{ fontSize: 20 }} aria-label="Fechar chat">×</button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="no-scrollbar flex-1 overflow-y-auto" style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', paddingTop: 20, paddingBottom: 20 }}>
              <div style={{ fontSize: '2rem', marginBottom: 14 }}>✦</div>
              <p className="ac-empty-hint">
                Descreve o conteúdo que queres gerar.<br />
                A IA devolve Markdown com equações LaTeX<br />
                prontas para exportar para Word.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="ac-suggestion"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sessions.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="ac-link"
                  style={{ marginTop: 16 }}
                >
                  ↩ Retomar conversa anterior ({sessions.length})
                </button>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && i === messages.length - 1;
            const isStreamingThis = isLastAssistant && streaming;

            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {/* Rótulo + tempo */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}>
                  {!isUser && (
                    <div className="ac-ai-avatar">✦</div>
                  )}
                  <span className={`ac-label-xxs ${isUser ? 'ac-user-label' : 'ac-ai-label'}`}>
                    {isUser ? 'Tu' : 'IA'}
                  </span>
                  {msg.timestamp && (
                    <span className="ac-label-xxs ac-faint">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Bolha */}
                <div
                  className={isUser ? 'ac-bubble-user' : 'ac-bubble-ai'}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: isMobile ? '100%' : '95%',
                  }}
                >
                  <ChatMessageContent content={msg.content} role={msg.role} />

                  {isStreamingThis && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(dot => (
                        <span
                          key={dot}
                          className="ac-dot"
                          style={{ animationDelay: `${dot * 0.2}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Acções da mensagem */}
                {!isUser && !isStreamingThis && msg.content && (
                  <div style={{ display: 'flex', gap: 5, alignSelf: 'flex-start', marginTop: 1 }}>
                    <ActionButton
                      label={copiedMsgIdx === i ? '✓ Copiado' : 'Copiar'}
                      onClick={() => copyMessage(msg.content, i)}
                      variant="neutral"
                    />
                    {isLastAssistant && (
                      <>
                        <ActionButton
                          label={recentAction === 'insert' ? '✓ Inserido' : '↓ Inserir'}
                          onClick={() => handleInsert(msg.content)}
                          variant="green"
                        />
                        <ActionButton
                          label={recentAction === 'replace' ? '✓ Substituído' : '⟳ Substituir'}
                          onClick={() => handleReplace(msg.content)}
                          variant="accent"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Barra de acções rápidas */}
        {lastAssistant && !streaming && messages.length > 0 && (
          <div
            className="ac-quick-bar flex shrink-0 gap-2"
            style={{ flexDirection: isMobile ? 'column' : 'row' }}
          >
            <button
              onClick={() => handleInsert(lastAssistant)}
              className="ac-quick-btn ac-quick-green"
            >
              {recentAction === 'insert' ? '✓ Inserido no editor' : '↓ Inserir no editor'}
            </button>
            <button
              onClick={() => handleReplace(lastAssistant)}
              className="ac-quick-btn ac-quick-accent"
            >
              {recentAction === 'replace' ? '✓ Editor substituído' : '⟳ Substituir editor'}
            </button>
          </div>
        )}

        {/* Input */}
        <div
          className="ac-input-row flex shrink-0 items-end gap-2"
          style={{
            padding: isMobile
              ? '12px 13px calc(12px + env(safe-area-inset-bottom, 0px))'
              : '10px 12px',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreve o conteúdo a gerar… (Enter para enviar)"
            rows={2}
            className="ac-textarea"
            style={{ fontSize: isMobile ? 13 : 12 }}
          />
          <AudioInputButton
            onTranscription={text => setInput(prev => prev ? `${prev} ${text}` : text)}
            disabled={streaming}
            className={`border-[var(--ac-border)] ${isMobile ? 'h-[44px] w-[44px] text-base' : 'h-9 w-9 text-sm'}`}
            title="Gravar mensagem"
          />
          <button
            onClick={streaming ? () => abortRef.current?.abort() : send}
            title={streaming ? 'Parar' : 'Enviar'}
            aria-label={streaming ? 'Parar geração' : 'Enviar mensagem'}
            className={`ac-send-btn ${streaming ? 'ac-send-stop' : input.trim() ? 'ac-send-ready' : 'ac-send-idle'}`}
            style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36 }}
          >
            {streaming ? '■' : '↑'}
          </button>
        </div>
      </div>

      {/* ── Estilos ────────────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Tokens de cor ─────────────────────────── */
        .ac-root {
          --ac-bg:            #111113;
          --ac-history-bg:    #0d0d0f;
          --ac-surface:       #1a1a1d;
          --ac-input-bg:      #1e1e22;
          --ac-code-bg:       #161618;
          --ac-border:        #2c2c32;
          --ac-border-alt:    #232328;
          --ac-border-sub:    #1c1c20;
          --ac-hover:         #1d1d22;
          --ac-active:        #1a2b1e;

          /* Cores principais */
          --ac-accent:        #f59e0b;
          --ac-accent-dim:    rgba(245,158,11,0.13);
          --ac-green:         #22d3a0;
          --ac-green-dim:     rgba(34,211,160,0.12);
          --ac-red:           #f87171;

          /* Texto — contraste elevado */
          --ac-text:          #ededf0;
          --ac-text-muted:    #b0b0b8;
          --ac-text-faint:    #6a6a75;

          /* Bolhas */
          --ac-user-bg:       #1c2b20;
          --ac-user-border:   #2a3f2e;
          --ac-ai-bg:         #181820;
          --ac-ai-border:     #28283a;

          /* Labels */
          --ac-user-label:    #22d3a0;
          --ac-ai-label:      #f59e0b;

          /* Math */
          --math-bg:          #14141a;
          --math-border:      #2a2a36;
          --inline-code-bg:   #1e1e26;
          --code-bg:          #13131a;
          --code-header-bg:   #1c1c24;
          --code-text:        #c8c8d8;

          /* Acções */
          --insert-bg:        rgba(34,211,160,0.1);
          --insert-border:    rgba(34,211,160,0.3);
          --replace-bg:       rgba(245,158,11,0.1);
          --replace-border:   rgba(245,158,11,0.3);

          /* Send */
          --send-stop-bg:     #2d1515;
          --send-stop-fg:     #f87171;
          --send-ready-bg:    #f59e0b;
          --send-ready-fg:    #0d0d0f;

          background: var(--ac-bg);
        }

        /* ── Layout ──────────────────────────────────── */
        .ac-chat-area  { background: var(--ac-bg); }
        .ac-history    { background: var(--ac-history-bg); border-right: 1px solid var(--ac-border); }

        /* ── Header ──────────────────────────────────── */
        .ac-header     { border-bottom: 1px solid var(--ac-border); }

        /* ── Tipografia ───────────────────────────────── */
        .ac-label-xs   { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.07em; }
        .ac-label-xxs  { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.05em; }
        .ac-accent     { color: var(--ac-accent); }
        .ac-faint      { color: var(--ac-text-faint); }
        .ac-user-label { color: var(--ac-user-label); text-transform: uppercase; }
        .ac-ai-label   { color: var(--ac-ai-label); text-transform: uppercase; }

        /* ── Badge ────────────────────────────────────── */
        .ac-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          padding: 2px 6px;
          border: 1px solid var(--ac-border);
          border-radius: 4px;
          background: var(--ac-input-bg);
          color: var(--ac-text-faint);
        }

        /* ── Botões base ──────────────────────────────── */
        .ac-btn-ghost {
          font-family: 'JetBrains Mono', monospace;
          border: 1px solid var(--ac-border);
          border-radius: 5px;
          background: transparent;
          color: var(--ac-text-muted);
          cursor: pointer;
          transition: all 0.12s;
        }
        .ac-btn-ghost:hover {
          border-color: var(--ac-accent);
          color: var(--ac-accent);
        }
        .ac-btn-close {
          background: none; border: none; cursor: pointer;
          color: var(--ac-text-faint); padding: 0 2px;
          font-size: 16px; line-height: 1;
          transition: color 0.12s;
        }
        .ac-btn-close:hover { color: var(--ac-red); }

        .ac-btn-icon {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          border: 1px solid var(--ac-border);
          border-radius: 6px;
          background: transparent;
          color: var(--ac-text-muted);
          cursor: pointer; flex-shrink: 0;
          transition: all 0.15s;
        }
        .ac-btn-icon:hover { border-color: var(--ac-accent); color: var(--ac-accent); }
        .ac-btn-icon-active {
          border-color: var(--ac-accent);
          background: var(--ac-accent-dim);
          color: var(--ac-accent);
        }

        /* ── Avatar IA ────────────────────────────────── */
        .ac-ai-avatar {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: var(--ac-accent-dim);
          border: 1px solid rgba(245,158,11,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 8px; color: var(--ac-accent);
          flex-shrink: 0;
        }

        /* ── Bolhas ────────────────────────────────────── */
        .ac-bubble-user,
        .ac-bubble-ai {
          border-radius: 10px;
          padding: 11px 14px;
          border: 1px solid;
        }
        .ac-bubble-user {
          background: var(--ac-user-bg);
          border-color: var(--ac-user-border);
          border-radius: 10px 10px 2px 10px;
        }
        .ac-bubble-ai {
          background: var(--ac-ai-bg);
          border-color: var(--ac-ai-border);
          border-radius: 10px 10px 10px 2px;
        }

        /* ── Dots de streaming ───────────────────────── */
        .ac-dot {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--ac-accent);
          opacity: 0.7;
          animation: acDotBounce 1.2s ease-in-out infinite;
        }
        @keyframes acDotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40%           { transform: scale(1);   opacity: 1; }
        }

        /* ── Botões de acção ─────────────────────────── */
        .ac-action-btn {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.12s;
          letter-spacing: 0.02em;
          border: 1px solid;
        }
        .ac-action-neutral {
          color: var(--ac-text-muted);
          border-color: var(--ac-border);
          background: transparent;
        }
        .ac-action-neutral:hover { color: var(--ac-text); border-color: var(--ac-text-muted); }
        .ac-action-green {
          color: var(--ac-green);
          border-color: rgba(34,211,160,0.3);
          background: transparent;
        }
        .ac-action-green:hover { background: var(--ac-green-dim); }
        .ac-action-accent {
          color: var(--ac-accent);
          border-color: rgba(245,158,11,0.3);
          background: transparent;
        }
        .ac-action-accent:hover { background: var(--ac-accent-dim); }

        /* ── Barra rápida ─────────────────────────────── */
        .ac-quick-bar {
          padding: 9px 13px;
          border-top: 1px solid var(--ac-border-alt);
        }
        .ac-quick-btn {
          flex: 1;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.03em;
          padding: 7px 10px;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.12s;
          border: 1px solid;
        }
        .ac-quick-green {
          color: var(--ac-green);
          background: var(--insert-bg);
          border-color: var(--insert-border);
        }
        .ac-quick-green:hover { background: rgba(34,211,160,0.16); }
        .ac-quick-accent {
          color: var(--ac-accent);
          background: var(--replace-bg);
          border-color: var(--replace-border);
        }
        .ac-quick-accent:hover { background: rgba(245,158,11,0.16); }

        /* ── Input row ────────────────────────────────── */
        .ac-input-row { border-top: 1px solid var(--ac-border); }
        .ac-textarea {
          flex: 1; resize: none;
          font-family: 'JetBrains Mono', monospace;
          line-height: 1.55;
          letter-spacing: 0.02em;
          padding: 9px 11px;
          border: 1px solid var(--ac-border);
          border-radius: 8px;
          background: var(--ac-input-bg);
          color: var(--ac-text);
          outline: none;
          caret-color: var(--ac-accent);
          transition: border-color 0.15s;
        }
        .ac-textarea::placeholder { color: var(--ac-text-faint); }
        .ac-textarea:focus { border-color: var(--ac-accent); }

        .ac-send-btn {
          flex-shrink: 0; border-radius: 8px; border: none;
          cursor: pointer; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .ac-send-idle    { background: var(--ac-input-bg); color: var(--ac-text-faint); }
        .ac-send-ready   { background: var(--send-ready-bg); color: var(--send-ready-fg); }
        .ac-send-ready:hover { filter: brightness(1.1); }
        .ac-send-stop    { background: var(--send-stop-bg); color: var(--send-stop-fg); }

        /* ── Histórico ────────────────────────────────── */
        .ac-history-header { border-bottom: 1px solid var(--ac-border); }
        .ac-search-input {
          width: 100%;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 6px 10px;
          border: 1px solid var(--ac-border);
          border-radius: 6px;
          background: var(--ac-input-bg);
          color: var(--ac-text);
          outline: none;
          transition: border-color 0.15s;
        }
        .ac-search-input::placeholder { color: var(--ac-text-faint); }
        .ac-search-input:focus { border-color: var(--ac-accent); }

        .ac-session-item {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid var(--ac-border-sub);
          transition: background 0.1s;
        }
        .ac-session-item:hover { background: var(--ac-hover); }
        .ac-session-active { background: var(--ac-active); }

        .ac-session-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ac-text-muted);
          line-height: 1.4;
          flex: 1;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin: 0;
        }

        .ac-empty-state {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-align: center;
          margin-top: 24px;
          color: var(--ac-text-faint);
        }

        /* ── Empty state ──────────────────────────────── */
        .ac-empty-hint {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          line-height: 1.75;
          color: var(--ac-text-muted);
        }
        .ac-suggestion {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 8px 11px;
          text-align: left;
          border: 1px solid var(--ac-border);
          border-radius: 7px;
          background: var(--ac-input-bg);
          color: var(--ac-text-muted);
          cursor: pointer;
          line-height: 1.45;
          transition: all 0.12s;
        }
        .ac-suggestion:hover {
          border-color: var(--ac-accent);
          color: var(--ac-text);
          background: var(--ac-hover);
        }
        .ac-link {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ac-accent);
          background: none; border: none;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .ac-link:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ActionButton({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: () => void;
  variant: 'neutral' | 'green' | 'accent';
}) {
  return (
    <button
      onClick={onClick}
      className={`ac-action-btn ac-action-${variant}`}
    >
      {label}
    </button>
  );
}
