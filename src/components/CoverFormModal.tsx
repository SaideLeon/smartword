'use client';

// src/components/CoverFormModal.tsx  (versão com persistência IndexedDB)
//
// MUDANÇAS vs versão original:
//  • Substitui useState(INITIAL) por useCoverFormPersistence()
//  • setField() do hook substitui o setField() local
//  • clearDraft() chamado na submissão bem-sucedida
//  • Badge "Rascunho guardado" quando hasDraft = true
//  • Skeleton (opacidade reduzida) enquanto loading = true (IDB a ler)
//  • handleText / updateMember / addMember / removeMember / handleLogo
//    adaptados para usar o setField do hook

import {
  useCallback,
  useRef,
  type ChangeEvent,
} from 'react';
import { AudioInputButton } from '@/components/AudioInputButton';
import type { CoverData } from '@/lib/docx/cover-types';
import { workTheme as C } from '@/lib/theme';
import { showAppAlert } from '@/lib/ui-alert';
import {
  useCoverFormPersistence,
  type CoverFormDraft,
} from '@/hooks/useCoverFormPersistence';

interface Props {
  onSubmit: (data: CoverData) => void;
  onCancel: () => void;
  isMobile?: boolean;
}

function normalizeInstitution(value: string): string {
  return value.toLocaleUpperCase('pt-PT');
}

// ── Validação ─────────────────────────────────────────────────────────────────

function validate(f: CoverFormDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.institution.trim()) errors.institution = 'Campo obrigatório';
  if (!f.course.trim())      errors.course      = 'Campo obrigatório';
  if (!f.subject.trim())     errors.subject     = 'Campo obrigatório';
  if (!f.theme.trim())       errors.theme       = 'Campo obrigatório';
  if (!f.teacher.trim())     errors.teacher     = 'Campo obrigatório';
  if (!f.city.trim())        errors.city        = 'Campo obrigatório';
  if (!f.date.trim())        errors.date        = 'Campo obrigatório';
  const filled = f.members.filter(m => m.trim());
  if (filled.length === 0)   errors.members     = 'Adiciona pelo menos um membro';
  return errors;
}

