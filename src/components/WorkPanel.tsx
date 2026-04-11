'use client';

// src/components/WorkPanel.tsx
//
// ── REGRA DE PAGEBREAK (LEIA ANTES DE MODIFICAR) ───────────────────────────
//
// Cada secção principal deve começar OBRIGATORIAMENTE numa nova página.
// A regra é simples e universal:
//
//   • Primeira secção inserida no editor → SEM pagebreak antes
//   • Todas as outras secções principais → COM {pagebreak} antes do título
//   • Subsecções (1.1, 1.2, …)          → NUNCA pagebreak — fluem na mesma página
//
// Esta lógica está EXCLUSIVAMENTE em buildSectionMarkdown() e buildReconstructedContent().
// O servidor (develop/route.ts) guarda conteúdo PURO — sem pagebreaks.
// O hook (useWorkSession.ts) também não adiciona pagebreaks.
// APENAS estas funções decidem o pagebreak.
//
// ── REGRA DE NUMERAÇÃO ───────────────────────────────────────────────────────
//
//   I.   Introdução                → ## I. Introdução
//   II.  Objectivos                → ## II. Objectivos
//   III. Metodologia               → ## III. Metodologia
//   1. Desenvolvimento Teórico     → ## 1. Desenvolvimento Teórico  (heading pai, auto-inserido)
//   1.1  Subsecção do Desenv.      → ### 1.1 Título  (sem pagebreak, segue o pai)
//   1.2  Subsecção do Desenv.      → ### 1.2 Título  (sem pagebreak)
//   Conclusão                      → ## Conclusão    (sem número)
//   Referências Bibliográficas     → ## Referências  (sem número)
//
// ── REGRA DO HEADING PAI ─────────────────────────────────────────────────────
//
//   Quando a primeira subsecção (ex: 1.1) de um grupo é inserida:
//     → O heading pai (ex: ## 1. Desenvolvimento Teórico) é inserido automaticamente
//     → O heading pai recebe o {pagebreak} (se não for primeira secção do editor)
//     → A subsecção segue sem pagebreak adicional
//   Subsecções seguintes (1.2, 1.3…) inserem-se sem pagebreak, fluindo após o pai.
//
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useWorkSession } from '@/hooks/useWorkSession';
import { useCoverAgent } from '@/hooks/useCoverAgent';
import { useEditorActions } from '@/hooks/useEditorStore';
import { CoverFormModal } from '@/components/CoverFormModal';
import { AudioInputButton } from '@/components/AudioInputButton';
import { ProcessingBars } from '@/components/ProcessingBars';
import { ResourceUploadStep } from '@/components/ResourceUploadStep';
import { workTheme as C } from '@/lib/theme';
import type { CoverData } from '@/lib/docx/cover-types';
import type { WorkSection } from '@/lib/work/types';

interface Props {
  onInsert: (text: string) => void;
  onTopicChange: (topic: string) => void;
  onClose: () => void;
  isMobile?: boolean;
  editorMarkdown?: string;
}

// ── Normalização de título para comparação ────────────────────────────────────

function normalizeTitleForMatch(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[ivxlcdm]+\.\s*/i, '')   // remove I., II., III.
    .replace(/^\d+(\.\d+)?\.\s*/, '')    // remove 1., 1.1.
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentStartsWithTitle(content: string, sectionTitle: string): boolean {
  const firstLine = content.trimStart().split('\n')[0].trim();
  if (!firstLine.startsWith('#')) return false;
  const headingText = firstLine.replace(/^#+\s*/, '');
  const normalizedHeading = normalizeTitleForMatch(headingText);
  const normalizedTitle = normalizeTitleForMatch(sectionTitle);
  return (
    normalizedHeading === normalizedTitle ||
    normalizedHeading.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedHeading)
  );
}

// ── Helpers para heading pai do Desenvolvimento Teórico ───────────────────────

/**
 * Extrai o título do capítulo pai (## N. Título) a partir do esboço.
 * Recebe o número pai como string, ex: "1"
 */
