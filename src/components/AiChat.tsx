'use client';

// AiChat.tsx — versão redesenhada com histórico de conversas persistente
//
// MELHORIAS:
//  1. Histórico de sessões gravado em localStorage (últimas 20 conversas)
//  2. Painel de histórico lateral deslizante
//  3. UI completamente redesenhada: bubbles com avatar, timestamps, animações suaves
//  4. Botão "Nova conversa" com confirmação
//  5. Busca no histórico
//  6. Cada sessão tem título gerado automaticamente (primeiras palavras do utilizador)
//  7. Indicador de streaming melhorado (dots animados)
//  8. Copy para clipboard em cada mensagem assistente
//  9. Token count estimado por sessão
// 10. Atalho Ctrl+K para abrir histórico

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
  } catch {
    // quota exceeded — ignorar
  }
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

  // ── Carregar histórico na montagem ────────────────────────────────────────

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  // ── Scroll automático ──────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Ctrl+K abre histórico ──────────────────────────────────────────────────

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

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => () => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  // ── Persiste sessão corrente no histórico ──────────────────────────────────

  const persistSession = useCallback((
    id: string,
    msgs: Message[],
    existingSessions: ChatSession[],
  ) => {
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

  // ── Nova conversa ──────────────────────────────────────────────────────────

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

  // ── Retomar sessão do histórico ────────────────────────────────────────────

  const resumeSession = useCallback((session: ChatSession) => {
    if (messages.length > 0 && currentSessionId) {
      setSessions(prev => persistSession(currentSessionId, messages, prev));
    }
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [messages, currentSessionId, persistSession]);

  // ── Eliminar sessão ────────────────────────────────────────────────────────

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

  // ── Copy mensagem ──────────────────────────────────────────────────────────

  const copyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgIdx(idx);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedMsgIdx(null), 1800);
    });
  }, []);

  // ── Enviar mensagem ────────────────────────────────────────────────────────

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
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--chat-bg)' }}>

      {/* ── Painel de histórico (deslizante) ────────────────────────────────── */}
      {showHistory && (
        <div
          className="flex flex-col border-r"
          style={{
            width: isMobile ? '100%' : '240px',
            flexShrink: 0,
            background: 'var(--history-bg)',
            borderColor: 'var(--chat-border)',
            position: isMobile ? 'absolute' : 'relative',
            inset: isMobile ? 0 : 'auto',
            zIndex: isMobile ? 10 : 'auto',
          }}
        >
          {/* Header do histórico */}
          <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '1px solid var(--chat-border)' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.06em', color: 'var(--chat-accent)' }}>
              HISTÓRICO
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={startNewSession}
                title="Nova conversa"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  padding: '3px 8px',
                  border: '1px solid var(--chat-border)',
                  borderRadius: 5,
                  background: 'transparent',
                  color: 'var(--chat-accent)',
                  cursor: 'pointer',
                }}
              >
                + Nova
              </button>
              {isMobile && (
                <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--chat-text-muted)', padding: '0 2px' }}>×</button>
              )}
            </div>
          </div>

          {/* Busca */}
          <div className="px-3 py-2">
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Pesquisar…"
              style={{
                width: '100%',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                padding: '6px 10px',
                border: '1px solid var(--chat-border)',
                borderRadius: 6,
                background: 'var(--chat-input-bg)',
                color: 'var(--chat-text)',
                outline: 'none',
              }}
            />
          </div>

          {/* Lista de sessões */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredSessions.length === 0 && (
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textAlign: 'center', marginTop: 24, color: 'var(--chat-text-faint)' }}>
                {historySearch ? 'Nenhum resultado' : 'Sem conversas ainda.'}
              </p>
            )}
            {filteredSessions.map(s => (
              <div
                key={s.id}
                onClick={() => resumeSession(s)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--chat-border-subtle)',
                  background: currentSessionId === s.id ? 'var(--chat-active-bg)' : 'transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (currentSessionId !== s.id) (e.currentTarget as HTMLElement).style.background = 'var(--chat-hover-bg)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = currentSessionId === s.id ? 'var(--chat-active-bg)' : 'transparent'; }}
              >
                <div className="flex items-start justify-between gap-1">
                  <p style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    color: currentSessionId === s.id ? 'var(--chat-accent)' : 'var(--chat-text)',
                    lineHeight: 1.4,
                    flex: 1,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    margin: 0,
                  }}>
                    {s.title}
                  </p>
                  <button
                    onClick={e => deleteSession(s.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      lineHeight: 1,
                      color: 'var(--chat-text-faint)',
                      padding: '0 2px',
                      flexShrink: 0,
                      marginTop: -1,
                    }}
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--chat-text-faint)' }}>
                    {formatRelativeTime(s.updatedAt)}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--chat-text-faint)' }}>
                    · ~{s.tokenEstimate} tok
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Área de chat ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--chat-bg)' }}>

        {/* Header */}
        <div
          className="flex shrink-0 items-center gap-2 px-3 py-3"
          style={{ borderBottom: '1px solid var(--chat-border)' }}
        >
          {/* Botão histórico */}
          <button
            onClick={() => setShowHistory(v => !v)}
            title="Histórico de conversas (Ctrl+K)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: `1px solid ${showHistory ? 'var(--chat-accent)' : 'var(--chat-border)'}`,
              borderRadius: 6,
              background: showHistory ? 'var(--chat-accent-dim)' : 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            aria-label="Abrir histórico"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="1.5" rx="0.75" fill={showHistory ? 'var(--chat-accent)' : 'var(--chat-text-muted)'} />
              <rect x="1" y="6.25" width="8" height="1.5" rx="0.75" fill={showHistory ? 'var(--chat-accent)' : 'var(--chat-text-muted)'} />
              <rect x="1" y="10.5" width="10" height="1.5" rx="0.75" fill={showHistory ? 'var(--chat-accent)' : 'var(--chat-text-muted)'} />
            </svg>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span style={{ fontSize: '1rem' }}>✦</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--chat-accent)',
              whiteSpace: 'nowrap',
            }}>
              IA · MATEMÁTICA
            </span>
            {messages.length > 0 && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: 'var(--chat-text-faint)',
                background: 'var(--chat-input-bg)',
                border: '1px solid var(--chat-border)',
                borderRadius: 4,
                padding: '2px 6px',
                whiteSpace: 'nowrap',
              }}>
                {messages.length} msg
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={startNewSession}
                title="Nova conversa"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  padding: '3px 8px',
                  border: '1px solid var(--chat-border)',
                  borderRadius: 5,
                  background: 'transparent',
                  color: 'var(--chat-text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s',
                }}
              >
                + Nova
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--chat-text-faint)', padding: '0 2px' }}
              aria-label="Fechar chat"
            >
              ×
            </button>
          </div>
        </div>

        {/* Área de mensagens */}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-3 py-4" style={{ gap: '1.2rem', display: 'flex', flexDirection: 'column' }}>

          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>✦</div>
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--chat-text-faint)',
                marginBottom: 20,
              }}>
                Descreve o conteúdo que queres gerar.<br />
                A IA devolve Markdown com equações LaTeX<br />
                prontas para exportar para Word.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: isMobile ? 10 : 11,
                      padding: isMobile ? '9px 10px' : '7px 10px',
                      textAlign: 'left',
                      border: '1px solid var(--chat-border)',
                      borderRadius: 7,
                      background: 'var(--chat-input-bg)',
                      color: 'var(--chat-text-muted)',
                      cursor: 'pointer',
                      lineHeight: 1.45,
                      transition: 'background 0.12s, color 0.12s',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sessions.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    marginTop: 16,
                    color: 'var(--chat-accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  ↩ Retomar conversa anterior ({sessions.length})
                </button>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && i === messages.length - 1;
            const isStreaming = isLastAssistant && streaming;

            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Rótulo + timestamp */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}>
                  {!isUser && (
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'var(--chat-accent-dim)',
                      border: '1px solid var(--chat-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: 'var(--chat-accent)',
                      flexShrink: 0,
                    }}>
                      ✦
                    </div>
                  )}
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    color: isUser ? 'var(--chat-user-label)' : 'var(--chat-assistant-label)',
                    textTransform: 'uppercase',
                  }}>
                    {isUser ? 'Tu' : 'IA'}
                  </span>
                  {msg.timestamp && (
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9,
                      color: 'var(--chat-text-faint)',
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Bolha de mensagem */}
                <div style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isMobile ? '100%' : '92%',
                  border: '1px solid',
                  borderColor: isUser ? 'var(--chat-border)' : 'var(--chat-border-alt)',
                  background: isUser ? 'var(--chat-user-bg)' : 'var(--chat-assistant-bg)',
                  borderRadius: isUser ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                  padding: '10px 13px',
                }}>
                  <ChatMessageContent content={msg.content} role={msg.role} />
                  {isStreaming && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(dot => (
                        <span
                          key={dot}
                          style={{
                            display: 'inline-block',
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'var(--chat-accent)',
                            opacity: 0.7,
                            animation: `chatDotBounce 1.2s ease-in-out ${dot * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Acções da mensagem assistente */}
                {!isUser && !isStreaming && msg.content && (
                  <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-start', marginTop: 2 }}>
                    <ActionButton
                      label={copiedMsgIdx === i ? '✓ Copiado' : 'Copiar'}
                      onClick={() => copyMessage(msg.content, i)}
                      accent="var(--chat-text-muted)"
                    />
                    {isLastAssistant && (
                      <>
                        <ActionButton
                          label={recentAction === 'insert' ? '✓ Inserido' : '↓ Inserir'}
                          onClick={() => handleInsert(msg.content)}
                          accent="var(--chat-green)"
                        />
                        <ActionButton
                          label={recentAction === 'replace' ? '✓ Substituído' : '⟳ Substituir'}
                          onClick={() => handleReplace(msg.content)}
                          accent="var(--chat-accent)"
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

        {/* Barra de acções rápidas (última mensagem assistente) */}
        {lastAssistant && !streaming && messages.length > 0 && (
          <div
            className="flex shrink-0 gap-2"
            style={{
              padding: isMobile ? '10px 13px' : '8px 12px',
              borderTop: '1px solid var(--chat-border-alt)',
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <button
              onClick={() => handleInsert(lastAssistant)}
              style={quickActionStyle('var(--chat-green)', 'var(--insert-bg)', 'var(--insert-border)')}
            >
              {recentAction === 'insert' ? '✓ Inserido no editor' : '↓ Inserir no editor'}
            </button>
            <button
              onClick={() => handleReplace(lastAssistant)}
              style={quickActionStyle('var(--chat-accent)', 'var(--replace-bg)', 'var(--replace-border)')}
            >
              {recentAction === 'replace' ? '✓ Editor substituído' : '⟳ Substituir editor'}
            </button>
          </div>
        )}

        {/* Input */}
        <div
          className="flex shrink-0 items-end gap-2"
          style={{
            padding: isMobile
              ? '12px 13px calc(12px + env(safe-area-inset-bottom, 0px))'
              : '10px 12px',
            borderTop: '1px solid var(--chat-border)',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreve o conteúdo a gerar… (Enter para enviar)"
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              letterSpacing: '0.02em',
              padding: isMobile ? '10px' : '8px 10px',
              border: '1px solid var(--chat-border)',
              borderRadius: 7,
              background: 'var(--chat-input-bg)',
              color: 'var(--chat-text)',
              outline: 'none',
              caretColor: 'var(--chat-accent)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--chat-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--chat-border)')}
          />
          <AudioInputButton
            onTranscription={text => setInput(prev => prev ? `${prev} ${text}` : text)}
            disabled={streaming}
            className={`border-[var(--chat-border)] ${isMobile ? 'h-[42px] w-[42px] text-base' : 'h-9 w-9 text-sm'}`}
            title="Gravar mensagem"
          />
          <button
            onClick={streaming ? () => abortRef.current?.abort() : send}
            title={streaming ? 'Parar' : 'Enviar'}
            aria-label={streaming ? 'Parar geração' : 'Enviar mensagem'}
            style={{
              width: isMobile ? 42 : 36,
              height: isMobile ? 42 : 36,
              flexShrink: 0,
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              background: streaming
                ? 'var(--send-stop-bg)'
                : input.trim()
                  ? 'var(--send-ready-bg)'
                  : 'var(--chat-input-bg)',
              color: streaming
                ? 'var(--send-stop-fg)'
                : input.trim()
                  ? 'var(--send-ready-fg)'
                  : 'var(--chat-text-faint)',
            }}
          >
            {streaming ? '■' : '↑'}
          </button>
        </div>
      </div>

      {/* CSS variables + animações */}
      <style>{`
        .chat-root {
          --chat-bg: #131313;
          --history-bg: #0e0e0e;
          --chat-surface: #1c1c1c;
          --chat-input-bg: #1e1e1e;
          --chat-border: #2f2f2f;
          --chat-border-alt: #252525;
          --chat-border-subtle: #1e1e1e;
          --chat-hover-bg: #1a1a1a;
          --chat-active-bg: #1e2a1e;
          --chat-accent: #f59e0b;
          --chat-accent-dim: #f59e0b22;
          --chat-green: #00d6a0;
          --chat-text: #e8e8e8;
          --chat-text-muted: #9a9a9a;
          --chat-text-faint: #505050;
          --chat-user-bg: #2a2a2a;
          --chat-assistant-bg: #1c1c1c;
          --chat-user-label: #f59e0b88;
          --chat-assistant-label: #00d6a088;
          --insert-bg: #00d6a022;
          --insert-border: #00d6a044;
          --replace-bg: #f59e0b22;
          --replace-border: #f59e0b44;
          --send-stop-bg: #3a1a1a;
          --send-stop-fg: #c9503a;
          --send-ready-bg: linear-gradient(135deg, #f59e0b, #f97316);
          --send-ready-fg: #131313;
        }
        @keyframes chatDotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ActionButton({ label, onClick, accent }: { label: string; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        padding: '3px 8px',
        border: `1px solid ${accent}44`,
        borderRadius: 5,
        background: 'transparent',
        color: accent,
        cursor: 'pointer',
        transition: 'all 0.12s',
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </button>
  );
}

function quickActionStyle(color: string, bg: string, border: string): CSSProperties {
  return {
    flex: 1,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.03em',
    padding: '6px 8px',
    border: `1px solid ${border}`,
    borderRadius: 6,
    background: bg,
    color: color,
    cursor: 'pointer',
    transition: 'all 0.12s',
  };
}
