'use client';

// src/components/RequerimentoFormModal.tsx
// Modal de formulário para geração de requerimentos académicos.
// Segue os padrões visuais de CoverFormModal.tsx e usa IndexedDB via hook.

import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { AudioInputButton } from '@/components/AudioInputButton';
import type { RequerimentoData } from '@/lib/docx/requerimento-types';
import { workTheme as C } from '@/lib/theme';
import { showAppAlert } from '@/lib/ui-alert';
import { useRequerimentoFormPersistence } from '@/hooks/useRequerimentoFormPersistence';
import type { RequerimentoFormDraft } from '@/lib/docx/requerimento-types';

interface Props {
  onSubmit: (data: RequerimentoData) => void;
  onCancel: () => void;
  isMobile?: boolean;
}

// ── Validação ─────────────────────────────────────────────────────────────────

function validate(f: RequerimentoFormDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.institution.trim())    e.institution    = 'Campo obrigatório';
  if (!f.courseHeader.trim())   e.courseHeader   = 'Campo obrigatório';
  if (!f.city.trim())           e.city           = 'Campo obrigatório';
  if (!f.recipientName.trim())  e.recipientName  = 'Campo obrigatório';
  if (!f.recipientModule.trim())e.recipientModule= 'Campo obrigatório';
  if (!f.recipientCity.trim())  e.recipientCity  = 'Campo obrigatório';
  if (!f.fullName.trim())       e.fullName       = 'Campo obrigatório';
  if (!f.fatherName.trim())     e.fatherName     = 'Campo obrigatório';
  if (!f.motherName.trim())     e.motherName     = 'Campo obrigatório';
  if (!f.birthDate.trim())      e.birthDate      = 'Campo obrigatório';
  if (!f.birthPlace.trim())     e.birthPlace     = 'Campo obrigatório';
  if (!f.docNumber.trim())      e.docNumber      = 'Campo obrigatório';
  if (!f.docIssueDate.trim())   e.docIssueDate   = 'Campo obrigatório';
  if (!f.docIssuePlace.trim())  e.docIssuePlace  = 'Campo obrigatório';
  if (!f.courseName.trim())     e.courseName     = 'Campo obrigatório';
  if (!f.courseLevel.trim())    e.courseLevel    = 'Campo obrigatório';
  if (!f.turma.trim())          e.turma          = 'Campo obrigatório';
  if (!f.requestPurpose.trim()) e.requestPurpose = 'Campo obrigatório';
  if (!f.submissionCity.trim()) e.submissionCity = 'Campo obrigatório';
  if (!f.submissionDate.trim()) e.submissionDate = 'Campo obrigatório';
  if (!f.requerenteRole.trim()) e.requerenteRole = 'Campo obrigatório';
  return e;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function RequerimentoFormModal({ onSubmit, onCancel, isMobile = false }: Props) {
  const { draft, setField, loading, clearDraft, hasDraft } = useRequerimentoFormPersistence();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [aiBrief, setAiBrief] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const docImageInputRef = useRef<HTMLInputElement>(null);

  const modalStyle: React.CSSProperties = {
    '--modal-bg':      '#0a0d0a',
    '--modal-surface': '#111611',
    '--modal-border':  '#1a2a1a',
    '--modal-accent':  C.accent,
    '--modal-text':    C.text,
    '--modal-muted':   C.textDim,
    '--modal-faint':   C.textFaint,
    '--modal-gold':    C.gold,
    '--modal-error':   '#c97070',
    ...(isMobile
      ? { maxHeight: 'calc(100dvh - 90px - env(safe-area-inset-bottom, 216px))' }
      : { maxHeight: '90vh' }),
  } as React.CSSProperties;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleText = useCallback(
    (key: keyof RequerimentoFormDraft) =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setField(key, e.target.value as any);
        setValidationErrors(prev => { const next = { ...prev }; delete next[key as string]; return next; });
      },
    [setField],
  );

  const handleToggle = useCallback(
    (key: keyof RequerimentoFormDraft) => () => {
      setField(key, !draft[key] as any);
    },
    [draft, setField],
  );

  const handleLogo = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
        showAppAlert({ title: 'Formato inválido', message: 'Use apenas PNG ou JPEG para o brasão.' });
        e.target.value = '';
        return;
      }
      const mediaType = file.type as 'image/png' | 'image/jpeg';
      const reader = new FileReader();
      reader.onload = ev => {
        setField('logoBase64', ev.target?.result as string);
        setField('logoMediaType', mediaType);
      };
      reader.readAsDataURL(file);
    },
    [setField],
  );

  const removeLogo = useCallback(() => {
    setField('logoBase64', '');
    setField('logoMediaType', '');
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, [setField]);

  const handleSubmit = useCallback(async () => {
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      showAppAlert({ title: 'Campos incompletos', message: 'Preenche todos os campos obrigatórios antes de continuar.' });
      return;
    }

    const data: RequerimentoData = {
      includeRepublica: draft.includeRepublica,
      institution:      draft.institution.trim().toLocaleUpperCase('pt-PT'),
      courseHeader:     draft.courseHeader.trim(),
      city:             draft.city.trim(),
      province:         draft.province.trim() || undefined,
      logoBase64:       draft.logoBase64 || undefined,
      logoMediaType:    draft.logoMediaType as 'image/png' | 'image/jpeg' | undefined,

      recipientTitle:   draft.recipientTitle.trim(),
      recipientName:    draft.recipientName.trim(),
      recipientModule:  draft.recipientModule.trim(),
      recipientCity:    draft.recipientCity.trim(),

      fullName:         draft.fullName.trim(),
      fatherName:       draft.fatherName.trim(),
      motherName:       draft.motherName.trim(),
      birthDate:        draft.birthDate.trim(),
      birthPlace:       draft.birthPlace.trim(),
      docNumber:        draft.docNumber.trim(),
      docIssueDate:     draft.docIssueDate.trim(),
      docIssuePlace:    draft.docIssuePlace.trim(),

      courseName:       draft.courseName.trim(),
      courseLevel:      draft.courseLevel.trim(),
      turma:            draft.turma.trim(),

      requestPurpose:   draft.requestPurpose.trim(),

      section1Title:    draft.section1Title.trim(),
      section1Content:  draft.section1Content.trim(),
      section2Title:    draft.section2Title.trim(),
      section2Content:  draft.section2Content.trim(),
      section3Title:    draft.section3Title.trim(),
      section3Content:  draft.section3Content.trim(),

      submissionCity:   draft.submissionCity.trim(),
      submissionDate:   draft.submissionDate.trim(),
      requerenteRole:   draft.requerenteRole.trim(),
    };

    await clearDraft();
    onSubmit(data);
  }, [draft, clearDraft, onSubmit]);



  const handleExtractFromImage = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      showAppAlert({ title: 'Formato inválido', message: 'Use PNG ou JPG.' });
      e.target.value = '';
      return;
    }
    setIsAiLoading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/requerimento/extract', { method: 'POST', body: form });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Falha ao extrair');
      const keys: Array<keyof RequerimentoFormDraft> = ['fullName','fatherName','motherName','birthDate','birthPlace','docNumber','docIssueDate','docIssuePlace','institution','courseName','courseLevel','turma','submissionCity','submissionDate','recipientName','recipientModule','recipientCity'];
      for (const k of keys) {
        const v = payload?.[k];
        if (typeof v === 'string' && v.trim()) setField(k, v);
      }
      showAppAlert({ title: 'Dados extraídos', message: 'A IA preencheu os campos reconhecidos da imagem.' });
    } catch (err) {
      showAppAlert({ title: 'Erro ao extrair', message: err instanceof Error ? err.message : 'Falha inesperada' });
    } finally {
      setIsAiLoading(false);
      e.target.value = '';
    }
  }, [setField]);

  const handleAssist = useCallback(async () => {
    if (!aiBrief.trim()) {
      showAppAlert({ title: 'Descrição em falta', message: 'Descreve primeiro o propósito para a IA redigir.' });
      return;
    }
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/requerimento/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: aiBrief }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Falha ao gerar sugestão');
      setField('requestPurpose', payload.requestPurpose ?? '');
      setField('section1Title', payload.section1Title ?? '');
      setField('section1Content', payload.section1Content ?? '');
      setField('section2Title', payload.section2Title ?? '');
      setField('section2Content', payload.section2Content ?? '');
      setField('section3Title', payload.section3Title ?? '');
      setField('section3Content', payload.section3Content ?? '');
      showAppAlert({ title: 'Sugestão aplicada', message: 'A IA preencheu propósito e secções opcionais.' });
    } catch (err) {
      showAppAlert({ title: 'Erro da IA', message: err instanceof Error ? err.message : 'Falha ao sugerir texto' });
    } finally {
      setIsAiLoading(false);
    }
  }, [aiBrief, setField]);

  const logoPreview = draft.logoBase64 || null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Formulário de requerimento"
        style={modalStyle}
        className={`fixed z-[71] bg-[var(--modal-bg)] border border-[var(--modal-border)] shadow-2xl flex flex-col transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'} ${
          isMobile
            ? 'inset-x-2 bottom-20 rounded-xl overflow-hidden'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] rounded-xl overflow-hidden'
        }`}
      >
        {/* Cabeçalho */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--modal-border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] tracking-[0.06em] text-[var(--modal-accent)]">
              📋 Dados do Requerimento
            </span>
            <span className="rounded border border-[var(--modal-border)] bg-[var(--modal-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--modal-faint)]">
              obrigatório
            </span>
            {hasDraft && !loading && (
              <span className="rounded border border-[var(--modal-accent)]/30 bg-[var(--modal-accent)]/10 px-1.5 py-px font-mono text-[9px] text-[var(--modal-accent)]">
                ✦ rascunho guardado
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--modal-faint)] hover:text-[var(--modal-text)]"
            aria-label="Fechar"
          >×</button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">

          <Section label="Preenchimento Inteligente por Imagem">
            <p className="font-mono text-[10px] text-[var(--modal-faint)]">Carrega foto do BI, ficha ou documento com dados; a IA tenta preencher os campos automaticamente.</p>
            <button onClick={() => docImageInputRef.current?.click()} disabled={isAiLoading} className="rounded border border-[var(--modal-border)] px-3 py-2 font-mono text-[10px] text-[var(--modal-accent)] hover:bg-[var(--modal-surface)] disabled:opacity-60">
              {isAiLoading ? 'A processar imagem…' : '🖼️ Extrair dados de imagem com IA'}
            </button>
            <input ref={docImageInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleExtractFromImage} />
          </Section>

          {/* ── CABEÇALHO INSTITUCIONAL ── */}
          <Section label="Cabeçalho Institucional">

            {/* Toggle República */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggle('includeRepublica')}
                className={`relative h-5 w-9 rounded-full transition-colors ${draft.includeRepublica ? 'bg-[var(--modal-accent)]' : 'bg-[var(--modal-border)]'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${draft.includeRepublica ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="font-mono text-[11px] text-[var(--modal-muted)]">Incluir "República de Moçambique"</span>
            </div>

            <Field label="Nome da instituição" required error={validationErrors.institution}>
              <Input value={draft.institution} onChange={handleText('institution')} placeholder="Ex: Instituto Industrial e Comercial 1º de Maio" hasError={!!validationErrors.institution} />
            </Field>
            <Field label="Curso e nível" required error={validationErrors.courseHeader}>
              <Input value={draft.courseHeader} onChange={handleText('courseHeader')} placeholder="Ex: Curso de Contabilidade, nível CV3" hasError={!!validationErrors.courseHeader} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" required error={validationErrors.city}>
                <Input value={draft.city} onChange={handleText('city')} placeholder="Ex: Quelimane" hasError={!!validationErrors.city} />
              </Field>
              <Field label="Província (opcional)">
                <Input value={draft.province} onChange={handleText('province')} placeholder="Ex: Zambézia" />
              </Field>
            </div>
          </Section>

          {/* ── BRASÃO (opcional) ── */}
          <Section label="Brasão / Logo (opcional)">
            {logoPreview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Brasão" className="h-14 w-14 rounded border border-[var(--modal-border)] object-contain bg-white p-1" />
                <button onClick={removeLogo} className="font-mono text-[11px] text-[var(--modal-error)] hover:underline">Remover brasão</button>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-[var(--modal-border)] py-3 font-mono text-[11px] text-[var(--modal-muted)] hover:border-[var(--modal-accent)] hover:text-[var(--modal-accent)] transition-colors"
              >
                <span>↑</span>
                <span>Carregar brasão da instituição (PNG / JPG)</span>
              </button>
            )}
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" onChange={handleLogo} className="hidden" />
          </Section>

          {/* ── DESTINATÁRIO ── */}
          <Section label="Destinatário">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tratamento" required>
                <Input value={draft.recipientTitle} onChange={handleText('recipientTitle')} placeholder="Ex: Exmo. Sr. Formador" hasError={false} />
              </Field>
              <Field label="Nome do destinatário" required error={validationErrors.recipientName}>
                <Input value={draft.recipientName} onChange={handleText('recipientName')} placeholder="Ex: Lucas Maribeu" hasError={!!validationErrors.recipientName} />
              </Field>
            </div>
            <Field label="Módulo / Cargo" required error={validationErrors.recipientModule}>
              <Input value={draft.recipientModule} onChange={handleText('recipientModule')} placeholder="Ex: Módulo de Projecto Integrado" hasError={!!validationErrors.recipientModule} />
            </Field>
            <Field label="Cidade do destinatário" required error={validationErrors.recipientCity}>
              <Input value={draft.recipientCity} onChange={handleText('recipientCity')} placeholder="Ex: Quelimane" hasError={!!validationErrors.recipientCity} />
            </Field>
          </Section>

          {/* ── DADOS PESSOAIS ── */}
          <Section label="Dados Pessoais do Requerente">
            <Field label="Nome completo" required error={validationErrors.fullName}>
              <Input value={draft.fullName} onChange={handleText('fullName')} placeholder="Ex: Saíde Omar Saíde" hasError={!!validationErrors.fullName} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do pai" required error={validationErrors.fatherName}>
                <Input value={draft.fatherName} onChange={handleText('fatherName')} placeholder="Ex: Omar Saíde" hasError={!!validationErrors.fatherName} />
              </Field>
              <Field label="Nome da mãe" required error={validationErrors.motherName}>
                <Input value={draft.motherName} onChange={handleText('motherName')} placeholder="Ex: Leonarda Setimane Sumila" hasError={!!validationErrors.motherName} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de nascimento" required error={validationErrors.birthDate}>
                <Input value={draft.birthDate} onChange={handleText('birthDate')} placeholder="Ex: 15 de Novembro de 2004" hasError={!!validationErrors.birthDate} />
              </Field>
              <Field label="Naturalidade" required error={validationErrors.birthPlace}>
                <Input value={draft.birthPlace} onChange={handleText('birthPlace')} placeholder="Ex: Tete" hasError={!!validationErrors.birthPlace} />
              </Field>
            </div>
            <Field label="Número do Bilhete de Identidade" required error={validationErrors.docNumber}>
              <Input value={draft.docNumber} onChange={handleText('docNumber')} placeholder="Ex: 040107977967N" hasError={!!validationErrors.docNumber} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de emissão do BI" required error={validationErrors.docIssueDate}>
                <Input value={draft.docIssueDate} onChange={handleText('docIssueDate')} placeholder="Ex: 26 de Agosto de 2024" hasError={!!validationErrors.docIssueDate} />
              </Field>
              <Field label="Local de emissão" required error={validationErrors.docIssuePlace}>
                <Input value={draft.docIssuePlace} onChange={handleText('docIssuePlace')} placeholder="Ex: cidade de Quelimane" hasError={!!validationErrors.docIssuePlace} />
              </Field>
            </div>
          </Section>

          {/* ── DADOS ACADÉMICOS ── */}
          <Section label="Dados Académicos">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Curso" required error={validationErrors.courseName}>
                <Input value={draft.courseName} onChange={handleText('courseName')} placeholder="Ex: Contabilidade" hasError={!!validationErrors.courseName} />
              </Field>
              <Field label="Nível" required error={validationErrors.courseLevel}>
                <Input value={draft.courseLevel} onChange={handleText('courseLevel')} placeholder="Ex: CV3" hasError={!!validationErrors.courseLevel} />
              </Field>
              <Field label="Turma" required error={validationErrors.turma}>
                <Input value={draft.turma} onChange={handleText('turma')} placeholder="Ex: B" hasError={!!validationErrors.turma} />
              </Field>
            </div>
          </Section>

          {/* ── PROPÓSITO DO PEDIDO ── */}
          <Section label="Propósito do Pedido">
            <Field label="Descrição breve para IA (opcional)">
              <div className="flex items-end gap-2">
                <Textarea
                  value={aiBrief}
                  onChange={e => setAiBrief(e.target.value)}
                  placeholder="Descreve em poucas linhas o pedido para a IA redigir o requerimento"
                  rows={2}
                  hasError={false}
                />
                <AudioInputButton onTranscription={(text) => setAiBrief(prev => (prev ? `${prev} ${text}` : text))} className="py-2" title="Áudio para descrição da IA" />
              </div>
              <button onClick={handleAssist} disabled={isAiLoading} className="mt-2 rounded border border-[var(--modal-border)] px-3 py-1.5 font-mono text-[10px] text-[var(--modal-accent)] hover:bg-[var(--modal-surface)] disabled:opacity-60">
                {isAiLoading ? 'A gerar com IA…' : '✦ Gerar propósito e secções com IA'}
              </button>
            </Field>
            <Field label="O que solicita (complemento do parágrafo de abertura)" required error={validationErrors.requestPurpose}>
              <Textarea
                value={draft.requestPurpose}
                onChange={handleText('requestPurpose')}
                placeholder="Ex: a aprovação do meu projecto para o Módulo de Projecto Integrado"
                hasError={!!validationErrors.requestPurpose}
                rows={2}
              />
            </Field>
            <div className="rounded border border-[var(--modal-border)] bg-[var(--modal-surface)] px-3 py-2">
              <p className="font-mono text-[10px] text-[var(--modal-faint)] leading-[1.6]">
                <span className="text-[var(--modal-muted)]">Prévia: </span>
                Eu, <strong>{draft.fullName || '[nome]'}</strong>... venho solicitar a Vossa Excelência{' '}
                <strong className="text-[var(--modal-accent)]">{draft.requestPurpose || '[propósito]'}</strong>...
              </p>
            </div>
          </Section>

          {/* ── SECÇÕES DO CORPO ── */}
          <Section label="Secção 1 (opcional)">
            <Field label="Título da secção 1">
              <Input value={draft.section1Title} onChange={handleText('section1Title')} placeholder="Ex: 1. Identificação do Projecto" hasError={false} />
            </Field>
            <Field label="Conteúdo">
              <Textarea value={draft.section1Content} onChange={handleText('section1Content')} placeholder="Descreve o projecto, iniciativa ou pedido em detalhe..." rows={5} hasError={false} />
            </Field>
          </Section>

          <Section label="Secção 2 (opcional)">
            <Field label="Título da secção 2">
              <Input value={draft.section2Title} onChange={handleText('section2Title')} placeholder="Ex: 2. Justificativa e Viabilidade" hasError={false} />
            </Field>
            <Field label="Conteúdo">
              <Textarea value={draft.section2Content} onChange={handleText('section2Content')} placeholder="Justifica o pedido com argumentos técnicos, económicos ou sociais..." rows={5} hasError={false} />
            </Field>
          </Section>

          <Section label="Secção 3 — Do Pedido (opcional)">
            <Field label="Título da secção 3">
              <Input value={draft.section3Title} onChange={handleText('section3Title')} placeholder="Ex: 3. Do Pedido" hasError={false} />
            </Field>
            <Field label="Conteúdo (deixar em branco para texto padrão)">
              <Textarea value={draft.section3Content} onChange={handleText('section3Content')} placeholder="Deixar em branco para usar o parágrafo de pedido padrão..." rows={3} hasError={false} />
            </Field>
          </Section>

          {/* ── ASSINATURA ── */}
          <Section label="Local, Data e Assinatura">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade de submissão" required error={validationErrors.submissionCity}>
                <Input value={draft.submissionCity} onChange={handleText('submissionCity')} placeholder="Ex: Quelimane" hasError={!!validationErrors.submissionCity} />
              </Field>
              <Field label="Data de submissão" required error={validationErrors.submissionDate}>
                <Input value={draft.submissionDate} onChange={handleText('submissionDate')} placeholder="Ex: 29 de Abril de 2026" hasError={!!validationErrors.submissionDate} />
              </Field>
            </div>
            <Field label="Papel / Cargo do requerente" required error={validationErrors.requerenteRole}>
              <Input value={draft.requerenteRole} onChange={handleText('requerenteRole')} placeholder="Ex: Formando · Curso de Contabilidade CV3 · Turma B" hasError={!!validationErrors.requerenteRole} />
            </Field>
          </Section>

        </div>

        {/* Rodapé */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--modal-border)] px-5 py-3.5 bg-[var(--modal-bg)]">
          <button
            onClick={async () => { await clearDraft(); }}
            className="rounded border border-[var(--modal-error)]/30 px-3 py-2 font-mono text-[10px] text-[var(--modal-error)]/70 transition-colors hover:border-[var(--modal-error)] hover:text-[var(--modal-error)]"
            title="Limpar rascunho"
          >
            ↺ Limpar
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="rounded border border-[var(--modal-border)] bg-transparent px-4 py-2 font-mono text-[11px] tracking-[0.04em] text-[var(--modal-muted)] hover:text-[var(--modal-text)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="rounded px-5 py-2 font-mono text-[11px] tracking-[0.04em] text-[#0f0e0d] transition-all hover:-translate-y-px"
              style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #3a7a6a 100%)` }}
            >
              ✓ Gerar Requerimento (.docx)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--modal-faint)]">{label}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] text-[var(--modal-muted)]">
        {label}{required && <span className="ml-1 text-[var(--modal-error)]">*</span>}
      </label>
      {children}
      {error && <p className="font-mono text-[10px] text-[var(--modal-error)]">{error}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, hasError }: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded border bg-[var(--modal-surface)] px-3 py-2 font-mono text-[12px] text-[var(--modal-text)] outline-none caret-[var(--modal-accent)] transition-colors placeholder:text-[var(--modal-faint)] focus:border-[var(--modal-accent)] ${
        hasError ? 'border-[var(--modal-error)]' : 'border-[var(--modal-border)]'
      }`}
    />
  );
}

function Textarea({ value, onChange, placeholder, hasError, rows = 3 }: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  hasError?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={`w-full resize-none rounded border bg-[var(--modal-surface)] px-3 py-2 font-mono text-[12px] leading-[1.6] text-[var(--modal-text)] outline-none caret-[var(--modal-accent)] transition-colors placeholder:text-[var(--modal-faint)] focus:border-[var(--modal-accent)] ${
        hasError ? 'border-[var(--modal-error)]' : 'border-[var(--modal-border)]'
      }`}
    />
  );
}
