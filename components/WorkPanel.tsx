'use client';

import { useState } from 'react';
import { useWorkSession, WorkType, WorkConfig } from '@/hooks/useWorkSession';

interface Props {
  onInsert: (text: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

const C = {
  bg: '#0a0d0a',
  surface: '#111611',
  border: '#1a2a1a',
  accent: '#5a9e8f',
  accentDim: '#5a9e8f44',
  muted: '#3a6e60',
  text: '#c8dcd6',
  textDim: '#6a9e90',
  textFaint: '#2a4e44',
  gold: '#c9a96e',
  red: '#9e5a5a',
};

const WORK_TYPES: { type: WorkType; icon: string; label: string; desc: string }[] = [
  { type: 'grupo',      icon: '👥', label: 'Investigação em Grupo', desc: 'Grupos com membros e temas' },
  { type: 'individual', icon: '📄', label: 'Relatório Individual',  desc: 'Trabalho por aluno' },
  { type: 'resumo',     icon: '📋', label: 'Resumo / Síntese',      desc: 'Síntese de conteúdo' },
  { type: 'campo',      icon: '🔬', label: 'Trabalho de Campo',     desc: 'Investigação prática' },
];

export function WorkPanel({ onInsert, onClose, isMobile = false }: Props) {
  const {
    step, config, session, streamingText, activeSectionIdx, error, progressPct,
    reset, startConfig, generateWork, approveOutline, developSection,
    insertSection, insertEnunciado, backToOutline,
  } = useWorkSession();

  const [form, setForm] = useState<WorkConfig>({
    type: 'grupo',
    school: '',
    course: '',
    subject: '',
    module: '',
    className: '',
    deliveryDate: '',
    numGroups: 5,
    membersPerGroup: 5,
    customTopics: '',
    formatorName: '',
    formatorContact: '',
  });

  const handleFormChange = (k: keyof WorkConfig, v: string | number) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const handleSubmit = () => {
    generateWork({ ...form, type: form.type });
  };

  const pct = progressPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
        padding: isMobile ? '0.75rem 0.85rem' : '0.75rem 1rem',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        background: 'rgba(10,13,10,0.95)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '16px' }}>📚</span>
            <span style={{ fontSize: '13px', fontFamily: 'monospace', color: C.accent, letterSpacing: '0.06em' }}>
              Trabalhos Académicos
            </span>
            {session && (
              <span style={{
                fontSize: '10px', fontFamily: 'monospace', color: C.textFaint,
                background: C.surface, padding: '1px 6px', borderRadius: '3px',
                border: `1px solid ${C.border}`,
              }}>
                {WORK_TYPES.find(w => w.type === session.config.type)?.label}
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
      </div>

      {/* Progress bar */}
      {session && session.sections.length > 0 && step === 'outline_approved' && (
        <div style={{ flexShrink: 0, padding: '0.5rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, letterSpacing: '0.08em' }}>PROGRESSO</span>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: C.accent }}>{pct}%</span>
          </div>
          <div style={{ height: '3px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.muted}, ${C.accent})`, borderRadius: '2px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0.85rem' : '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* IDLE — choose type */}
        {step === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Label>Que tipo de trabalho queres criar?</Label>
            {WORK_TYPES.map(w => (
              <button key={w.type} onClick={() => { setForm(p => ({ ...p, type: w.type })); startConfig(w.type); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px',
                  padding: '0.7rem 0.9rem', cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'border-color 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = C.accentDim)}
                onMouseOut={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{w.icon}</span>
                <div>
                  <div style={{ color: C.text, fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>{w.label}</div>
                  <div style={{ color: C.textFaint, fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>{w.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* CONFIG FORM */}
        {step === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <Label>
              {WORK_TYPES.find(w => w.type === form.type)?.icon}{' '}
              {WORK_TYPES.find(w => w.type === form.type)?.label} — Configuração
            </Label>

            <Field label="Nome da escola / instituto" value={form.school} onChange={v => handleFormChange('school', v)} placeholder="Ex: Instituto Politécnico de Negócios" />
            <Field label="Curso" value={form.course} onChange={v => handleFormChange('course', v)} placeholder="Ex: Técnico de Medicina Geral" />
            <Field label="Disciplina / Módulo" value={form.subject} onChange={v => handleFormChange('subject', v)} placeholder="Ex: Informática Básica" />
            <Field label="Número do módulo (opcional)" value={form.module} onChange={v => handleFormChange('module', v)} placeholder="Ex: Módulo Genérico 9" />
            <Field label="Turma" value={form.className} onChange={v => handleFormChange('className', v)} placeholder="Ex: Turma 29" />
            <Field label="Data de entrega" value={form.deliveryDate} onChange={v => handleFormChange('deliveryDate', v)} placeholder="Ex: 24 – 03 – 2026" />
            <Field label="Nome do formador" value={form.formatorName} onChange={v => handleFormChange('formatorName', v)} placeholder="Ex: Dr. Leonardo Mariano" />
            <Field label="Contacto do formador (opcional)" value={form.formatorContact} onChange={v => handleFormChange('formatorContact', v)} placeholder="Ex: 877588195 · email@gmail.com" />

            {form.type === 'grupo' && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Nº de grupos</FieldLabel>
                    <input type="number" min={1} max={20} value={form.numGroups}
                      onChange={e => handleFormChange('numGroups', parseInt(e.target.value) || 1)}
                      style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Membros por grupo</FieldLabel>
                    <input type="number" min={1} max={10} value={form.membersPerGroup}
                      onChange={e => handleFormChange('membersPerGroup', parseInt(e.target.value) || 1)}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Temas (opcional — 1 por linha)</FieldLabel>
                  <textarea value={form.customTopics} rows={4}
                    onChange={e => handleFormChange('customTopics', e.target.value)}
                    placeholder={'Evolução dos computadores\nSoftwares\nInternet\nNavegadores WEB\nCorreio electrónico'}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                  <div style={{ fontSize: '10px', color: C.textFaint, fontFamily: 'monospace', marginTop: '3px' }}>
                    Se vazio, a IA gera temas automaticamente.
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Btn onClick={handleSubmit} color={C.accent} flex disabled={!form.school || !form.course}>
                ✦ Gerar enunciado
              </Btn>
              <Btn onClick={reset} color={C.muted} outline>← Voltar</Btn>
            </div>
          </div>
        )}

        {/* GENERATING */}
        {step === 'generating_outline' && (
          <div>
            <Label>A gerar estrutura do trabalho…</Label>
            <StreamBox text={streamingText} />
          </div>
        )}

        {/* REVIEW */}
        {step === 'review_outline' && session && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Label>Enunciado e estrutura gerados. Revê antes de aprovar.</Label>

            {/* Groups preview */}
            {session.groups.length > 0 && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
                padding: '0.75rem', maxHeight: '200px', overflowY: 'auto',
              }}>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
                  GRUPOS GERADOS ({session.groups.length})
                </div>
                {session.groups.map(g => (
                  <div key={g.number} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ color: C.accent, fontSize: '11px', fontFamily: 'monospace', fontWeight: 500 }}>
                      {g.number}º — {g.topic}
                    </div>
                    <div style={{ color: C.textDim, fontSize: '10px', fontFamily: 'monospace' }}>
                      {g.members.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sections preview */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px', padding: '0.75rem' }}>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
                SECÇÕES A DESENVOLVER ({session.sections.length})
              </div>
              {session.sections.map((s, i) => (
                <div key={i} style={{ color: C.textDim, fontSize: '11px', fontFamily: 'monospace', padding: '2px 0' }}>
                  {i + 1}. {s.title}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn onClick={() => { insertEnunciado(onInsert); approveOutline(); }} color={C.gold} flex>
                ↓ Inserir enunciado no editor
              </Btn>
              <Btn onClick={approveOutline} color={C.accent} outline flex>
                ✓ Aprovar
              </Btn>
            </div>
          </div>
        )}

        {/* SECTIONS LIST */}
        {step === 'outline_approved' && session && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label>Selecciona uma secção para desenvolver.</Label>

            {/* Quick insert enunciado */}
            <button onClick={() => insertEnunciado(onInsert)} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'transparent', border: `1px solid ${C.gold}44`, borderRadius: '5px',
              padding: '0.5rem 0.75rem', cursor: 'pointer', color: C.gold,
              fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.04em',
              transition: 'border-color 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.borderColor = C.gold)}
            onMouseOut={e => (e.currentTarget.style.borderColor = `${C.gold}44`)}
            >
              <span>↓</span>
              <span>Inserir enunciado completo no editor</span>
            </button>

            {session.sections.map(sec => {
              const isActive = activeSectionIdx === sec.index;
              const statusColor = sec.status === 'inserted' ? C.gold : sec.status === 'developed' ? C.accent : C.muted;
              const statusLabel = sec.status === 'inserted' ? 'Inserido ✓' : sec.status === 'developed' ? 'Desenvolvido' : 'Pendente';
              return (
                <div key={sec.index} style={{
                  background: isActive ? `${C.accent}11` : C.surface,
                  border: `1px solid ${isActive ? C.accentDim : C.border}`,
                  borderRadius: '6px', padding: '0.65rem 0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>{sec.title}</div>
                    <div style={{ color: statusColor, fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>{statusLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    {sec.status !== 'pending' && (
                      <button onClick={() => insertSection(sec.index, onInsert)} style={smallBtn(C.gold)} title="Inserir no editor">↓</button>
                    )}
                    <button onClick={() => developSection(sec.index)} style={smallBtn(C.accent)}
                      title={sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'}>
                      {sec.status === 'pending' ? '✦' : '↻'}
                    </button>
                  </div>
                </div>
              );
            })}

            {pct === 100 && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '6px', background: `${C.accent}18`, border: `1px solid ${C.accentDim}`, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🎓</div>
                <div style={{ color: C.accent, fontSize: '12px', fontFamily: 'monospace' }}>Todas as secções desenvolvidas!</div>
              </div>
            )}
          </div>
        )}

        {/* DEVELOPING */}
        {step === 'developing' && (
          <div>
            {session && activeSectionIdx !== null && (
              <Label>A desenvolver: <span style={{ color: C.accent }}>{session.sections[activeSectionIdx]?.title}</span></Label>
            )}
            <StreamBox text={streamingText} />
          </div>
        )}

        {/* SECTION READY */}
        {step === 'section_ready' && session && activeSectionIdx !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Label>Secção pronta: <span style={{ color: C.accent }}>{session.sections[activeSectionIdx]?.title}</span></Label>
            <div style={{
              maxHeight: '260px', overflowY: 'auto',
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px', padding: '0.75rem',
              color: C.text, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.65, whiteSpace: 'pre-wrap',
            }}>
              {streamingText}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn onClick={() => insertSection(activeSectionIdx, onInsert)} color={C.accent} flex>↓ Inserir no editor</Btn>
              <Btn onClick={backToOutline} color={C.muted} outline flex>← Voltar</Btn>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: '5px', background: '#3a0a0a', border: '1px solid #6a2020', color: '#e07070', fontFamily: 'monospace', fontSize: '11px' }}>
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={inputStyle}
        onFocus={e => ((e.target as HTMLInputElement).style.borderColor = '#5a9e8f55')}
        onBlur={e => ((e.target as HTMLInputElement).style.borderColor = C.border)} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '10px', fontFamily: 'monospace', color: C.textDim, letterSpacing: '0.08em', marginBottom: '3px', textTransform: 'uppercase' }}>{children}</div>;
}

function StreamBox({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: '0.5rem', maxHeight: '360px', overflowY: 'auto',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '5px',
      padding: '0.75rem', color: C.text, fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.7, whiteSpace: 'pre-wrap',
    }}>
      {text || <span style={{ color: C.textFaint }}><span style={{ animation: 'blink 1s step-end infinite', display: 'inline-block' }}>▋</span></span>}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ color: C.textDim, fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.55, margin: 0 }}>{children}</p>;
}

function Btn({ onClick, color, children, outline, flex, disabled }: {
  onClick: () => void; color: string; children: React.ReactNode;
  outline?: boolean; flex?: boolean; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: flex ? 1 : 'none',
        background: outline ? 'transparent' : hov ? color : `${color}cc`,
        border: `1px solid ${color}${outline ? '88' : '00'}`,
        borderRadius: '5px', color: outline ? color : '#0f0e0d',
        fontFamily: 'monospace', fontSize: '12px', padding: '8px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        letterSpacing: '0.04em', transition: 'all 0.15s',
      }}
    >{children}</button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#111611', border: `1px solid ${C.border}`, borderRadius: '4px',
  color: C.text, fontFamily: 'monospace', fontSize: '12px',
  padding: '7px 10px', outline: 'none', boxSizing: 'border-box',
  letterSpacing: '0.02em', transition: 'border-color 0.2s',
};

function smallBtn(color: string): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '4px', border: `1px solid ${color}44`, background: 'transparent', color, fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
}

function ghostBtn(color: string): React.CSSProperties {
  return { background: 'none', border: 'none', color, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 6px', borderRadius: '3px' };
}
