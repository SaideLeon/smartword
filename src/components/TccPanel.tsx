'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTccSession } from '@/hooks/useTccSession';
import { useCoverAgent } from '@/hooks/useCoverAgent';
import { useEditorActions } from '@/hooks/useEditorStore';
import { ContextCompressionBadge } from '@/components/ContextCompressionBadge';
import { CoverFormModal } from '@/components/CoverFormModal';
import { AudioInputButton } from '@/components/AudioInputButton';
import { ProcessingBars } from '@/components/ProcessingBars';
import type { TccSection } from '@/lib/tcc/types';
import type { CoverData } from '@/lib/docx/cover-types';
import { tccTheme as C } from '@/lib/theme';
import { buildReconstructedTccContent } from '@/lib/tcc/pagebreak';

interface Props {
  onInsert: (text: string) => void;
  onTopicChange: (topic: string) => void;
  onClose: () => void;
  isMobile?: boolean;
  /** Conteúdo actual do editor — usado para detectar se está vazio e para regeneração */
  editorMarkdown?: string;
}

export function TccPanel({ onInsert, onTopicChange, onClose, isMobile = false, editorMarkdown }: Props) {
  const {
    step, session, outline, streamingText, activeSectionIdx, error,
    recentSessions, compressionStatus,
    startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession, reset,
  } = useTccSession();
  const coverAgent = useCoverAgent();
  const { setIncludeCover, setCoverData, resetExportPreferences, setContent } = useEditorActions();

  const [topicInput, setTopicInput] = useState('');
  const [outlineEdit, setOutlineEdit] = useState('');
  const [outlineSuggestions, setOutlineSuggestions] = useState('');
  const [isApprovingOutline, setIsApprovingOutline] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [resumeRestoreSessionId, setResumeRestoreSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [processingButtonId, setProcessingButtonId] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoModeRef = useRef(false);
  const handleInsertRef = useRef<(idx: number) => void>(() => {});
  const developSectionRef = useRef<(idx: number) => void>(() => {});
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionsRegionId = 'tcc-recent-sessions';
  const isProcessing = useCallback((id: string) => processingButtonId === id, [processingButtonId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, step, coverAgent.streamingAbstract]);

  useEffect(() => {
    if (step === 'review_outline') {
      setOutlineEdit(outline);
      setOutlineSuggestions('');
    }
  }, [step, outline]);

  useEffect(() => {
    if (showSessions) loadSessions();
  }, [showSessions, loadSessions]);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  useEffect(() => {
    if (!processingButtonId) return;

    const shouldClear =
      (processingButtonId === 'start-new' && step === 'new_or_resume') ||
      (processingButtonId === 'toggle-sessions') ||
      (processingButtonId.startsWith('resume-session-') && !!session) ||
      (processingButtonId === 'submit-topic' && step === 'generating_outline') ||
      (processingButtonId === 'approve-outline' && step !== 'review_outline') ||
      (processingButtonId === 'regenerate-outline' && step === 'generating_outline') ||
      (processingButtonId.startsWith('develop-section-') && step === 'developing') ||
      (processingButtonId.startsWith('insert-section-') && step === 'outline_approved') ||
      (processingButtonId === 'back-to-outline' && step === 'outline_approved') ||
      (processingButtonId === 'reset-tcc' && step === 'idle');

    if (shouldClear) setProcessingButtonId(null);
  }, [processingButtonId, session, step]);

  useEffect(() => {
    if (!resumeRestoreSessionId || !session || session.id !== resumeRestoreSessionId) return;

    const completedSections = session.sections.filter(
      s => s.status !== 'pending' && s.content.trim(),
    );
    const currentOutline = session.outline_approved ?? session.outline_draft ?? '';
    const editorContent = buildReconstructedTccContent(completedSections, currentOutline);

    setContent(editorContent);
    setResumeRestoreSessionId(null);
  }, [resumeRestoreSessionId, session, setContent]);

  useEffect(() => {
    if (coverAgent.step === 'done_with_cover' && coverAgent.coverData) {
      setIncludeCover(true);
      setCoverData(coverAgent.coverData);
      return;
    }
    if (coverAgent.step === 'done_without_cover' || coverAgent.step === 'idle') {
      setIncludeCover(false);
      setCoverData(null);
    }
  }, [coverAgent.step, coverAgent.coverData, setCoverData, setIncludeCover]);

  useEffect(() => {
    if (step !== 'outline_approved' || !session) return;
    if (coverAgent.step !== 'idle') return;

    const existingCover = session.cover_data ?? null;
    if (existingCover) {
      coverAgent.restoreCoverData(existingCover);
      setIncludeCover(true);
      setCoverData(existingCover);
      return;
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session?.id]);

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
    setProcessingButtonId('submit-topic');
    onTopicChange(topic);
    submitTopic(topic);
  };

  const handleApproveOutline = async () => {
    if (isApprovingOutline) return;
    setProcessingButtonId('approve-outline');
    setIsApprovingOutline(true);
    try {
      await approveOutline(outlineEdit);
    } finally {
      setIsApprovingOutline(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      const res = await fetch(`/api/tcc/session?id=${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Não foi possível excluir a sessão');
      await loadSessions();
    } catch {
      // ignorar
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleResetSession = () => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoModeRef.current = false;
    setAutoMode(false);
    coverAgent.reset();
    resetExportPreferences();
    setShowCoverModal(false);
    reset();
  };

  const handleCoverSubmit = async (coverData: CoverData) => {
    setShowCoverModal(false);
    if (!session) return;

    const finalData = await coverAgent.submitCoverData(
      coverData,
      session.topic,
      session.outline_approved ?? session.outline_draft ?? '',
      () => {},
    );

    if (!finalData) return;

    try {
      await fetch('/api/tcc/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'saveCoverData',
          sessionId: session.id,
          coverData: finalData,
        }),
      });
    } catch {
      // não crítico
    }
  };

  // ── Handler de inserção com pagebreak ────────────────────────────────────────
  //
  // Passa editorMarkdown e onReplace para que buildTccSectionMarkdown possa
  // decidir: (a) se o editor está vazio (sem pagebreak antes); (b) se é uma
  // regeneração e precisa reconstruir todo o conteúdo.

  const handleInsertSection = useCallback((sectionIndex: number) => {
    if (!session) return;
    setProcessingButtonId(`insert-section-${sectionIndex}`);
    insertSection(sectionIndex, onInsert, {
      editorMarkdown,
      onReplace: setContent,
    });
  }, [session, insertSection, onInsert, editorMarkdown, setContent]);

  useEffect(() => {
    handleInsertRef.current = handleInsertSection;
  }, [handleInsertSection]);

  useEffect(() => {
    developSectionRef.current = developSection;
  }, [developSection]);

  useEffect(() => {
    if (!autoModeRef.current || step !== 'section_ready' || activeSectionIdx === null) return;
    handleInsertRef.current(activeSectionIdx);
  }, [step, activeSectionIdx]);

  useEffect(() => {
    if (!autoModeRef.current || step !== 'outline_approved' || !session) return;

    const nextPending = session.sections.find(s => s.status === 'pending');
    if (nextPending) {
      autoTimerRef.current = setTimeout(() => {
        if (!autoModeRef.current) return;
        setProcessingButtonId(`develop-section-${nextPending.index}`);
        developSectionRef.current(nextPending.index);
      }, 900);

      return () => {
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      };
    }

    autoModeRef.current = false;
    setAutoMode(false);
  }, [step, session]);

  const statusLabel = (s: TccSection) => {
    if (s.status === 'inserted') return { label: 'Inserido ✓', color: C.gold };
    if (s.status === 'developed') return { label: 'Desenvolvido', color: C.accent };
    return { label: 'Pendente', color: C.muted };
  };

  const startAutoGenerate = useCallback(() => {
    if (!session) return;
    const firstPending = session.sections.find(s => s.status === 'pending');
    if (!firstPending) return;
    autoModeRef.current = true;
    setAutoMode(true);
    setProcessingButtonId(`develop-section-${firstPending.index}`);
    developSection(firstPending.index);
  }, [session, developSection]);

  const cancelAutoGenerate = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoModeRef.current = false;
    setAutoMode(false);
  }, []);

  return (
    <div
      style={vars}
      className={`flex h-full flex-col bg-[var(--panel-bg)] ${isMobile ? '' : 'border-l border-[var(--panel-border)]'}`}
    >
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-3">
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
              <button
                onClick={() => {
                  setProcessingButtonId('reset-tcc');
                  handleResetSession();
                }}
                className={`rounded px-1.5 py-0.5 text-lg leading-none text-[var(--panel-muted)] ${isProcessing('reset-tcc') ? 'animate-pulse [animation-duration:1.6s]' : ''}`}
                title="Nova sessão"
                aria-label="Iniciar nova sessão de TCC"
              >
                {isProcessing('reset-tcc') ? '⋯' : '↩'}
              </button>
            )}
            <button onClick={onClose} className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--panel-text-faint)]" title="Fechar" aria-label="Fechar painel do modo TCC">×</button>
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
              <Btn onClick={() => {
                setProcessingButtonId('start-new');
                if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
                autoModeRef.current = false;
                setAutoMode(false);
                startNew();
                setShowSessions(false);
              }} color={C.accent} processing={isProcessing('start-new')}>✦ Iniciar novo TCC</Btn>
              <Btn onClick={() => { setProcessingButtonId('toggle-sessions'); setShowSessions((v) => !v); }} color={C.muted} outline processing={isProcessing('toggle-sessions')} ariaLabel={showSessions ? 'Ocultar lista de sessões anteriores de TCC' : 'Mostrar lista de sessões anteriores de TCC'} ariaExpanded={showSessions} ariaControls={sessionsRegionId}>↩ Retomar sessão anterior</Btn>
            </div>

            {showSessions && (
              <div id={sessionsRegionId} className="mt-4 flex flex-col gap-1.5">
                {recentSessions.length === 0 && <p className="font-mono text-[11px] text-[var(--panel-text-faint)]">Nenhuma sessão anterior encontrada.</p>}
                {recentSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-2 py-2">
                    <button
                      onClick={() => {
                        setProcessingButtonId(`resume-session-${s.id}`);
                        onTopicChange(s.topic);
                        setContent('');
                        setResumeRestoreSessionId(s.id);
                        resumeSession(s.id);
                      }}
                      className={`flex min-w-0 flex-1 items-center justify-between rounded px-1 py-0.5 text-left transition-colors hover:text-[var(--panel-accent)] ${isProcessing(`resume-session-${s.id}`) ? 'animate-pulse [animation-duration:1.6s]' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-[var(--panel-text)]">{s.topic}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--panel-text-faint)]">{new Date(s.updated_at).toLocaleDateString('pt-PT')}</div>
                      </div>
                      <span className="ml-2 rounded border border-current px-1.5 py-0.5 font-mono text-[10px] text-[var(--panel-muted)]">
                        {s.status === 'completed' ? 'Concluído' : s.status === 'in_progress' ? 'Em curso' : s.status === 'outline_approved' ? 'Aprovado' : 'Esboço'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      disabled={deletingSessionId === s.id}
                      className="flex min-h-7 min-w-12 items-center justify-center rounded border border-red-900/60 px-2 py-1 font-mono text-[10px] text-red-300 transition-colors hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Excluir sessão"
                      aria-label={`Excluir sessão ${s.topic}`}
                    >
                      {deletingSessionId === s.id ? <ProcessingBars height={12} barColor="#fca5a5" /> : 'Excluir'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'new_or_resume' && (
          <TopicInput value={topicInput} onChange={setTopicInput} onSubmit={handleTopicSubmit} />
        )}

        {step === 'generating_outline' && <div><Label>A gerar esboço estrutural…</Label><StreamBox text={streamingText} showProcessing={!streamingText.trim()} /></div>}

        {step === 'review_outline' && (
          <div className="flex flex-col gap-3">
            <Label>Revê o esboço gerado. Podes editar directamente antes de aprovar.</Label>
            <div className="flex items-end gap-2">
              <textarea value={outlineEdit} onChange={(e) => setOutlineEdit(e.target.value)} rows={18} className="min-h-32 flex-1 resize-y rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]" />
              <AudioInputButton onTranscription={(text) => setOutlineEdit((prev) => (prev ? `${prev}\n${text}` : text))} className="py-2" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Antes de aprovar, adiciona sugestões para regenerar a estrutura.</Label>
              <div className="flex items-center gap-2">
                <input
                  value={outlineSuggestions}
                  onChange={(e) => setOutlineSuggestions(e.target.value)}
                  placeholder="Ex: reforçar revisão de literatura e delimitar melhor metodologia"
                  className="flex-1 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[11px] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]"
                />
                <AudioInputButton onTranscription={(text) => setOutlineSuggestions((prev) => (prev ? `${prev} ${text}` : text))} className="py-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Btn onClick={handleApproveOutline} color={C.accent} flex disabled={isApprovingOutline}>
                {isApprovingOutline ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/35 border-t-black" />
                    Pensando...
                  </span>
                ) : '✓ Aprovar esboço'}
              </Btn>
              <Btn onClick={() => { setProcessingButtonId('regenerate-outline'); requestNewOutline(outlineSuggestions); }} color={C.muted} outline flex disabled={isApprovingOutline} processing={isProcessing('regenerate-outline')}>↻ Regenerar com sugestões</Btn>
            </div>
          </div>
        )}

        {step === 'outline_approved' && coverAgent.step === 'idle' && (
          <div className="flex flex-col gap-3 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-3">
            <p className="font-mono text-[11px] leading-[1.6] text-[var(--panel-text)]">
              Deseja incluir capa e contracapa no seu trabalho?
            </p>
            <div className="flex flex-col gap-2">
              <Btn color={C.accent} flex onClick={() => { coverAgent.chooseCover(); setShowCoverModal(true); }}>
                ✦ Incluir capa e contracapa
              </Btn>
              <button
                onClick={() => coverAgent.chooseWithoutCover()}
                className="text-left font-mono text-[10px] text-[var(--panel-text-faint)] underline transition-colors hover:text-[var(--panel-muted)]"
              >
                Saltar — desenvolver sem capa
              </button>
            </div>
          </div>
        )}

        {step === 'outline_approved' &&
         coverAgent.step === 'generating_abstract' && (
          <div className="animate-in slide-in-from-bottom-1 fade-in duration-300 flex flex-col gap-3 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-3">
            <div className="flex items-center gap-2">
              <ProcessingBars className="shrink-0" height={10} barColor="#c9a96e" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--panel-gold)]">
                A gerar resumo
              </span>
            </div>

            <p className="font-mono text-[11px] leading-[1.6] text-[var(--panel-muted)]">
              A criar o resumo para a contracapa do teu trabalho
              <span className="ml-1 inline-flex align-middle gap-[3px]">
                <span className="h-[4px] w-[4px] animate-[bounce_.9s_.0s_infinite] rounded-full bg-current" />
                <span className="h-[4px] w-[4px] animate-[bounce_.9s_.15s_infinite] rounded-full bg-current" />
                <span className="h-[4px] w-[4px] animate-[bounce_.9s_.3s_infinite] rounded-full bg-current" />
              </span>
            </p>

            <ProcessingBars className="justify-start" height={16} barColor="#c9a96e" />

            {coverAgent.streamingAbstract && (
              <div className="border-t border-[var(--panel-border)] pt-2.5">
                <p className="font-mono text-[11px] leading-[1.7] text-[var(--panel-text)]">
                  {coverAgent.streamingAbstract}
                  <span className="ml-[2px] inline-block h-[13px] w-[2px] animate-[cover-cursor-blink_1s_step-end_infinite] align-middle bg-[var(--panel-gold)]" />
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'outline_approved' && coverAgent.step === 'done_with_cover' && coverAgent.coverData && (
          <div className="rounded border border-[color:var(--panel-gold)]/30 bg-[color:var(--panel-gold)]/10 px-3 py-2.5">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--panel-gold)]">📄 Capa disponível</div>
            <p className="font-mono text-[11px] text-[var(--panel-text)]">
              {coverAgent.coverData.theme && <span className="block mb-1 text-[var(--panel-muted)]">Tema: {coverAgent.coverData.theme}</span>}
              {coverAgent.coverData.members?.length && <span className="block text-[var(--panel-muted)]">{coverAgent.coverData.members.length} membro(s) · {coverAgent.coverData.teacher}</span>}
            </p>
          </div>
        )}

        {(step === 'outline_approved' || step === 'developing' || step === 'section_ready') &&
         (coverAgent.step === 'done_with_cover' || coverAgent.step === 'done_without_cover' || coverAgent.step === 'idle') &&
         session && (
          <div className="flex flex-col gap-2">
            <Label>Esboço aprovado. Selecciona uma secção para desenvolver.</Label>

            {/* Nota explicativa sobre pagebreaks */}
            <div className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[10px] leading-[1.5] text-[var(--panel-text-faint)]">
              ↕ Cada secção principal começa numa nova página. Subsecções (1.1, 1.2…) fluem juntas no mesmo bloco.
            </div>

            {autoMode ? (
              <div className="flex items-center justify-between rounded border border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent-dim)]/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ProcessingBars height={12} />
                  <span className="font-mono text-[10px] text-[var(--panel-accent)]">
                    A gerar automaticamente…
                  </span>
                </div>
                <button
                  onClick={cancelAutoGenerate}
                  className="font-mono text-[10px] text-[var(--panel-text-faint)] underline transition-colors hover:text-[var(--panel-muted)]"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              session.sections.some(s => s.status === 'pending') && (
                <Btn
                  color={C.gold}
                  flex
                  onClick={startAutoGenerate}
                  disabled={step === 'developing'}
                >
                  ▶ Gerar todas as secções automaticamente
                </Btn>
              )
            )}

            {session.sections.map((sec) => {
              const { label, color } = statusLabel(sec);
              const isActive = activeSectionIdx === sec.index;
              const isCompressed = compressionStatus.active && compressionStatus.coveredUpTo !== null && sec.index <= compressionStatus.coveredUpTo;
              const isSubsec = /^\d+\.\d+|^[ivxlcdm]+\.\d+/i.test(sec.title.trim());
              return (
                <div key={sec.index} className={`flex items-center justify-between gap-2 rounded border px-3 py-2.5 transition-all ${isActive ? 'border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent-dim)]/20' : 'border-[var(--panel-border)] bg-[var(--panel-surface)]'} ${isCompressed ? 'opacity-75' : ''} ${isSubsec ? 'ml-3' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isSubsec && <span className="text-[var(--panel-text-faint)]">↳</span>}
                      <span className="truncate font-mono text-xs font-medium text-[var(--panel-text)]">{sec.title}</span>
                      {isCompressed && <span title="Secção no resumo de contexto" className="rounded border border-[var(--panel-border)] px-1 font-mono text-[9px] text-[var(--panel-text-faint)]">∑</span>}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px]" style={{ color }}>{label}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {sec.status !== 'pending' && (
                      <button
                        onClick={() => handleInsertSection(sec.index)}
                        className={`flex h-7 ${isProcessing(`insert-section-${sec.index}`) ? 'px-2.5' : 'w-7'} items-center justify-center rounded border border-[color:var(--panel-gold)]/30 font-mono text-[13px] text-[var(--panel-gold)]`}
                        title="Inserir no editor"
                        aria-label={`Inserir secção ${sec.title} no editor`}
                      >
                        {isProcessing(`insert-section-${sec.index}`) ? (
                          <ProcessingBars height={14} barClassName="opacity-90" />
                        ) : '↓'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setProcessingButtonId(`develop-section-${sec.index}`);
                        developSection(sec.index);
                      }}
                      className={`flex h-7 ${isProcessing(`develop-section-${sec.index}`) ? 'px-2.5' : 'w-7'} items-center justify-center rounded border border-[var(--panel-accent-dim)] font-mono text-[13px] text-[var(--panel-accent)]`}
                      title={sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'}
                      aria-label={sec.status === 'pending' ? `Desenvolver secção ${sec.title}` : `Reescrever secção ${sec.title}`}
                    >
                      {isProcessing(`develop-section-${sec.index}`) ? (
                        <ProcessingBars height={14} />
                      ) : sec.status === 'pending' ? '✦' : '↻'}
                    </button>
                  </div>
                </div>
              );
            })}
            {session.status === 'completed' && (
              <div className="mt-2 rounded border border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent)]/20 p-3 text-center">
                <div className="mb-1 text-2xl">🎓</div>
                <div className="font-mono text-xs text-[var(--panel-accent)]">TCC concluído! Todas as secções desenvolvidas.</div>
              </div>
            )}
          </div>
        )}

        {step === 'developing' && (
          <div>
            {session && activeSectionIdx !== null && (
              <Label>A desenvolver: <span className="text-[var(--panel-accent)]">{session.sections.find((s) => s.index === activeSectionIdx)?.title}</span></Label>
            )}
            {compressionStatus.justCompressed && (
              <div className="mb-2 rounded border border-[var(--panel-gold)]/30 bg-[var(--panel-gold)]/10 px-3 py-1.5 font-mono text-[10px] text-[var(--panel-gold)]">
                ✦ Contexto comprimido automaticamente para optimizar a janela de tokens
              </div>
            )}
            <StreamBox text={streamingText} showProcessing={!streamingText.trim()} />
          </div>
        )}

        {step === 'section_ready' && session && activeSectionIdx !== null && (
          <div className="mt-2 flex flex-col gap-3">
            <Label>Secção pronta: <span className="text-[var(--panel-accent)]">{session.sections.find((s) => s.index === activeSectionIdx)?.title}</span></Label>
            <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)]">
              {streamingText}
            </div>
            <div className="flex gap-2">
              <Btn onClick={() => handleInsertSection(activeSectionIdx)} color={C.accent} flex processing={isProcessing(`insert-section-${activeSectionIdx}`)}>↓ Inserir no editor</Btn>
              <Btn onClick={() => { setProcessingButtonId('back-to-outline'); backToOutline(); }} color={C.muted} outline flex processing={isProcessing('back-to-outline')}>← Voltar</Btn>
            </div>
          </div>
        )}

        {(error || coverAgent.error) && (
          <div className="rounded border border-red-900 bg-red-950/60 px-3 py-2 font-mono text-[11px] text-red-300">
            ⚠ {error || coverAgent.error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showCoverModal && (
        <CoverFormModal
          onSubmit={handleCoverSubmit}
          onCancel={() => { setShowCoverModal(false); coverAgent.reset(); }}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

function TopicInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Label>Qual é o tópico do teu TCC?</Label>
      <div className="flex items-end gap-2">
        <textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }} placeholder="Ex: O impacto das tecnologias digitais na educação básica em Moçambique" rows={4} autoFocus className="flex-1 resize-none rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-xs leading-[1.6] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]" />
        <AudioInputButton onTranscription={(text) => onChange(value ? `${value} ${text}` : text)} className="py-2" />
      </div>
      <Btn onClick={onSubmit} color={C.accent} disabled={!value.trim()}>✦ Gerar esboço</Btn>
    </div>
  );
}

function StreamBox({ text, showProcessing = false }: { text: string; showProcessing?: boolean }) {
  return (
    <div className="mt-2 max-h-[380px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.7] text-[var(--panel-text)]">
      {text || (showProcessing ? <ProcessingBars className="h-6" /> : <span className="text-[var(--panel-text-faint)]">▋</span>)}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="m-0 font-mono text-[11px] leading-[1.55] tracking-[0.02em] text-[var(--panel-text-dim)]">{children}</p>;
}

function Btn({ onClick, color, children, outline, flex, disabled, ariaLabel, ariaExpanded, ariaControls, processing }: { onClick: () => void; color: string; children: ReactNode; outline?: boolean; flex?: boolean; disabled?: boolean; ariaLabel?: string; ariaExpanded?: boolean; ariaControls?: string; processing?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className={`press-feedback rounded border px-[14px] py-2 font-mono text-xs tracking-[0.04em] transition-all ${flex ? 'flex-1' : ''} ${processing ? 'animate-pulse [animation-duration:1.6s]' : ''}`}
      onClick={onClick}
      disabled={disabled || processing}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: outline ? 'transparent' : hov ? color : `${color}cc`, borderColor: `${color}${outline ? '88' : '00'}`, color: outline ? color : '#131313', opacity: disabled || processing ? 0.4 : 1, cursor: disabled || processing ? 'not-allowed' : 'pointer' }}
    >
      {processing ? (
        <span className="inline-flex items-center gap-2">
          <ProcessingBars height={14} />
          A processar...
        </span>
      ) : children}
    </button>
  );
}
