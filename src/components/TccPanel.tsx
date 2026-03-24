// components/TccPanel.tsx  (versão actualizada — substitui o original)
// Adiciona o badge de compressão de contexto no header do painel.

'use client';

import { useState, useEffect, useRef } from 'react';
import { useTccSession } from '@/hooks/useTccSession';
import { ContextCompressionBadge } from '@/components/ContextCompressionBadge';
import type { TccSection } from '@/lib/tcc/types';

interface Props {
  onInsert: (text: string) => void;
  onTopicChange: (topic: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

const C = {
  bg:       '#0b0d0b',
  surface:  '#111411',
  border:   '#1e2a1e',
  accent:   '#6a9e5f',
  accentDim:'#6a9e5f44',
  muted:    '#4a6644',
  text:     '#d0dcc8',
  textDim:  '#7a9272',
  textFaint:'#3a4e36',
  gold:     '#c9a96e',
};

export function TccPanel({ onInsert, onTopicChange, onClose, isMobile = false }: Props) {
  const {
    step, session, outline, streamingText, activeSectionIdx, error,
    recentSessions, compressionStatus,
    startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession, reset,
  } = useTccSession();

  const [topicInput, setTopicInput]   = useState('');
  const [outlineEdit, setOutlineEdit] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, step]);

  useEffect(() => {
    if (step === 'review_outline') setOutlineEdit(outline);
  }, [step, outline]);

  useEffect(() => {
    if (showSessions) loadSessions();
  }, [showSessions, loadSessions]);

  const handleTopicSubmit = () => {
    const topic = topicInput.trim();
    if (!topic) return;
    onTopicChange(topic);
    submitTopic(topic);
  };

  const statusLabel = (s: TccSection) => {
    if (s.status === 'inserted')  return { label: 'Inserido ✓', color: C.gold };
    if (s.status === 'developed') return { label: 'Desenvolvido', color: C.accent };
    return { label: 'Pendente', color: C.muted };
  };

