'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTccSession } from '@/hooks/useTccSession';
import { useCoverAgent } from '@/hooks/useCoverAgent';
import { useEditorActions } from '@/hooks/useEditorStore';
import { ContextCompressionBadge } from '@/components/ContextCompressionBadge';
import { CoverFormModal } from '@/components/CoverFormModal';
import { AudioInputButton } from '@/components/AudioInputButton';
import type { TccSection } from '@/lib/tcc/types';
import type { CoverData } from '@/lib/docx/cover-types';
import { tccTheme as C } from '@/lib/theme';

interface Props {
  onInsert: (text: string) => void;
  onTopicChange: (topic: string) => void;
  onClose: () => void;
  isMobile?: boolean;
  /** Conteúdo actual do editor — usado para detectar se está vazio e para regeneração */
  editorMarkdown?: string;
}

interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
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
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [agentSending, setAgentSending] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionsRegionId = 'tcc-recent-sessions';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, step, agentMessages, coverAgent.streamingAbstract]);

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

    setAgentMessages([]);
    coverAgent.askAboutCover(
      session.topic,
      session.outline_approved ?? session.outline_draft ?? '',
      (role, content) => setAgentMessages(prev => [...prev, { role, content }]),
    );
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
    onTopicChange(topic);
    submitTopic(topic);
  };

  const handleApproveOutline = async () => {
    if (isApprovingOutline) return;
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
    coverAgent.reset();
    resetExportPreferences();
    setAgentMessages([]);
    setAgentInput('');
    setShowCoverModal(false);
    reset();
  };

  const handleAgentSend = async () => {
    const text = agentInput.trim();
    if (!text || agentSending || !session) return;

    setAgentMessages(prev => [...prev, { role: 'user', content: text }]);
    setAgentInput('');
    setAgentSending(true);

    await coverAgent.handleUserResponse(
      text,
      session.topic,
      session.outline_approved ?? session.outline_draft ?? '',
      agentMessages,
      (role, content) => setAgentMessages(prev => [...prev, { role, content }]),
      () => setShowCoverModal(true),
    );

    setAgentSending(false);
  };

  const handleCoverSubmit = async (coverData: CoverData) => {
    setShowCoverModal(false);
    if (!session) return;

    const finalData = await coverAgent.submitCoverData(
      coverData,
      session.topic,
      session.outline_approved ?? session.outline_draft ?? '',
      (role, content) => setAgentMessages(prev => [...prev, { role, content }]),
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
    insertSection(sectionIndex, onInsert, {
      editorMarkdown,
      onReplace: setContent,
    });
  }, [session, insertSection, onInsert, editorMarkdown, setContent]);

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
              <button onClick={handleResetSession} className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--panel-muted)]" title="Nova sessão" aria-label="Iniciar nova sessão de TCC">↩</button>
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
              <Btn onClick={() => { startNew(); setShowSessions(false); }} color={C.accent}>✦ Iniciar novo TCC</Btn>
              <Btn onClick={() => setShowSessions((v) => !v)} color={C.muted} outline ariaLabel={showSessions ? 'Ocultar lista de sessões anteriores de TCC' : 'Mostrar lista de sessões anteriores de TCC'} ariaExpanded={showSessions} ariaControls={sessionsRegionId}>↩ Retomar sessão anterior</Btn>
            </div>

            {showSessions && (
              <div id={sessionsRegionId} className="mt-4 flex flex-col gap-1.5">
                {recentSessions.length === 0 && <p className="font-mono text-[11px] text-[var(--panel-text-faint)]">Nenhuma sessão anterior encontrada.</p>}
                {recentSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-2 py-2">
                    <button onClick={() => { onTopicChange(s.topic); resumeSession(s.id); }} className="flex min-w-0 flex-1 items-center justify-between rounded px-1 py-0.5 text-left transition-colors hover:text-[var(--panel-accent)]">
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
                      className="rounded border border-red-900/60 px-2 py-1 font-mono text-[10px] text-red-300 transition-colors hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Excluir sessão"
                      aria-label={`Excluir sessão ${s.topic}`}
                    >
                      {deletingSessionId === s.id ? '...' : 'Excluir'}
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

        {step === 'generating_outline' && <div><Label>A gerar esboço estrutural…</Label><StreamBox text={streamingText} /></div>}

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
              <Btn onClick={() => requestNewOutline(outlineSuggestions)} color={C.muted} outline flex disabled={isApprovingOutline}>↻ Regenerar com sugestões</Btn>
            </div>
          </div>
        )}

        {step === 'outline_approved' &&
         coverAgent.step !== 'idle' &&
         coverAgent.step !== 'done_with_cover' &&
         coverAgent.step !== 'done_without_cover' && (
          <div className="flex flex-col gap-3">
            {agentMessages.map((msg, i) => (
              <div key={i} className={`rounded border px-3 py-2.5 ${msg.role === 'assistant' ? 'border-[var(--panel-border)] bg-[var(--panel-surface)]' : 'border-[var(--panel-accent-dim)] bg-[color:var(--panel-accent-dim)]/25'}`}>
                <span className={`mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] ${msg.role === 'assistant' ? 'text-[var(--panel-accent)]' : 'text-[var(--panel-muted)]'}`}>
                  {msg.role === 'assistant' ? '✦ Assistente' : 'Tu'}
                </span>
                <p className="font-mono text-[11px] leading-[1.6] text-[var(--panel-text)]">{msg.content}</p>
              </div>
            ))}

            {coverAgent.step === 'generating_abstract' && coverAgent.streamingAbstract && (
              <div className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2.5">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--panel-gold)]">A gerar resumo…</span>
                <p className="font-mono text-[11px] leading-[1.6] text-[var(--panel-text)]">{coverAgent.streamingAbstract}</p>
              </div>
            )}

            {(coverAgent.step === 'asking' || coverAgent.step === 'awaiting_form') && (
              <div className="flex items-end gap-2">
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={agentInput}
                    onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAgentSend(); }}
                    placeholder="Responde ao assistente…"
                    disabled={agentSending}
                    className="flex-1 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[11px] text-[var(--panel-text)] outline-none caret-[var(--panel-accent)] focus:border-[var(--panel-accent-dim)] disabled:opacity-50"
                  />
                  <AudioInputButton
                    onTranscription={text => setAgentInput(prev => (prev ? `${prev} ${text}` : text))}
                    disabled={agentSending}
                    className="py-2"
                  />
                </div>
                <button
                  onClick={handleAgentSend}
                  disabled={agentSending || !agentInput.trim()}
                  className="h-8 w-8 rounded border border-[var(--panel-accent-dim)] font-mono text-[13px] text-[var(--panel-accent)] transition-all hover:bg-[var(--panel-accent-dim)] disabled:opacity-40"
                  aria-label="Enviar resposta ao agente de capa"
                >
                  {agentSending ? '⋯' : '↑'}
                </button>
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

        {(step === 'outline_approved' || step === 'section_ready') &&
         (coverAgent.step === 'done_with_cover' || coverAgent.step === 'done_without_cover' || coverAgent.step === 'idle') &&
         session && (
          <div className="flex flex-col gap-2">
            <Label>Esboço aprovado. Selecciona uma secção para desenvolver.</Label>

            {/* Nota explicativa sobre pagebreaks */}
            <div className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2 font-mono text-[10px] leading-[1.5] text-[var(--panel-text-faint)]">
              ↕ Cada secção principal começa numa nova página. Subsecções (1.1, 1.2…) fluem juntas no mesmo bloco.
            </div>

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
                        className="flex h-7 w-7 items-center justify-center rounded border border-[color:var(--panel-gold)]/30 font-mono text-[13px] text-[var(--panel-gold)]"
                        title="Inserir no editor"
                        aria-label={`Inserir secção ${sec.title} no editor`}
                      >
                        ↓
                      </button>
                    )}
                    <button
                      onClick={() => developSection(sec.index)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-[var(--panel-accent-dim)] font-mono text-[13px] text-[var(--panel-accent)]"
                      title={sec.status === 'pending' ? 'Desenvolver' : 'Reescrever'}
                      aria-label={sec.status === 'pending' ? `Desenvolver secção ${sec.title}` : `Reescrever secção ${sec.title}`}
                    >
                      {sec.status === 'pending' ? '✦' : '↻'}
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
            <StreamBox text={streamingText} />
          </div>
        )}

        {step === 'section_ready' && session && activeSectionIdx !== null && (
          <div className="mt-2 flex flex-col gap-3">
            <Label>Secção pronta: <span className="text-[var(--panel-accent)]">{session.sections.find((s) => s.index === activeSectionIdx)?.title}</span></Label>
            <div className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--panel-text)]">
              {streamingText}
            </div>
            <div className="flex gap-2">
              <Btn onClick={() => handleInsertSection(activeSectionIdx)} color={C.accent} flex>↓ Inserir no editor</Btn>
              <Btn onClick={backToOutline} color={C.muted} outline flex>← Voltar</Btn>
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
          onCancel={() => setShowCoverModal(false)}
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
      style={{ background: outline ? 'transparent' : hov ? color : `${color}cc`, borderColor: `${color}${outline ? '88' : '00'}`, color: outline ? color : '#131313', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
}
