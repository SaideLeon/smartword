'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTccSession } from '@/hooks/useTccSession';
import { ContextCompressionBadge } from '@/components/ContextCompressionBadge';
import type { TccSection } from '@/lib/tcc/types';
import { tccTheme as C } from '@/lib/theme';

interface Props {
  onInsert: (text: string) => void;
  onTopicChange: (topic: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

export function TccPanel({ onInsert, onTopicChange, onClose, isMobile = false }: Props) {
  const {
    step, session, outline, streamingText, activeSectionIdx, error,
    recentSessions, compressionStatus,
    startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession, reset,
  } = useTccSession();

  const [topicInput, setTopicInput] = useState('');
  const [outlineEdit, setOutlineEdit] = useState('');
  const [outlineSuggestions, setOutlineSuggestions] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionsRegionId = 'tcc-recent-sessions';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, step]);

  useEffect(() => {
    if (step === 'review_outline') {
      setOutlineEdit(outline);
      setOutlineSuggestions('');
    }
  }, [step, outline]);

  useEffect(() => {
    if (showSessions) loadSessions();
  }, [showSessions, loadSessions]);

  const progressPct = session?.sections.length
    ? Math.round((session.sections.filter((s) => s.status !== 'pending').length / session.sections.length) * 100)
    : 0;

  const vars = useMemo(() => ({
    '--panel-bg': C.bg,
    '--panel-surface': C.surface,
    '--panel-border': C.border,
    '--panel-accent': C.accent,
    '--panel-accent-dim': C.accentDim,
    '--panel-muted': C.muted,
    '--panel-text': C.text,
    '--panel-text-dim': C.textDim,
    '--panel-text-faint': C.textFaint,
    '--panel-gold': C.gold,
  } as CSSProperties), []);

  const handleTopicSubmit = () => {
    const topic = topicInput.trim();
    if (!topic) return;
    onTopicChange(topic);
    submitTopic(topic);
  };

  const statusLabel = (s: TccSection) => {
    if (s.status === 'inserted') return { label: 'Inserido ✓', color: C.gold };
    if (s.status === 'developed') return { label: 'Desenvolvido', color: C.accent };
    return { label: 'Pendente', color: C.muted };
  };