  const progressPct = session?.sections.length
    ? Math.round(
        (session.sections.filter(s => s.status !== 'pending').length /
          session.sections.length) * 100,
      )
    : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.bg, borderLeft: isMobile ? 'none' : `1px solid ${C.border}`,
    }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
        padding: isMobile ? '0.75rem 0.85rem' : '0.75rem 1rem',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        background: 'rgba(11,13,11,0.95)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '16px' }}>📝</span>
            <span style={{ fontSize: '13px', fontFamily: 'monospace', color: C.accent, letterSpacing: '0.06em' }}>
              Modo TCC
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {session && (
              <button onClick={reset} style={ghostBtn(C.muted)} title="Nova sessão">↩</button>
            )}
            <button onClick={onClose} style={ghostBtn('#5a5248')} title="Fechar">×</button>
          </div>
        </div>

        {/* Badge de compressão — aparece quando activo */}
        <ContextCompressionBadge status={compressionStatus} />
      </div>

      {/* ── Barra de progresso ───────────────────────────────────────────────── */}
      {session && session.sections.length > 0 && (
        <div style={{ flexShrink: 0, padding: '0.5rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, letterSpacing: '0.08em' }}>
              PROGRESSO DO TCC
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

      {/* ── Conteúdo principal ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: isMobile ? '0.85rem' : '1rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>

        {/* IDLE */}
        {step === 'idle' && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
            <p style={{ color: C.textDim, fontSize: '13px', fontFamily: 'monospace', lineHeight: 1.65, marginBottom: '1.5rem' }}>
              O modo TCC acompanha-te do esboço<br />à conclusão, secção a secção.<br />
              <span style={{ color: C.textFaint, fontSize: '11px' }}>
                Compressão de contexto automática — sem limites de janela.
              </span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Btn onClick={() => { startNew(); setShowSessions(false); }} color={C.accent}>
                ✦ Iniciar novo TCC
              </Btn>
              <Btn onClick={() => setShowSessions(v => !v)} color={C.muted} outline>
                ↩ Retomar sessão anterior
              </Btn>
            </div>

            {showSessions && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {recentSessions.length === 0 && (
                  <p style={{ color: C.textFaint, fontSize: '11px', fontFamily: 'monospace' }}>
                    Nenhuma sessão anterior encontrada.
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
        {step === 'new_or_resume' && (
          <TopicInput
            value={topicInput}
            onChange={setTopicInput}
            onSubmit={handleTopicSubmit}
            isMobile={isMobile}
          />
        )}

        {/* GERANDO ESBOÇO */}
        {step === 'generating_outline' && (
          <div>
            <Label>A gerar esboço estrutural…</Label>
            <StreamBox text={streamingText} />
          </div>
        )}

        {/* REVER ESBOÇO */}
        {step === 'review_outline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Label>Revê o esboço gerado. Podes editar directamente antes de aprovar.</Label>
            <textarea
              value={outlineEdit}
              onChange={e => setOutlineEdit(e.target.value)}
              rows={18}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
                color: C.text, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.65,
                padding: '0.75rem', outline: 'none', resize: 'vertical', caretColor: C.accent,
              }}
              onFocus={e => (e.target.style.borderColor = C.accentDim)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn onClick={() => approveOutline()} color={C.accent} flex>✓ Aprovar esboço</Btn>
              <Btn onClick={requestNewOutline} color={C.muted} outline flex>↻ Gerar novo</Btn>
            </div>
          </div>
        )}

        {/* LISTA DE SECÇÕES */}
        {(step === 'outline_approved' || step === 'section_ready') && session && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label>Esboço aprovado. Selecciona uma secção para desenvolver.</Label>

            {session.sections.map(sec => {
              const { label, color } = statusLabel(sec);
              const isActive = activeSectionIdx === sec.index;
              // Indicador visual se esta secção já está no resumo
              const isCompressed =
                compressionStatus.active &&
                compressionStatus.coveredUpTo !== null &&
                sec.index <= compressionStatus.coveredUpTo;

              return (
                <div key={sec.index} style={{
                  background: isActive ? `${C.accent}11` : C.surface,
                  border: `1px solid ${isActive ? C.accentDim : C.border}`,
                  borderRadius: '6px', padding: '0.65rem 0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '0.5rem', transition: 'all 0.15s',
                  opacity: isCompressed ? 0.75 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: C.text, fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>
                        {sec.title}
                      </span>
                      {/* Ícone discreto para secções já no resumo */}
                      {isCompressed && (
                        <span title="Secção no resumo de contexto" style={{
                          fontSize: '9px', color: C.textFaint,
                          border: `1px solid ${C.border}`, borderRadius: '2px',
                          padding: '0 3px', fontFamily: 'monospace',
                        }}>∑</span>
                      )}
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

            {session.status === 'completed' && (
              <div style={{
                marginTop: '0.5rem', padding: '0.75rem', borderRadius: '6px',
                background: `${C.accent}18`, border: `1px solid ${C.accentDim}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🎓</div>
                <div style={{ color: C.accent, fontSize: '12px', fontFamily: 'monospace' }}>
                  TCC concluído! Todas as secções desenvolvidas.
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
                A desenvolver: <span style={{ color: C.accent }}>
                  {session.sections.find(s => s.index === activeSectionIdx)?.title}
                </span>
              </Label>
            )}
            {compressionStatus.justCompressed && (
              <div style={{
                marginBottom: '0.5rem', padding: '0.4rem 0.7rem', borderRadius: '4px',
                background: '#c9a96e11', border: '1px solid #c9a96e33',
                fontSize: '10px', fontFamily: 'monospace', color: C.gold,
              }}>
                ✦ Contexto comprimido automaticamente para optimizar a janela de tokens
              </div>
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
                {session.sections.find(s => s.index === activeSectionIdx)?.title}
              </span>
            </Label>
            <div style={{
              maxHeight: '260px', overflowY: 'auto',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: '5px', padding: '0.75rem',
              color: C.text, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
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

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TopicInput({
  value, onChange, onSubmit, isMobile,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; isMobile: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Label>Qual é o tópico do teu TCC?</Label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
        placeholder="Ex: O impacto das tecnologias digitais na educação básica em Moçambique"
        rows={4} autoFocus
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
          color: C.text, fontFamily: 'monospace', fontSize: '12px',
          padding: '0.75rem', outline: 'none', resize: 'none', lineHeight: 1.6, caretColor: C.accent,
        }}
        onFocus={e => (e.target.style.borderColor = C.accentDim)}
        onBlur={e  => (e.target.style.borderColor = C.border)}
      />
      <Btn onClick={onSubmit} color={C.accent} disabled={!value.trim()}>✦ Gerar esboço</Btn>
    </div>
  );
}

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
    width: 28, height: 28, borderRadius: '4px', border: `1px solid ${color}44`,
    background: 'transparent', color, fontFamily: 'monospace', fontSize: '13px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
