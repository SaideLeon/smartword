'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  const sessionsRegionId = 'work-recent-sessions';

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
    if (status === 'inserted') return { label: 'Inserido ✓', color: C.gold };
    if (status === 'developed') return { label: 'Desenvolvido', color: C.accent };
    return { label: 'Pendente', color: C.muted };
  };

  return (
    <div style={vars} className={`flex h-full flex-col bg-[var(--panel-bg)] ${isMobile ? '' : 'border-l border-[var(--panel-border)]'}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] bg-[rgba(10,13,10,0.95)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📚</span>
          <span className="font-mono text-[13px] tracking-[0.06em] text-[var(--panel-accent)]">Trabalho Escolar</span>
          {session && <span className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--panel-text-faint)]">{session.topic.length > 28 ? `${session.topic.slice(0, 28)}…` : session.topic}</span>}
        </div>
        <div className="flex gap-2">
          {session && <button onClick={reset} className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--panel-muted)]" title="Novo trabalho" aria-label="Iniciar novo trabalho">↩</button>}
          <button onClick={onClose} className="rounded px-1.5 py-0.5 text-lg leading-none text-[#5a5248]" title="Fechar" aria-label="Fechar painel de trabalho escolar">×</button>
        </div>
      </div>

      {session && (
        <div className="shrink-0 border-b border-[var(--panel-border)] px-4 py-2">
          <div className="mb-1 flex justify-between">
            <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--panel-text-dim)]">PROGRESSO</span>
            <span className="font-mono text-[10px] text-[var(--panel-accent)]">{progressPct}%</span>
          </div>
          <div className="h-[3px] overflow-hidden rounded bg-[var(--panel-border)]"><div className="h-full rounded bg-[linear-gradient(90deg,var(--panel-muted),var(--panel-accent))] transition-[width] duration-700" style={{ width: `${progressPct}%` }} /></div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {step === 'idle' && (
          <div className="mt-8 text-center">
            <div className="mb-3 text-[2.5rem]">📚</div>
            <p className="mb-6 font-mono text-[13px] leading-[1.65] text-[var(--panel-text-dim)]">Copiloto para trabalhos do ensino secundário e médio.<br />Gera e desenvolve cada secção do teu trabalho,<br />secção a secção.</p>
            <div className="mb-5 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 text-left">
              <div className="mb-2 font-mono text-[10px] tracking-[0.08em] text-[var(--panel-text-dim)]">ESTRUTURA DO TRABALHO</div>
              {['Índice', 'Introdução', 'Objectivos e Metodologia', 'Desenvolvimento Teórico', 'Conclusão', 'Referências Bibliográficas'].map((s, i) => <div key={s} className="py-0.5 font-mono text-[11px] text-[var(--panel-text-dim)]">{i + 1}. {s}</div>)}
            </div>
            <div className="flex flex-col gap-2.5">
              <Btn onClick={() => { startNew(); setShowSessions(false); }} color={C.accent}>✦ Iniciar trabalho</Btn>
              <Btn onClick={() => setShowSessions((v) => !v)} color={C.muted} outline ariaLabel={showSessions ? 'Ocultar lista de trabalhos anteriores' : 'Mostrar lista de trabalhos anteriores'} ariaExpanded={showSessions} ariaControls={sessionsRegionId}>↩ Retomar trabalho</Btn>
            </div>

            {showSessions && (
              <div id={sessionsRegionId} className="mt-4 flex flex-col gap-1.5">
                {recentSessions.length === 0 && <p className="font-mono text-[11px] text-[var(--panel-text-faint)]">Nenhum trabalho anterior encontrado.</p>}
                {recentSessions.map((s) => (
                  <button key={s.id} onClick={() => { onTopicChange(s.topic); resumeSession(s.id); }} className="flex items-center justify-between rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 text-left transition-colors hover:border-[var(--panel-accent-dim)]">
                    <div><div className="font-mono text-xs text-[var(--panel-text)]">{s.topic}</div><div className="mt-0.5 font-mono text-[10px] text-[var(--panel-text-faint)]">{new Date(s.updated_at).toLocaleDateString('pt-PT')}</div></div>
                    <span className="rounded border border-current px-1.5 py-0.5 font-mono text-[10px] text-[var(--panel-muted)]">{s.status === 'completed' ? 'Concluído' : s.status === 'in_progress' ? 'Em curso' : s.status === 'outline_approved' ? 'Aprovado' : 'Esboço'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'topic_input' && (
          <div className="flex flex-col gap-3">
            <Label>Qual é o tema do trabalho?</Label>
            <textarea value={topicInput} onChange={(e) => setTopicInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }} placeholder="Ex: A importância da água potável para a saúde pública em Moçambique" rows={4} autoFocus className="resize-none rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-xs leading-[1.6] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]" />
            <Btn onClick={handleTopicSubmit} color={C.accent} disabled={!topicInput.trim()}>✦ Gerar esboço orientador</Btn>
          </div>
        )}

        {step === 'generating_outline' && <div><Label>A gerar esboço orientador…</Label><StreamBox text={streamingText} /></div>}

        {step === 'review_outline' && (
          <div className="flex flex-col gap-3">
            <Label>Esboço gerado. Podes editar antes de aprovar.</Label>
            <textarea value={outlineEdit} onChange={(e) => setOutlineEdit(e.target.value)} rows={16} className="min-h-32 resize-y rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]" />
            <div className="flex gap-2"><Btn onClick={() => approveOutline(outlineEdit)} color={C.accent} flex>✓ Aprovar esboço</Btn><Btn onClick={requestNewOutline} color={C.muted} outline flex>↻ Gerar novo</Btn></div>
          </div>
        )}

        {(step === 'outline_approved' || step === 'developing' || step === 'section_ready') && session && (
          <div className="flex flex-col gap-2">
            <Label>Esboço aprovado. Selecciona uma secção para desenvolver.</Label>
            {session.sections.map((sec) => {
              const { label, color } = statusLabel(sec.status);
              const isActive = activeSectionIdx === sec.index;
              const isInserted = sec.status === 'inserted';
              const isDeveloping = isActive && step === 'developing';
              const isBusy = activeSectionIdx !== null;
              return (
                <div
                  key={sec.index}
                  className={`flex items-center justify-between gap-2 rounded border px-3 py-2.5 transition-all ${
                    isActive
                      ? 'border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent-dim)]/20'
                      : 'border-[var(--panel-border)] bg-[var(--panel-surface)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs font-medium text-[var(--panel-text)]">{sec.title}</div>
                    <div className="mt-0.5 font-mono text-[10px]" style={{ color }}>{label}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {sec.status !== 'pending' && (
                      <button
                        onClick={() => !isInserted && insertSection(sec.index, onInsert)}
                        disabled={isInserted}
                        className={`flex h-7 w-7 items-center justify-center rounded border font-mono text-[13px] transition-all ${
                          isInserted
                            ? 'cursor-default border-[color:var(--panel-gold)]/20 text-[color:var(--panel-gold)]/40'
                            : 'border-[color:var(--panel-gold)]/30 text-[var(--panel-gold)] hover:bg-[color:var(--panel-gold)]/10'
                        }`}
                        title={isInserted ? 'Já inserido no editor' : 'Inserir no editor'}
                        aria-label={
                          isInserted
                            ? `Secção ${sec.title} já inserida`
                            : `Inserir secção ${sec.title} no editor`
                        }
                      >
                        {isInserted ? '✓' : '↓'}
                      </button>
                    )}
                    <button
                      onClick={() => !isBusy && developSection(sec.index)}
                      disabled={isBusy}
                      className={`flex h-7 w-7 items-center justify-center rounded border font-mono text-[13px] transition-all ${
                        isDeveloping
                          ? 'animate-pulse border-[var(--panel-accent)] bg-[var(--panel-accent-dim)] text-[var(--panel-accent)]'
                          : isBusy
                            ? 'cursor-not-allowed border-[var(--panel-accent-dim)] text-[var(--panel-accent)] opacity-30'
                            : 'border-[var(--panel-accent-dim)] text-[var(--panel-accent)] hover:bg-[var(--panel-accent-dim)]'
                      }`}
                      title={
                        isDeveloping ? 'A desenvolver…' : sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'
                      }
                      aria-label={
                        isDeveloping
                          ? `A desenvolver ${sec.title}`
                          : sec.status === 'pending'
                            ? `Desenvolver secção ${sec.title}`
                            : `Reescrever secção ${sec.title}`
                      }
                    >
                      {isDeveloping ? '⋯' : sec.status === 'pending' ? '✦' : '↻'}
                    </button>
                  </div>
                </div>
              );
            })}
            {progressPct === 100 && <div className="mt-2 rounded border border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent)]/20 p-3 text-center"><div className="mb-1 text-2xl">🎓</div><div className="font-mono text-xs text-[var(--panel-accent)]">Trabalho concluído! Todas as secções desenvolvidas.</div></div>}
          </div>
        )}

        {step === 'developing' && <div>{session && activeSectionIdx !== null && <Label>A desenvolver: <span className="text-[var(--panel-accent)]">{session.sections[activeSectionIdx]?.title}</span></Label>}<StreamBox text={streamingText} /></div>}

        {step === 'section_ready' && session && activeSectionIdx !== null && (
          <div className="mt-2 flex flex-col gap-3">
            <Label>Secção pronta: <span className="text-[var(--panel-accent)]">{session.sections[activeSectionIdx]?.title}</span></Label>
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