  return (
    <div
      style={vars}
      className={`flex h-full flex-col bg-[var(--panel-bg)] ${isMobile ? '' : 'border-l border-[var(--panel-border)]'}`}
    >
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--panel-border)] bg-[rgba(11,13,11,0.95)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <span className="font-mono text-[13px] tracking-[0.06em] text-[var(--panel-accent)]">Modo TCC</span>
            {session && (
              <span className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--panel-text-faint)]">
                {session.topic.length > 28 ? `${session.topic.slice(0, 28)}…` : session.topic}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <button onClick={reset} className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--panel-muted)]" title="Nova sessão" aria-label="Iniciar nova sessão de TCC">↩</button>
            )}
            <button onClick={onClose} className="rounded px-1.5 py-0.5 text-lg leading-none text-[#5a5248]" title="Fechar" aria-label="Fechar painel do modo TCC">×</button>
          </div>
        </div>
        <ContextCompressionBadge status={compressionStatus} />
      </div>

      {session && session.sections.length > 0 && (
        <div className="shrink-0 border-b border-[var(--panel-border)] px-4 py-2">
          <div className="mb-1 flex justify-between">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--panel-text-dim)]">PROGRESSO DO TCC</span>
            <span className="font-mono text-[10px] text-[var(--panel-accent)]">{progressPct}%</span>
          </div>
          <div className="h-[3px] overflow-hidden rounded bg-[var(--panel-border)]">
            <div className="h-full rounded bg-[linear-gradient(90deg,var(--panel-muted),var(--panel-accent))] transition-[width] duration-700" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {step === 'idle' && (
          <div className="mt-8 text-center">
            <div className="mb-3 text-[2.5rem]">📝</div>
            <p className="mb-6 font-mono text-[13px] leading-[1.65] text-[var(--panel-text-dim)]">
              O modo TCC acompanha-te do esboço<br />à conclusão, secção a secção.<br />
              <span className="text-[11px] text-[var(--panel-text-faint)]">Compressão de contexto automática — sem limites de janela.</span>
            </p>
            <div className="flex flex-col gap-2.5">
              <Btn onClick={() => { startNew(); setShowSessions(false); }} color={C.accent}>✦ Iniciar novo TCC</Btn>
              <Btn onClick={() => setShowSessions((v) => !v)} color={C.muted} outline ariaLabel={showSessions ? 'Ocultar lista de sessões anteriores de TCC' : 'Mostrar lista de sessões anteriores de TCC'} ariaExpanded={showSessions} ariaControls={sessionsRegionId}>↩ Retomar sessão anterior</Btn>
            </div>

            {showSessions && (
              <div id={sessionsRegionId} className="mt-4 flex flex-col gap-1.5">
                {recentSessions.length === 0 && <p className="font-mono text-[11px] text-[var(--panel-text-faint)]">Nenhuma sessão anterior encontrada.</p>}
                {recentSessions.map((s) => (
                  <button key={s.id} onClick={() => { onTopicChange(s.topic); resumeSession(s.id); }} className="flex items-center justify-between rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 text-left transition-colors hover:border-[var(--panel-accent-dim)]">
                    <div>
                      <div className="font-mono text-xs text-[var(--panel-text)]">{s.topic}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--panel-text-faint)]">{new Date(s.updated_at).toLocaleDateString('pt-PT')}</div>
                    </div>
                    <span className="rounded border border-current px-1.5 py-0.5 font-mono text-[10px] text-[var(--panel-muted)]">
                      {s.status === 'completed' ? 'Concluído' : s.status === 'in_progress' ? 'Em curso' : s.status === 'outline_approved' ? 'Aprovado' : 'Esboço'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'new_or_resume' && (
          <TopicInput value={topicInput} onChange={setTopicInput} onSubmit={handleTopicSubmit} />
        )}

        {step === 'generating_outline' && <div><Label>A gerar esboço estrutural…</Label><StreamBox text={streamingText} /></div>}

        {step === 'review_outline' && (
          <div className="flex flex-col gap-3">
            <Label>Revê o esboço gerado. Podes editar directamente antes de aprovar.</Label>
            <textarea value={outlineEdit} onChange={(e) => setOutlineEdit(e.target.value)} rows={18} className="min-h-32 resize-y rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]" />
            <div className="flex flex-col gap-2">
              <Label>Antes de aprovar, adiciona sugestões para regenerar a estrutura.</Label>
              <input
                value={outlineSuggestions}
                onChange={(e) => setOutlineSuggestions(e.target.value)}
                placeholder="Ex: reforçar revisão de literatura e delimitar melhor metodologia"
                className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[11px] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]"
              />
            </div>
            <div className="flex gap-2"><Btn onClick={() => approveOutline(outlineEdit)} color={C.accent} flex>✓ Aprovar esboço</Btn><Btn onClick={() => requestNewOutline(outlineSuggestions)} color={C.muted} outline flex>↻ Regenerar com sugestões</Btn></div>
          </div>
        )}

        {(step === 'outline_approved' || step === 'section_ready') && session && (
          <div className="flex flex-col gap-2">
            <Label>Esboço aprovado. Selecciona uma secção para desenvolver.</Label>
            {session.sections.map((sec) => {
              const { label, color } = statusLabel(sec);
              const isActive = activeSectionIdx === sec.index;
              const isCompressed = compressionStatus.active && compressionStatus.coveredUpTo !== null && sec.index <= compressionStatus.coveredUpTo;
              return (
                <div key={sec.index} className={`flex items-center justify-between gap-2 rounded border px-3 py-2.5 transition-all ${isActive ? 'border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent-dim)]/20' : 'border-[var(--panel-border)] bg-[var(--panel-surface)]'} ${isCompressed ? 'opacity-75' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate font-mono text-xs font-medium text-[var(--panel-text)]">{sec.title}</span>{isCompressed && <span title="Secção no resumo de contexto" className="rounded border border-[var(--panel-border)] px-1 font-mono text-[9px] text-[var(--panel-text-faint)]">∑</span>}</div>
                    <div className="mt-0.5 font-mono text-[10px]" style={{ color }}>{label}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {sec.status !== 'pending' && <button onClick={() => insertSection(sec.index, onInsert)} className="flex h-7 w-7 items-center justify-center rounded border border-[color:var(--panel-gold)]/30 font-mono text-[13px] text-[var(--panel-gold)]" title="Inserir no editor" aria-label={`Inserir secção ${sec.title} no editor`}>↓</button>}
                    <button onClick={() => developSection(sec.index)} className="flex h-7 w-7 items-center justify-center rounded border border-[var(--panel-accent-dim)] font-mono text-[13px] text-[var(--panel-accent)]" title={sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'} aria-label={sec.status === 'pending' ? `Desenvolver secção ${sec.title}` : `Reescrever secção ${sec.title}`}>{sec.status === 'pending' ? '✦' : '↻'}</button>
                  </div>
                </div>
              );
            })}
            {session.status === 'completed' && <div className="mt-2 rounded border border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent)]/20 p-3 text-center"><div className="mb-1 text-2xl">🎓</div><div className="font-mono text-xs text-[var(--panel-accent)]">TCC concluído! Todas as secções desenvolvidas.</div></div>}
          </div>
        )}

        {step === 'developing' && (
          <div>
            {session && activeSectionIdx !== null && <Label>A desenvolver: <span className="text-[var(--panel-accent)]">{session.sections.find((s) => s.index === activeSectionIdx)?.title}</span></Label>}
            {compressionStatus.justCompressed && <div className="mb-2 rounded border border-[#c9a96e33] bg-[#c9a96e11] px-3 py-1.5 font-mono text-[10px] text-[var(--panel-gold)]">✦ Contexto comprimido automaticamente para optimizar a janela de tokens</div>}
            <StreamBox text={streamingText} />
          </div>
        )}

        {step === 'section_ready' && session && activeSectionIdx !== null && (
          <div className="mt-2 flex flex-col gap-3">
            <Label>Secção pronta: <span className="text-[var(--panel-accent)]">{session.sections.find((s) => s.index === activeSectionIdx)?.title}</span></Label>
            <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)]">{streamingText}</div>
            <div className="flex gap-2"><Btn onClick={() => insertSection(activeSectionIdx, onInsert)} color={C.accent} flex>↓ Inserir no editor</Btn><Btn onClick={backToOutline} color={C.muted} outline flex>← Voltar</Btn></div>
          </div>
        )}

        {error && <div className="rounded border border-[#6a2020] bg-[#3a0a0a] px-3 py-2 font-mono text-[11px] text-[#e07070]">⚠ {error}</div>}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TopicInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Label>Qual é o tópico do teu TCC?</Label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }} placeholder="Ex: O impacto das tecnologias digitais na educação básica em Moçambique" rows={4} autoFocus className="resize-none rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-xs leading-[1.6] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]" />
      <Btn onClick={onSubmit} color={C.accent} disabled={!value.trim()}>✦ Gerar esboço</Btn>
    </div>
  );
}

function StreamBox({ text }: { text: string }) {
  return <div className="mt-2 max-h-[380px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.7] text-[var(--panel-text)]">{text || <span className="text-[var(--panel-text-faint)]">▋</span>}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="m-0 font-mono text-[11px] leading-[1.55] tracking-[0.02em] text-[var(--panel-text-dim)]">{children}</p>;
}

function Btn({ onClick, color, children, outline, flex, disabled, ariaLabel, ariaExpanded, ariaControls }: { onClick: () => void; color: string; children: ReactNode; outline?: boolean; flex?: boolean; disabled?: boolean; ariaLabel?: string; ariaExpanded?: boolean; ariaControls?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className={`press-feedback rounded border px-[14px] py-2 font-mono text-xs tracking-[0.04em] transition-all ${flex ? 'flex-1' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: outline ? 'transparent' : hov ? color : `${color}cc`, borderColor: `${color}${outline ? '88' : '00'}`, color: outline ? color : '#0f0e0d', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
}