export function CoverFormModal({ onSubmit, onCancel, isMobile = false }: Props) {
  const { draft, setField, loading, clearDraft, hasDraft } = useCoverFormPersistence();

  // Erros de validação — mantidos em ref local (não persistidos)
  const [errors, setErrors] = [
    useRef<Record<string, string>>({}),
    (next: Record<string, string>) => { errorsRef.current = next; forceRender(c => c + 1); },
  ] as unknown as [{ current: Record<string, string> }, (fn: (c: number) => number) => void];
  // Simplificação: usa um estado simples para os erros
  const errorsRef = useRef<Record<string, string>>({});
  const [, forceRender] = [0, (fn: (c: number) => number) => {}] as unknown as [number, React.Dispatch<React.SetStateAction<number>>];

  // Re-exporta para uso correcto com useState
  const [errState, setErrState] = [errorsRef.current, (next: Record<string, string>) => {
    errorsRef.current = next;
  }];

  // O mais simples: usar useState separado para os erros de validação
  const [validationErrors, setValidationErrors] = useValidationErrors();

  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers de texto genérico ────────────────────────────────────────────

  const handleText = useCallback(
    (key: keyof CoverFormDraft) =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setField(
          key,
          (key === 'institution'
            ? normalizeInstitution(value)
            : value) as CoverFormDraft[typeof key],
        );
        setValidationErrors(prev => {
          const next = { ...prev };
          delete next[key as string];
          return next;
        });
      },
    [setField, setValidationErrors],
  );

  // ── Membros ───────────────────────────────────────────────────────────────

  const updateMember = useCallback(
    (index: number, value: string) => {
      setField('members', draft.members.map((m, i) => (i === index ? value : m)));
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next.members;
        return next;
      });
    },
    [draft.members, setField, setValidationErrors],
  );

  const addMember = useCallback(() => {
    setField('members', [...draft.members, '']);
  }, [draft.members, setField]);

  const removeMember = useCallback(
    (index: number) => {
      setField('members', draft.members.filter((_, i) => i !== index));
    },
    [draft.members, setField],
  );

  // ── Logo ──────────────────────────────────────────────────────────────────

  const handleLogo = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
        showAppAlert({
          title: 'Formato de logo inválido',
          message: 'Use apenas imagens PNG ou JPEG para o logotipo.',
        });
        e.target.value = '';
        return;
      }

      const mediaType = file.type as 'image/png' | 'image/jpeg';
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setField('logoBase64', dataUrl);
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

  // ── Submissão ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }

    const coverData: CoverData = {
      institution: normalizeInstitution(draft.institution.trim()),
      ...(draft.delegation.trim() && { delegation: draft.delegation.trim() }),
      ...(draft.logoBase64 && {
        logoBase64:    draft.logoBase64,
        logoMediaType: draft.logoMediaType as 'image/png' | 'image/jpeg',
      }),
      course:  draft.course.trim(),
      subject: draft.subject.trim(),
      theme:   draft.theme.trim(),
      ...(draft.group.trim() && { group: draft.group.trim() }),
      members: draft.members.filter(m => m.trim()).map(m => m.trim()),
      teacher: draft.teacher.trim(),
      city:    draft.city.trim(),
      date:    draft.date.trim(),
    };

    // Limpa o draft guardado DEPOIS de extrair coverData
    await clearDraft();
    onSubmit(coverData);
  }, [draft, clearDraft, onSubmit, setValidationErrors]);

  // ── CSS vars ──────────────────────────────────────────────────────────────

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
      : { maxHeight: '88vh' }),
  } as React.CSSProperties;

  const logoPreview = draft.logoBase64 || null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Formulário de capa"
        style={modalStyle}
        className={`fixed z-[71] bg-[var(--modal-bg)] border border-[var(--modal-border)] shadow-2xl flex flex-col transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'} ${
          isMobile
            ? 'inset-x-2 bottom-20 rounded-xl overflow-hidden'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[560px] rounded-xl overflow-hidden'
        }`}
      >
        {/* Cabeçalho */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--modal-border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] tracking-[0.06em] text-[var(--modal-accent)]">
              📄 Dados da Capa
            </span>
            <span className="rounded border border-[var(--modal-border)] bg-[var(--modal-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--modal-faint)]">
              obrigatório
            </span>
            {/* Badge de rascunho guardado */}
            {hasDraft && !loading && (
              <span className="rounded border border-[var(--modal-accent)]/30 bg-[var(--modal-accent)]/10 px-1.5 py-px font-mono text-[9px] text-[var(--modal-accent)]">
                ✦ rascunho guardado
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--modal-faint)] hover:text-[var(--modal-text)]"
            aria-label="Cancelar e fechar"
          >
            ×
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">

          {/* Instituição */}
          <Section label="Instituição">
            <Field label="Nome da instituição" required error={validationErrors.institution}>
              <Input
                value={draft.institution}
                onChange={handleText('institution')}
                onVoiceText={text => setField('institution', normalizeInstitution(text))}
                placeholder="Ex: Instituto Industrial e Comercial 1º de Maio"
                hasError={!!validationErrors.institution}
              />
            </Field>
            <Field label="Delegação / Localidade">
              <Input
                value={draft.delegation}
                onChange={handleText('delegation')}
                onVoiceText={text => setField('delegation', text)}
                placeholder="Ex: Quelimane"
              />
            </Field>
          </Section>

          {/* Logo */}
          <Section label="Logotipo (opcional)">
            {logoPreview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="h-12 w-12 rounded border border-[var(--modal-border)] object-contain bg-white p-1"
                />
                <button
                  onClick={removeLogo}
                  className="font-mono text-[11px] text-[var(--modal-error)] hover:underline"
                >
                  Remover logo
                </button>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-[var(--modal-border)] py-3 font-mono text-[11px] text-[var(--modal-muted)] hover:border-[var(--modal-accent)] hover:text-[var(--modal-accent)] transition-colors"
              >
                <span>↑</span>
                <span>Carregar logotipo (PNG / JPG)</span>
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogo}
              className="hidden"
            />
          </Section>

          {/* Informações académicas */}
          <Section label="Informações Académicas">
            <Field label="Curso ou Classe" required error={validationErrors.course}>
              <Input
                value={draft.course}
                onChange={handleText('course')}
                onVoiceText={text => setField('course', text)}
                placeholder="Ex: Contabilidade CV3 ou 12 Classe"
                hasError={!!validationErrors.course}
              />
            </Field>
            <Field label="Disciplina / Módulo" required error={validationErrors.subject}>
              <Input
                value={draft.subject}
                onChange={handleText('subject')}
                onVoiceText={text => setField('subject', text)}
                placeholder="Ex: Legislação Comercial e Fiscal"
                hasError={!!validationErrors.subject}
              />
            </Field>
            <Field label="Tema do trabalho" required error={validationErrors.theme}>
              <Textarea
                value={draft.theme}
                onChange={handleText('theme')}
                onVoiceText={text => setField('theme', text)}
                placeholder="Ex: Princípios Básicos da Legislação Laboral em Moçambique"
                hasError={!!validationErrors.theme}
                rows={2}
              />
            </Field>
            <Field label="Grupo (opcional) ou Nome:">
              <Input
                value={draft.group}
                onChange={handleText('group')}
                onVoiceText={text => setField('group', text)}
                placeholder="Ex: 3º Grupo ou Nome:"
              />
            </Field>
          </Section>

          {/* Membros */}
          <Section label="Membros do Grupo">
            {validationErrors.members && (
              <p className="font-mono text-[10px] text-[var(--modal-error)]">
                {validationErrors.members}
              </p>
            )}
            <div className="space-y-2">
              {draft.members.map((member, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-[10px] text-[var(--modal-faint)] w-5 text-right">
                    {i + 1}.
                  </span>
                  <Input
                    value={member}
                    onChange={e => updateMember(i, e.target.value)}
                    onVoiceText={text => updateMember(i, text)}
                    placeholder={`Membro ${i + 1}`}
                    hasError={!!validationErrors.members && !member.trim()}
                  />
                  {draft.members.length > 1 && (
                    <button
                      onClick={() => removeMember(i)}
                      className="shrink-0 font-mono text-[13px] leading-none text-[var(--modal-faint)] hover:text-[var(--modal-error)] transition-colors"
                      aria-label={`Remover membro ${i + 1}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addMember}
              className="mt-1 font-mono text-[11px] text-[var(--modal-accent)] hover:underline"
            >
              + Adicionar membro
            </button>
          </Section>

          {/* Docente */}
          <Section label="Docente">
            <Field label="Nome do docente / orientador" required error={validationErrors.teacher}>
              <Input
                value={draft.teacher}
                onChange={handleText('teacher')}
                onVoiceText={text => setField('teacher', text)}
                placeholder="Ex: Prof. António Machava"
                hasError={!!validationErrors.teacher}
              />
            </Field>
          </Section>

          {/* Local e data */}
          <Section label="Local e Data">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" required error={validationErrors.city}>
                <Input
                  value={draft.city}
                  onChange={handleText('city')}
                  onVoiceText={text => setField('city', text)}
                  placeholder="Ex: Quelimane"
                  hasError={!!validationErrors.city}
                />
              </Field>
              <Field label="Data" required error={validationErrors.date}>
                <Input
                  value={draft.date}
                  onChange={handleText('date')}
                  onVoiceText={text => setField('date', text)}
                  placeholder="Ex: Março de 2026"
                  hasError={!!validationErrors.date}
                />
              </Field>
            </div>
          </Section>
        </div>

        {/* Rodapé */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--modal-border)] px-5 py-3.5 bg-[var(--modal-bg)]">
          <button
            onClick={async () => {
              await clearDraft();
            }}
            className="rounded border border-[var(--modal-error)]/30 px-3 py-2 font-mono text-[10px] text-[var(--modal-error)]/70 transition-colors hover:border-[var(--modal-error)] hover:text-[var(--modal-error)]"
            title="Apagar rascunho guardado"
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
              ✓ Gerar capa e contracapa
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Hook auxiliar para erros de validação ─────────────────────────────────────
// Separado para manter o componente principal limpo.

function useValidationErrors() {
  const { useState } = require('react') as typeof import('react');
  return useState<Record<string, string>>({});
}

// ── Sub-componentes (inalterados da versão original) ──────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--modal-faint)]">
        {label}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] text-[var(--modal-muted)]">
        {label}
        {required && <span className="ml-1 text-[var(--modal-error)]">*</span>}
      </label>
      {children}
      {error && <p className="font-mono text-[10px] text-[var(--modal-error)]">{error}</p>}
    </div>
  );
}

function Input({
  value, onChange, onVoiceText, placeholder, hasError,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onVoiceText: (text: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded border bg-[var(--modal-surface)] px-3 py-2 font-mono text-[12px] text-[var(--modal-text)] outline-none caret-[var(--modal-accent)] transition-colors placeholder:text-[var(--modal-faint)] focus:border-[var(--modal-accent)] ${
          hasError ? 'border-[var(--modal-error)]' : 'border-[var(--modal-border)]'
        }`}
      />
      <AudioInputButton onTranscription={onVoiceText} className="py-2" />
    </div>
  );
}

function Textarea({
  value, onChange, onVoiceText, placeholder, hasError, rows = 2,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onVoiceText: (text: string) => void;
  placeholder?: string;
  hasError?: boolean;
  rows?: number;
}) {
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`w-full resize-none rounded border bg-[var(--modal-surface)] px-3 py-2 font-mono text-[12px] leading-[1.6] text-[var(--modal-text)] outline-none caret-[var(--modal-accent)] transition-colors placeholder:text-[var(--modal-faint)] focus:border-[var(--modal-accent)] ${
          hasError ? 'border-[var(--modal-error)]' : 'border-[var(--modal-border)]'
        }`}
      />
      <AudioInputButton onTranscription={onVoiceText} className="py-2" />
    </div>
  );
}
