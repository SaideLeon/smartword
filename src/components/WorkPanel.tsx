'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkSession } from '@/hooks/useWorkSession';
import { workTheme as C } from '@/lib/theme';

interface Props {
  onInsert: (text: string) => void;
  onTopicChange: (topic: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

export function WorkPanel({ onInsert, onTopicChange, onClose, isMobile = false }: Props) {
  const {
    step, session, streamingText, activeSectionIdx, error, progressPct, recentSessions,
    reset, startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession,
  } = useWorkSession();

  const [topicInput, setTopicInput] = useState('');
  const [outlineEdit, setOutlineEdit] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, step]);

  useEffect(() => {
    if (step === 'review_outline') setOutlineEdit(session?.outline_draft ?? '');
  }, [step, session]);

  useEffect(() => {
    if (showSessions) loadSessions();
  }, [showSessions, loadSessions]);

  const handleTopicSubmit = () => {
    const topic = topicInput.trim();
    if (!topic) return;
    onTopicChange(topic);
    submitTopic(topic);
  };

  const statusLabel = (status: string) => {
    if (status === 'inserted')  return { label: 'Inserido ✓', color: C.gold };
    if (status === 'developed') return { label: 'Desenvolvido', color: C.accent };
    return { label: 'Pendente', color: C.muted };
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.bg, borderLeft: isMobile ? 'none' : `1px solid ${C.border}`,
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0.75rem 0.85rem' : '0.75rem 1rem',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        background: 'rgba(10,13,10,0.95)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '16px' }}>📚</span>
          <span style={{ fontSize: '13px', fontFamily: 'monospace', color: C.accent, letterSpacing: '0.06em' }}>
            Trabalho Escolar
          </span>
          {session && (
            <span style={{
              fontSize: '10px', fontFamily: 'monospace', color: C.textFaint,
              background: C.surface, padding: '1px 6px', borderRadius: '3px',
              border: `1px solid ${C.border}`,
            }}>
              {session.topic.length > 28 ? session.topic.slice(0, 28) + '…' : session.topic}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {session && (
            <button onClick={reset} style={ghostBtn(C.muted)} title="Novo trabalho">↩</button>
          )}
          <button onClick={onClose} style={ghostBtn('#5a5248')} title="Fechar">×</button>
        </div>
      </div>

      {/* ── Barra de progresso ──────────────────────────────────────────── */}
      {session && (
        <div style={{ flexShrink: 0, padding: '0.5rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, letterSpacing: '0.08em' }}>
              PROGRESSO
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: C.accent }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ height: '3px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${C.muted}, ${C.accent})`,
              borderRadius: '2px', transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: isMobile ? '0.85rem' : '1rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>

        {/* IDLE */}
        {step === 'idle' && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
            <p style={{ color: C.textDim, fontSize: '13px', fontFamily: 'monospace', lineHeight: 1.65, marginBottom: '1.5rem' }}>
              Copiloto para trabalhos do ensino secundário e médio.<br />
              Gera e desenvolve cada secção do teu trabalho,<br />secção a secção.
            </p>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '0.75rem', marginBottom: '1.25rem',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                ESTRUTURA DO TRABALHO
              </div>
              {['Índice', 'Introdução', 'Objectivos e Metodologia', 'Desenvolvimento Teórico', 'Conclusão', 'Referências Bibliográficas'].map((s, i) => (
                <div key={i} style={{ color: C.textDim, fontSize: '11px', fontFamily: 'monospace', padding: '2px 0' }}>
                  {i + 1}. {s}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Btn onClick={() => { startNew(); setShowSessions(false); }} color={C.accent}>✦ Iniciar trabalho</Btn>
              <Btn onClick={() => setShowSessions(v => !v)} color={C.muted} outline>↩ Retomar trabalho</Btn>
            </div>

            {showSessions && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {recentSessions.length === 0 && (
                  <p style={{ color: C.textFaint, fontSize: '11px', fontFamily: 'monospace' }}>
                    Nenhum trabalho anterior encontrado.
                  </p>
                )}
                {recentSessions.map(s => (
                  <button key={s.id} onClick={() => { onTopicChange(s.topic); resumeSession(s.id); }} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
                    padding: '0.6rem 0.85rem', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = C.accentDim)}
                  onMouseOut={e  => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <div>
                      <div style={{ color: C.text, fontSize: '12px', fontFamily: 'monospace' }}>{s.topic}</div>
                      <div style={{ color: C.textFaint, fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>
                        {new Date(s.updated_at).toLocaleDateString('pt-PT')}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px', fontFamily: 'monospace',
                      color: s.status === 'completed' ? C.accent : C.muted,
                      padding: '2px 6px', border: '1px solid currentColor', borderRadius: '3px',
                    }}>
                      {s.status === 'completed' ? 'Concluído' :
                       s.status === 'in_progress' ? 'Em curso' :
                       s.status === 'outline_approved' ? 'Aprovado' : 'Esboço'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOPIC INPUT */}
        {step === 'topic_input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Label>Qual é o tema do trabalho?</Label>
            <textarea
              value={topicInput}
              onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }}
              placeholder="Ex: A importância da água potável para a saúde pública em Moçambique"
              rows={4} autoFocus
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
                color: C.text, fontFamily: 'monospace', fontSize: '12px',
                padding: '0.75rem', outline: 'none', resize: 'none', lineHeight: 1.6,
                caretColor: C.accent,
              }}
              onFocus={e => (e.target.style.borderColor = C.accentDim)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
            <Btn onClick={handleTopicSubmit} color={C.accent} disabled={!topicInput.trim()}>
              ✦ Gerar esboço orientador
            </Btn>
          </div>
        )}

        {/* GERANDO ESBOÇO */}
        {step === 'generating_outline' && (
          <div>
            <Label>A gerar esboço orientador…</Label>
            <StreamBox text={streamingText} />
          </div>
        )}

        {/* REVER ESBOÇO */}
        {step === 'review_outline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Label>Esboço gerado. Podes editar antes de aprovar.</Label>
            <textarea
              value={outlineEdit}
              onChange={e => setOutlineEdit(e.target.value)}
              rows={16}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
                color: C.text, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.65,
                padding: '0.75rem', outline: 'none', resize: 'vertical', caretColor: C.accent,
              }}
              onFocus={e => (e.target.style.borderColor = C.accentDim)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn onClick={() => approveOutline(outlineEdit)} color={C.accent} flex>✓ Aprovar esboço</Btn>
              <Btn onClick={requestNewOutline} color={C.muted} outline flex>↻ Gerar novo</Btn>
            </div>
          </div>
        )}

        {/* LISTA DE SECÇÕES */}
        {(step === 'outline_approved' || step === 'section_ready') && session && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label>Esboço aprovado. Selecciona uma secção para desenvolver.</Label>

            {session.sections.map(sec => {
              const { label, color } = statusLabel(sec.status);
              const isActive = activeSectionIdx === sec.index;
              return (
                <div key={sec.index} style={{
                  background: isActive ? `${C.accent}11` : C.surface,
                  border: `1px solid ${isActive ? C.accentDim : C.border}`,
                  borderRadius: '6px', padding: '0.65rem 0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '0.5rem', transition: 'all 0.15s',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>
                      {sec.title}
                    </div>
                    <div style={{ color, fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>
                      {label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    {sec.status !== 'pending' && (
                      <button
                        onClick={() => insertSection(sec.index, onInsert)}
                        style={smallBtn(C.gold)} title="Inserir no editor"
                      >↓</button>
                    )}
                    <button
                      onClick={() => developSection(sec.index)}
                      style={smallBtn(C.accent)}
                      title={sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'}
                    >
                      {sec.status === 'pending' ? '✦' : '↻'}
                    </button>
                  </div>
                </div>
              );
            })}

            {progressPct === 100 && (
              <div style={{
                marginTop: '0.5rem', padding: '0.75rem', borderRadius: '6px',
                background: `${C.accent}18`, border: `1px solid ${C.accentDim}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🎓</div>
                <div style={{ color: C.accent, fontSize: '12px', fontFamily: 'monospace' }}>
                  Trabalho concluído! Todas as secções desenvolvidas.
                </div>
              </div>
            )}
          </div>
        )}

        {/* A DESENVOLVER */}
        {step === 'developing' && (
          <div>
            {session && activeSectionIdx !== null && (
              <Label>
                A desenvolver:{' '}
                <span style={{ color: C.accent }}>
                  {session.sections[activeSectionIdx]?.title}
                </span>
              </Label>
            )}
            <StreamBox text={streamingText} />
          </div>
        )}

        {/* SECÇÃO PRONTA */}
        {step === 'section_ready' && session && activeSectionIdx !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Label>
              Secção pronta:{' '}
              <span style={{ color: C.accent }}>
                {session.sections[activeSectionIdx]?.title}
              </span>
            </Label>
            <div style={{
              maxHeight: '260px', overflowY: 'auto',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: '5px', padding: '0.75rem',
              color: C.text, fontFamily: 'monospace', fontSize: '11px',
              lineHeight: 1.65, whiteSpace: 'pre-wrap',
            }}>
              {streamingText}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn onClick={() => insertSection(activeSectionIdx, onInsert)} color={C.accent} flex>
                ↓ Inserir no editor
              </Btn>
              <Btn onClick={backToOutline} color={C.muted} outline flex>← Voltar</Btn>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div style={{
            padding: '0.65rem 0.85rem', borderRadius: '5px',
            background: '#3a0a0a', border: '1px solid #6a2020',
            color: '#e07070', fontFamily: 'monospace', fontSize: '11px',
          }}>
            ⚠ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function StreamBox({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: '0.5rem', maxHeight: '380px', overflowY: 'auto',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
      padding: '0.75rem', color: C.text, fontFamily: 'monospace',
      fontSize: '11px', lineHeight: 1.7, whiteSpace: 'pre-wrap',
    }}>
      {text || (
        <span style={{ color: C.textFaint }}>
          <span style={{ animation: 'blink 1s step-end infinite', display: 'inline-block' }}>▋</span>
        </span>
      )}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      color: C.textDim, fontSize: '11px', fontFamily: 'monospace',
      lineHeight: 1.55, margin: 0, letterSpacing: '0.02em',
    }}>
      {children}
    </p>
  );
}

function Btn({
  onClick, color, children, outline, flex, disabled,
}: {
  onClick: () => void; color: string; children: React.ReactNode;
  outline?: boolean; flex?: boolean; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className="press-feedback"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: flex ? 1 : 'none',
        background: outline ? 'transparent' : hov ? color : `${color}cc`,
        border: `1px solid ${color}${outline ? '88' : '00'}`,
        borderRadius: '5px', color: outline ? color : '#0f0e0d',
        fontFamily: 'monospace', fontSize: '12px', padding: '8px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        letterSpacing: '0.04em', transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function smallBtn(color: string): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: '4px',
    border: `1px solid ${color}44`, background: 'transparent', color,
    fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };
}

function ghostBtn(color: string): React.CSSProperties {
  return {
    background: 'none', border: 'none', color,
    cursor: 'pointer', fontSize: '18px', lineHeight: 1,
    padding: '2px 6px', borderRadius: '3px',
  };
}