function getParentTitleFromOutline(outline: string, parentNum: string): string | null {
  for (const line of outline.split('\n')) {
    // Aceita formatos: ## 1. Desenvolvimento Teórico  ou  ## 1 Desenvolvimento Teórico
    const match = line.match(/^##\s+(\d+)\.?\s+(.+)/);
    if (match && match[1] === parentNum) {
      return `${match[1]}. ${match[2].trim()}`;
    }
  }
  return null;
}

/**
 * Reconstrói o conteúdo do editor a partir das secções desenvolvidas,
 * inserindo automaticamente os headings pai para as subsecções numéricas.
 * Usado na restauração de sessão e no reset do editor.
 */
function buildReconstructedContent(
  sections: WorkSection[],
  outline: string | null,
): string {
  const sorted = [...sections]
    .filter(s => s.content.trim())
    .sort((a, b) => a.index - b.index);

  const parts: string[] = [];
  const insertedParentNums = new Set<string>();

  for (const section of sorted) {
    const isSubsection = /^\d+\.\d+/.test(section.title);
    const heading = isSubsection ? '###' : '##';
    const hasHeading = contentStartsWithTitle(section.content, section.title);
    const body = hasHeading
      ? section.content
      : `${heading} ${section.title}\n\n${section.content}`;

    if (isSubsection && outline) {
      const parentMatch = section.title.match(/^(\d+)\.\d+/);
      if (parentMatch) {
        const parentNum = parentMatch[1];

        // Insere o heading pai antes da primeira subsecção deste grupo
        if (!insertedParentNums.has(parentNum)) {
          const parentTitle = getParentTitleFromOutline(outline, parentNum);
          if (parentTitle) {
            const parentBlock = `## ${parentTitle}`;
            parts.push(parts.length === 0 ? parentBlock : `{pagebreak}\n\n${parentBlock}`);
            insertedParentNums.add(parentNum);
          }
        }

        // Subsecção segue sem pagebreak (flui depois do heading pai)
        parts.push(body);
        continue;
      }
    }

    // Secção autónoma (Introdução, Objectivos, Metodologia, Conclusão, Referências…)
    parts.push(parts.length === 0 ? body : `{pagebreak}\n\n${body}`);
  }

  return parts.join('\n\n');
}

/**
 * buildSectionMarkdown — A ÚNICA função que decide heading, pagebreak e numeração
 * para inserção individual de uma secção no editor.
 *
 * Regras de heading:
 *   - Subsecções (ex: "1.1 Conceito X") → ### (três cerquilhas)
 *   - Todas as outras                   → ## (duas cerquilhas)
 *
 * Regras de pagebreak:
 *   - Subsecções sem pai               → NUNCA pagebreak (fluem na mesma página)
 *   - Subsecções com pai (1ª do grupo) → o heading pai recebe o pagebreak, subsecção segue
 *   - Secções principais, 1ª no editor → SEM pagebreak
 *   - Secções principais, restantes    → COM {pagebreak} antes
 *
 * @param title           Título da secção (ex: "I. Introdução", "1.1 Conceito X")
 * @param content         Conteúdo puro da secção (sem pagebreaks, sem título)
 * @param isFirstInEditor true se o editor estiver vazio quando esta secção é inserida
 * @param parentTitle     Título do capítulo pai (ex: "1. Desenvolvimento Teórico"), apenas
 *                        quando esta é a primeira subsecção do grupo a ser inserida
 */
function buildSectionMarkdown(
  title: string,
  content: string,
  isFirstInEditor: boolean,
  parentTitle?: string | null,
): string {
  const isSubsection = /^\d+\.\d+/.test(title);
  const heading = isSubsection ? '###' : '##';

  const titleAlreadyPresent = contentStartsWithTitle(content, title);
  const body = titleAlreadyPresent ? content : `${heading} ${title}\n\n${content}`;

  if (isSubsection) {
    if (parentTitle) {
      // Primeira subsecção do grupo: heading pai + subsecção, com pagebreak se necessário
      const fullBlock = `## ${parentTitle}\n\n${body}`;
      return isFirstInEditor ? fullBlock : `{pagebreak}\n\n${fullBlock}`;
    }
    // Subsecções seguintes: sem pagebreak, fluem após o heading pai já inserido
    return body;
  }

  // Secções autónomas
  return isFirstInEditor ? body : `{pagebreak}\n\n${body}`;
}

export function WorkPanel({ onInsert, onTopicChange, onClose, isMobile = false, editorMarkdown }: Props) {
  const {
    step, session, streamingText, activeSectionIdx, error, progressPct, recentSessions,
    reset, startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession, isSectionRegenerated,
    skipResources, confirmResources, uploadRagFile, uploadingRag,
  } = useWorkSession();

  const coverAgent = useCoverAgent();
  const { setIncludeCover, setCoverData, resetExportPreferences, setContent } = useEditorActions();

  const [topicInput, setTopicInput] = useState('');
  const [outlineEdit, setOutlineEdit] = useState('');
  const [outlineSuggestions, setOutlineSuggestions] = useState('');
  const [isApprovingOutline, setIsApprovingOutline] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [resumeRestoreSessionId, setResumeRestoreSessionId] = useState<string | null>(null);
  const [processingButtonId, setProcessingButtonId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const sessionsTopRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoModeRef = useRef(false);
  const handleInsertRef = useRef<(idx: number) => void>(() => {});
  const developSectionRef = useRef<(idx: number) => void>(() => {});
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionsRegionId = 'work-recent-sessions';
  const isProcessing = useCallback((id: string) => processingButtonId === id, [processingButtonId]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      const res = await fetch(`/api/work/session?id=${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Não foi possível excluir o trabalho');
      await loadSessions();
    } catch {
      // ignorar por agora; erros já aparecem em requests seguintes
    } finally {
      setDeletingSessionId(null);
    }
  }, [loadSessions]);

  const vars = useMemo(() => ({
    '--panel-bg':         C.bg,
    '--panel-surface':    C.surface,
    '--panel-border':     C.border,
    '--panel-accent':     C.accent,
    '--panel-accent-dim': C.accentDim,
    '--panel-muted':      C.muted,
    '--panel-text':       C.text,
    '--panel-text-dim':   C.textDim,
    '--panel-text-faint': C.textFaint,
    '--panel-gold':       C.gold,
  } as CSSProperties), []);

  // ── Scroll automático ─────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, step, coverAgent.streamingAbstract]);

  useEffect(() => {
    if (step === 'review_outline') {
      setOutlineEdit(session?.outline_draft ?? '');
      setOutlineSuggestions('');
    }
  }, [step, session]);

  useEffect(() => {
    if (showSessions) loadSessions();
  }, [showSessions, loadSessions]);

  useEffect(() => {
    if (!showSessions) return;
    sessionsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showSessions, recentSessions.length]);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  // ── Restaurar sessão retomada ─────────────────────────────────────────────
  // Usa buildReconstructedContent para incluir headings pai automaticamente

  useEffect(() => {
    if (!resumeRestoreSessionId || !session || session.id !== resumeRestoreSessionId) return;

    const completedSections = session.sections.filter(
      s => s.status !== 'pending' && s.content.trim(),
    );

    const outline = session.outline_approved ?? session.outline_draft ?? null;
    const editorContent = buildReconstructedContent(completedSections, outline);

    setContent(editorContent);
    setResumeRestoreSessionId(null);
  }, [resumeRestoreSessionId, session, setContent]);

  // ── Sincronizar estado do agente de capa com o editor ─────────────────────

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

  // ── Iniciar agente quando esboço é aprovado ───────────────────────────────

  useEffect(() => {
    if (step === 'outline_approved' && coverAgent.step === 'idle' && session) {
      const existingCover = session.cover_data ?? null;

      if (existingCover) {
        coverAgent.restoreCoverData(existingCover);
        setIncludeCover(true);
        setCoverData(existingCover);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Submissão do formulário de capa ───────────────────────────────────────

  const handleCoverSubmit = async (coverData: CoverData) => {
    setShowCoverModal(false);
    if (!session) return;

    const finalData = await coverAgent.submitCoverData(
      coverData,
      session.topic,
      session.outline_approved ?? session.outline_draft ?? '',
      () => {},
    );

    if (finalData) {
      try {
        await fetch('/api/work/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _action: 'saveCoverData',
            sessionId: session.id,
            coverData: finalData,
          }),
        });
      } catch {
        console.warn('Não foi possível persistir dados de capa no servidor.');
      }
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  /**
   * handleInsertSection — insere uma secção no editor com pagebreak, numeração
   * e heading pai corretos.
   *
   * Lógica de heading pai:
   *   - Se a secção é uma subsecção (ex: "1.1 Foo") E é a PRIMEIRA do seu grupo
   *     a ser inserida → o heading pai (ex: "## 1. Desenvolvimento Teórico") é
   *     automaticamente prefixado, com {pagebreak} se necessário.
   *   - Subsecções seguintes (1.2, 1.3…) fluem sem pagebreak após o pai.
   */
  const handleInsertSection = useCallback((sectionIndex: number) => {
    if (!session) return;
    setProcessingButtonId(`insert-section-${sectionIndex}`);
    const sec = session.sections[sectionIndex];
    if (!sec?.content) return;

    const hasContentInEditor = Boolean(editorMarkdown?.trim());
    const shouldResetEditor = hasContentInEditor && isSectionRegenerated(sectionIndex);

    if (shouldResetEditor) {
      // Regeneração: o hook reconstrói todo o conteúdo; o hook também usa
      // buildReconstructedContent para incluir headings pai (ver useWorkSession.ts)
      insertSection(sectionIndex, onInsert, {
        shouldResetEditor: true,
        onReplace: setContent,
      });
    } else {
      const isFirstInEditor = !hasContentInEditor;

      // Detectar se é subsecção e se é a primeira do grupo a ser inserida
      let parentTitle: string | null = null;
      const parentNumMatch = sec.title.match(/^(\d+)\.\d+/);
      if (parentNumMatch) {
        const parentNum = parentNumMatch[1];
        const hasSiblingAlreadyInserted = session.sections.some(s => {
          const m = s.title.match(/^(\d+)\.\d+/);
          return m && m[1] === parentNum && s.status === 'inserted';
        });

        if (!hasSiblingAlreadyInserted) {
          const outline = session.outline_approved ?? session.outline_draft ?? '';
          parentTitle = getParentTitleFromOutline(outline, parentNum);
        }
      }

      const textToInsert = buildSectionMarkdown(sec.title, sec.content, isFirstInEditor, parentTitle);
      insertSection(sectionIndex, () => onInsert(textToInsert));
    }
  }, [session, editorMarkdown, isSectionRegenerated, insertSection, onInsert, setContent]);

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

  useEffect(() => {
    if (!processingButtonId) return;

    const shouldClear =
      (processingButtonId === 'start-new' && step === 'topic_input') ||
      (processingButtonId === 'toggle-sessions') ||
      (processingButtonId.startsWith('resume-session-') && !!session) ||
      (processingButtonId === 'submit-topic' && step === 'generating_outline') ||
      (processingButtonId === 'approve-outline' && step !== 'review_outline') ||
      (processingButtonId === 'regenerate-outline' && step === 'generating_outline') ||
      (processingButtonId.startsWith('develop-section-') && step === 'developing') ||
      (processingButtonId.startsWith('insert-section-') && step === 'outline_approved') ||
      (processingButtonId === 'back-to-outline' && step === 'outline_approved') ||
      (processingButtonId === 'reset-work' && step === 'idle');

    if (shouldClear) setProcessingButtonId(null);
  }, [processingButtonId, step, session]);

  const statusLabel = (status: string) => {
    if (status === 'inserted') return { label: 'Inserido ✓', color: C.gold };
    if (status === 'developed') return { label: 'Desenvolvido', color: C.accent };
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
    <>
      {showCoverModal && (
        <CoverFormModal
          onSubmit={handleCoverSubmit}
          onCancel={() => { setShowCoverModal(false); coverAgent.reset(); }}
          isMobile={isMobile}
        />
      )}

      <div style={vars} className={`flex h-full flex-col bg-[var(--panel-bg)] ${isMobile ? '' : 'border-l border-[var(--panel-border)]'}`}>

        {/* Cabeçalho */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📚</span>
            <span className="font-mono text-[13px] tracking-[0.06em] text-[var(--panel-accent)]">Trabalho Escolar</span>
            {session && (
              <span className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--panel-text-faint)]">
                {session.topic.length > 28 ? `${session.topic.slice(0, 28)}…` : session.topic}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {session && (
              <button
                onClick={() => {
                  setProcessingButtonId('reset-work');
                  if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
                  autoModeRef.current = false;
                  setAutoMode(false);
                  coverAgent.reset();
                  reset();
                  resetExportPreferences();
                }}
                className={`rounded px-1.5 py-0.5 font-mono text-lg leading-none text-[var(--panel-muted)] ${isProcessing('reset-work') ? 'animate-pulse [animation-duration:1.6s]' : ''}`}
                title="Novo trabalho"
                aria-label="Iniciar novo trabalho"
              >
                {isProcessing('reset-work') ? <ProcessingBars height={14} /> : '↩'}
              </button>
            )}
            <button onClick={onClose} className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--panel-text-faint)]" title="Fechar" aria-label="Fechar painel">×</button>
          </div>
        </div>

        {/* Barra de progresso */}
        {session && (
          <div className="shrink-0 border-b border-[var(--panel-border)] px-4 py-2">
            <div className="mb-1 flex justify-between">
              <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--panel-text-dim)]">PROGRESSO</span>
              <span className="font-mono text-[10px] text-[var(--panel-accent)]">{progressPct}%</span>
            </div>
            <div className="h-[3px] overflow-hidden rounded bg-[var(--panel-border)]">
              <div
                className="h-full rounded transition-[width] duration-700"
                style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.muted}, ${C.accent})` }}
              />
            </div>
          </div>
        )}

        {/* Corpo */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">

          {/* ── IDLE ── */}
          {step === 'idle' && (
            <div className="mt-8 text-center">
              {showSessions && (
                <div ref={sessionsTopRef} id={sessionsRegionId} className="mb-4 flex flex-col gap-1.5 text-left">
                  {recentSessions.length === 0 && (
                    <p className="font-mono text-[11px] text-[var(--panel-text-faint)]">Nenhum trabalho anterior encontrado.</p>
                  )}
                  {recentSessions.map(s => (
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
                        {isProcessing(`resume-session-${s.id}`) ? (
                          <span className="ml-2 rounded border border-current px-1.5 py-0.5">
                            <ProcessingBars height={12} barClassName="opacity-90" />
                          </span>
                        ) : (
                          <span className="ml-2 rounded border border-current px-1.5 py-0.5 font-mono text-[10px] text-[var(--panel-muted)]">
                            {s.status === 'completed' ? 'Concluído' : s.status === 'in_progress' ? 'Em curso' : s.status === 'outline_approved' ? 'Aprovado' : 'Esboço'}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        disabled={deletingSessionId === s.id}
                        className="flex min-h-7 min-w-12 items-center justify-center rounded border border-red-900/60 px-2 py-1 font-mono text-[10px] text-red-300 transition-colors hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Excluir trabalho"
                        aria-label={`Excluir trabalho ${s.topic}`}
                      >
                        {deletingSessionId === s.id ? <ProcessingBars height={12} barColor="#fca5a5" /> : 'Excluir'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-3 text-[2.5rem]">📚</div>
              <p className="mb-6 font-mono text-[13px] leading-[1.65] text-[var(--panel-text-dim)]">
                Copiloto para trabalhos do ensino secundário e médio.<br />
                Gera e desenvolve cada secção do teu trabalho.
              </p>
              <div className="mb-5 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 text-left">
                <div className="mb-2 font-mono text-[10px] tracking-[0.08em] text-[var(--panel-text-dim)]">ESTRUTURA DO TRABALHO</div>
                {[
                  'I. Introdução',
                  'II. Objectivos',
                  'III. Metodologia',
                  '1. Desenvolvimento Teórico',
                  '  1.1, 1.2, 1.3… Subsecções',
                  'Conclusão',
                  'Referências Bibliográficas',
                ].map((s) => (
                  <div key={s} className={`py-0.5 font-mono text-[11px] ${s.startsWith('  ') ? 'pl-3 text-[var(--panel-text-faint)]' : 'text-[var(--panel-text-dim)]'}`}>{s}</div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <Btn onClick={() => {
                  setProcessingButtonId('start-new');
                  if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
                  autoModeRef.current = false;
                  setAutoMode(false);
                  startNew();
                  setShowSessions(false);
                }} color={C.accent} processing={isProcessing('start-new')}>✦ Iniciar trabalho</Btn>
                <Btn
                  onClick={() => { setProcessingButtonId('toggle-sessions'); setShowSessions(v => !v); }}
                  color={C.muted}
                  outline
                  processing={isProcessing('toggle-sessions')}
                  ariaLabel={showSessions ? 'Ocultar trabalhos' : 'Mostrar trabalhos'}
                  ariaExpanded={showSessions}
                  ariaControls={sessionsRegionId}
                >
                  ↩ Retomar trabalho
                </Btn>
              </div>

            </div>
          )}

          {/* ── TOPIC INPUT ── */}
          {step === 'topic_input' && (
            <div className="flex flex-col gap-3">
              <Label>Qual é o tema do trabalho?</Label>
              <div className="flex items-end gap-2">
                <textarea
                  value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }}
                  placeholder="Ex: A importância da água potável para a saúde pública em Moçambique"
                  rows={4}
                  autoFocus
                  className="flex-1 resize-none rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-xs leading-[1.6] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]"
                />
                <AudioInputButton onTranscription={text => setTopicInput(prev => (prev ? `${prev} ${text}` : text))} className="py-2" />
              </div>
                <Btn onClick={handleTopicSubmit} color={C.accent} disabled={!topicInput.trim()} processing={isProcessing('submit-topic')}>✦ Continuar para recursos</Btn>
            </div>
          )}

          {step === 'resource_upload' && session && (
            <ResourceUploadStep
              sessionId={session.id}
              onUpload={uploadRagFile}
              onConfirm={confirmResources}
              onSkip={skipResources}
              uploading={uploadingRag}
            />
          )}

          {/* ── GENERATING OUTLINE ── */}
          {step === 'generating_outline' && (
            <div>
              <Label>A gerar esboço orientador…</Label>
              <StreamBox text={streamingText} showProcessing={!streamingText.trim()} />
            </div>
          )}

          {/* ── REVIEW OUTLINE ── */}
          {step === 'review_outline' && (
            <div className="flex flex-col gap-3">
              <Label>Esboço gerado. Podes editar antes de aprovar.</Label>
              <div className="flex items-end gap-2">
                <textarea
                  value={outlineEdit}
                  onChange={e => setOutlineEdit(e.target.value)}
                  rows={16}
                  className="min-h-32 flex-1 resize-y rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]"
                />
                <AudioInputButton onTranscription={text => setOutlineEdit(prev => (prev ? `${prev}\n${text}` : text))} className="py-2" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Podes pedir ajustes antes de aprovar.</Label>
                <div className="flex items-center gap-2">
                  <input
                    value={outlineSuggestions}
                    onChange={e => setOutlineSuggestions(e.target.value)}
                    placeholder="Ex: incluir mais foco em impactos sociais e exemplos locais"
                    className="flex-1 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[11px] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)]"
                  />
                  <AudioInputButton onTranscription={text => setOutlineSuggestions(prev => (prev ? `${prev} ${text}` : text))} className="py-2" />
                </div>
              </div>
              <div className="flex gap-2">
                <Btn onClick={handleApproveOutline} color={C.accent} flex disabled={isApprovingOutline} processing={isProcessing('approve-outline')}>
                  {isApprovingOutline ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/35 border-t-black" />
                      Pensando...
                    </span>
                  ) : '✓ Aprovar esboço'}
                </Btn>
                <Btn
                  onClick={() => { setProcessingButtonId('regenerate-outline'); requestNewOutline(outlineSuggestions); }}
                  color={C.muted}
                  outline
                  flex
                  disabled={isApprovingOutline}
                  processing={isProcessing('regenerate-outline')}
                >
                  ↻ Regenerar
                </Btn>
              </div>
            </div>
          )}

          {/* ── ESCOLHA DE CAPA (instantâneo, sem LLM) ── */}
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
                  className="text-left font-mono text-[10px] text-[var(--panel-faint)] underline transition-colors hover:text-[var(--panel-muted)]"
                >
                  Saltar — desenvolver sem capa
                </button>
              </div>
            </div>
          )}

          {/* ── Streaming do abstract ── */}
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

          {/* ── Badge de capa gerada ── */}
          {step === 'outline_approved' && coverAgent.step === 'done_with_cover' && coverAgent.coverData && (
            <div className="rounded border border-[color:var(--panel-gold)]/30 bg-[color:var(--panel-gold)]/10 px-3 py-2.5">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--panel-gold)]">📄 Capa disponível</div>
              <p className="font-mono text-[11px] text-[var(--panel-text)]">
                {coverAgent.coverData.theme && (
                  <span className="block mb-1 text-[var(--panel-muted)]">Tema: {coverAgent.coverData.theme}</span>
                )}
                {coverAgent.coverData.members?.length && (
                  <span className="block text-[var(--panel-muted)]">{coverAgent.coverData.members.length} membro(s) · {coverAgent.coverData.teacher}</span>
                )}
              </p>
            </div>
          )}

          {/* ── SECÇÕES ── */}
          {(step === 'outline_approved' || step === 'developing' || step === 'section_ready') &&
           (coverAgent.step === 'done_with_cover' || coverAgent.step === 'done_without_cover' || coverAgent.step === 'idle') &&
           session && (
            <div className="flex flex-col gap-2">
              <Label>
                Esboço aprovado. Selecciona uma secção para desenvolver.
              </Label>

              <div className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[10px] leading-[1.5] text-[var(--panel-text-faint)]">
                ↕ Cada secção principal começa numa nova página. O título "Desenvolvimento Teórico" é inserido automaticamente com a primeira subsecção.
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

              {session.sections.map(sec => {
                const { label, color } = statusLabel(sec.status);
                const isActive = activeSectionIdx === sec.index;
                const isInserted = sec.status === 'inserted';
                const isDeveloping = isActive && step === 'developing';
                const isBusy = activeSectionIdx !== null;
                const isSubsection = /^\d+\.\d+/.test(sec.title);

                return (
                  <div
                    key={sec.index}
                    className={`flex items-center justify-between gap-2 rounded border px-3 py-2.5 transition-all ${
                      isActive
                        ? 'border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent-dim)]/20'
                        : 'border-[var(--panel-border)] bg-[var(--panel-surface)]'
                    } ${isSubsection ? 'ml-3' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs font-medium text-[var(--panel-text)]">
                        {isSubsection && <span className="mr-1 text-[var(--panel-text-faint)]">↳</span>}
                        {sec.title}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px]" style={{ color }}>{label}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {sec.status !== 'pending' && (
                        <button
                          onClick={() => !isInserted && handleInsertSection(sec.index)}
                          disabled={isInserted}
                          className={`flex h-7 ${isProcessing(`insert-section-${sec.index}`) ? 'px-2' : 'w-7'} items-center justify-center rounded border font-mono text-[13px] transition-all ${
                            isInserted
                              ? 'cursor-default border-[color:var(--panel-gold)]/20 text-[color:var(--panel-gold)]/40'
                              : 'border-[color:var(--panel-gold)]/30 text-[var(--panel-gold)] hover:bg-[color:var(--panel-gold)]/10'
                          } ${isProcessing(`insert-section-${sec.index}`) ? 'animate-pulse [animation-duration:1.6s]' : ''}`}
                          title={isInserted ? 'Já inserido' : 'Inserir no editor'}
                          aria-label={isInserted ? `${sec.title} já inserida` : `Inserir ${sec.title}`}
                        >
                          {isProcessing(`insert-section-${sec.index}`)
                            ? <ProcessingBars height={14} barClassName="opacity-90" />
                            : isInserted ? '✓' : '↓'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isBusy) return;
                          setProcessingButtonId(`develop-section-${sec.index}`);
                          developSection(sec.index);
                        }}
                        disabled={isBusy}
                        className={`flex h-7 ${isProcessing(`develop-section-${sec.index}`) ? 'px-2' : 'w-7'} items-center justify-center rounded border font-mono text-[13px] transition-all ${
                          isDeveloping
                            ? 'animate-pulse border-[var(--panel-accent)] bg-[var(--panel-accent-dim)] text-[var(--panel-accent)]'
                            : isBusy
                              ? 'cursor-not-allowed border-[var(--panel-accent-dim)] text-[var(--panel-accent)] opacity-30'
                              : 'border-[var(--panel-accent-dim)] text-[var(--panel-accent)] hover:bg-[var(--panel-accent-dim)]'
                        } ${isProcessing(`develop-section-${sec.index}`) ? 'animate-pulse [animation-duration:1.6s]' : ''}`}
                        title={isDeveloping ? 'A desenvolver…' : sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'}
                        aria-label={sec.status === 'pending' ? `Desenvolver ${sec.title}` : `Reescrever ${sec.title}`}
                      >
                        {isProcessing(`develop-section-${sec.index}`)
                          ? <ProcessingBars height={14} />
                          : isDeveloping ? '⋯' : sec.status === 'pending' ? '✦' : '↻'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {progressPct === 100 && (
                <div className="mt-2 rounded border border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent)]/20 p-3 text-center">
                  <div className="mb-1 text-2xl">🎓</div>
                  <div className="font-mono text-xs text-[var(--panel-accent)]">Trabalho concluído!</div>
                </div>
              )}
            </div>
          )}

          {/* ── DEVELOPING ── */}
          {step === 'developing' && (
            <div>
              {session && activeSectionIdx !== null && (
                <Label>A desenvolver: <span className="text-[var(--panel-accent)]">{session.sections[activeSectionIdx]?.title}</span></Label>
              )}
              <StreamBox text={streamingText} showProcessing={!streamingText.trim()} />
            </div>
          )}

          {/* ── SECTION READY ── */}
          {step === 'section_ready' && session && activeSectionIdx !== null && (
            <div className="mt-2 flex flex-col gap-3">
              <Label>Secção pronta: <span className="text-[var(--panel-accent)]">{session.sections[activeSectionIdx]?.title}</span></Label>
              <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)]">
                {streamingText}
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => handleInsertSection(activeSectionIdx)} color={C.accent} flex processing={isProcessing(`insert-section-${activeSectionIdx}`)}>↓ Inserir no editor</Btn>
                <Btn
                  onClick={() => { setProcessingButtonId('back-to-outline'); backToOutline(); }}
                  color={C.muted}
                  outline
                  flex
                  processing={isProcessing('back-to-outline')}
                >
                  ← Voltar
                </Btn>
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
      </div>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StreamBox({ text, showProcessing = false }: { text: string; showProcessing?: boolean }) {
  return (
    <div className="mt-2 max-h-[380px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.7] text-[var(--panel-text)]">
      {text || (showProcessing ? <ProcessingBars className="h-6" /> : <span className="text-[var(--panel-text-faint)]">▋</span>)}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 font-mono text-[11px] leading-[1.55] tracking-[0.02em] text-[var(--panel-text-dim)]">
      {children}
    </p>
  );
}

function Btn({
  onClick, color, children, outline, flex, disabled, ariaLabel, ariaExpanded, ariaControls, processing,
}: {
  onClick: () => void;
  color: string;
  children: ReactNode;
  outline?: boolean;
  flex?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  processing?: boolean;
}) {
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
      style={{
        background: outline ? 'transparent' : hov ? color : `${color}cc`,
        borderColor: `${color}${outline ? '88' : '00'}`,
        color: outline ? color : '#131313',
        opacity: disabled || processing ? 0.4 : 1,
        cursor: disabled || processing ? 'not-allowed' : 'pointer',
      }}
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
