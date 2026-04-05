'use client';

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { AudioInputButton } from '@/components/AudioInputButton';
import type { CoverData } from '@/lib/docx/cover-types';
import { workTheme as C } from '@/lib/theme';

interface Props {
  onSubmit: (data: CoverData) => void;
  onCancel: () => void;
  isMobile?: boolean;
}

interface FormState {
  institution: string;
  delegation: string;
  logoBase64: string;
  logoMediaType: 'image/png' | 'image/jpeg' | '';
  course: string;
  subject: string;
  theme: string;
  group: string;
  members: string[];
  teacher: string;
  city: string;
  date: string;
}

function normalizeInstitution(value: string): string {
  return value.toLocaleUpperCase('pt-PT');
}

const INITIAL: FormState = {
  institution: '',
  delegation: '',
  logoBase64: '',
  logoMediaType: '',
  course: '',
  subject: '',
  theme: '',
  group: '',
  members: [''],
  teacher: '',
  city: '',
  date: '',
};

// ── Validação ─────────────────────────────────────────────────────────────────

function validate(f: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.institution.trim()) errors.institution = 'Campo obrigatório';
  if (!f.course.trim()) errors.course = 'Campo obrigatório';
  if (!f.subject.trim()) errors.subject = 'Campo obrigatório';
  if (!f.theme.trim()) errors.theme = 'Campo obrigatório';
  if (!f.teacher.trim()) errors.teacher = 'Campo obrigatório';
  if (!f.city.trim()) errors.city = 'Campo obrigatório';
  if (!f.date.trim()) errors.date = 'Campo obrigatório';
  const filled = f.members.filter(m => m.trim());
  if (filled.length === 0) errors.members = 'Adiciona pelo menos um membro';
  return errors;
}

export function CoverFormModal({ onSubmit, onCancel, isMobile = false }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers de actualização ───────────────────────────────────────────────

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm(prev => ({ ...prev, [key]: value }));
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const handleText = useCallback(
    (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value as any;
      setField(
        key,
        (key === 'institution' ? normalizeInstitution(value) : value) as FormState[typeof key],
      );
    },
    [setField],
  );

  // ── Membros ───────────────────────────────────────────────────────────────

  const updateMember = useCallback((index: number, value: string) => {
    setForm(prev => {
      const next = [...prev.members];
      next[index] = value;
      return { ...prev, members: next };
    });
    setErrors(prev => {
      const next = { ...prev };
      delete next.members;
      return next;
    });
  }, []);

  const addMember = useCallback(() => {
    setForm(prev => ({ ...prev, members: [...prev.members, ''] }));
  }, []);

  const removeMember = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  }, []);

  // ── Logo ──────────────────────────────────────────────────────────────────

  const handleLogo = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mediaType =
      file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setField('logoBase64', dataUrl);
      setField('logoMediaType', mediaType);
    };
    reader.readAsDataURL(file);
  }, [setField]);

  const removeLogo = useCallback(() => {
    setLogoPreview(null);
    setField('logoBase64', '');
    setField('logoMediaType', '');
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, [setField]);

  // ── Submissão ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const coverData: CoverData = {
      institution: normalizeInstitution(form.institution.trim()),
      ...(form.delegation.trim() && { delegation: form.delegation.trim() }),
      ...(form.logoBase64 && {
        logoBase64: form.logoBase64,
        logoMediaType: form.logoMediaType as 'image/png' | 'image/jpeg',
      }),
      course: form.course.trim(),
      subject: form.subject.trim(),
      theme: form.theme.trim(),
      ...(form.group.trim() && { group: form.group.trim() }),
      members: form.members.filter(m => m.trim()).map(m => m.trim()),
      teacher: form.teacher.trim(),
      city: form.city.trim(),
      date: form.date.trim(),
    };

    onSubmit(coverData);
  }, [form, onSubmit]);

  // ── Estilos base ──────────────────────────────────────────────────────────

  const cssVars: CSSProperties = {
    '--modal-bg':      '#0a0d0a',
    '--modal-surface': '#111611',
    '--modal-border':  '#1a2a1a',
    '--modal-accent':  C.accent,
    '--modal-text':    C.text,
    '--modal-muted':   C.textDim,
    '--modal-faint':   C.textFaint,
    '--modal-gold':    C.gold,
    '--modal-error':   '#c97070',
  } as CSSProperties;

  // Altura máxima segura: viewport - status bar - margem inferior - safe areas
  const modalStyle: CSSProperties = isMobile
    ? {
        ...cssVars,
        maxHeight: 'calc(100dvh - 8px - env(safe-area-inset-bottom, 16px))',
      }
    : {
        ...cssVars,
        maxHeight: '88vh',
      };

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
        className={`fixed z-[71] bg-[var(--modal-bg)] border border-[var(--modal-border)] shadow-2xl flex flex-col ${
          isMobile
            ? 'inset-x-2 bottom-2 rounded-xl overflow-hidden'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[560px] rounded-xl overflow-hidden'
        }`}
      >
        {/* Cabeçalho — fixo no topo */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--modal-border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] tracking-[0.06em] text-[var(--modal-accent)]">
              📄 Dados da Capa
            </span>
            <span className="rounded border border-[var(--modal-border)] bg-[var(--modal-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--modal-faint)]">
              obrigatório
            </span>
          </div>
          <button
            onClick={onCancel}
            className="rounded px-1.5 py-0.5 text-lg leading-none text-[var(--modal-faint)] hover:text-[var(--modal-text)]"
            aria-label="Cancelar e fechar"
          >
            ×
          </button>
        </div>

        {/* Corpo com scroll — ocupa o espaço disponível entre header e footer */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">
          {/* Instituição */}
          <Section label="Instituição">
            <Field
              label="Nome da instituição"
              required
              error={errors.institution}
            >
              <Input
                value={form.institution}
                onChange={handleText('institution')}
                onVoiceText={text => setField('institution', normalizeInstitution(text))}
                placeholder="Ex: Instituto Industrial e Comercial 1º de Maio"
                hasError={!!errors.institution}
              />
            </Field>
            <Field label="Delegação / Localidade">
              <Input
                value={form.delegation}
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
            <Field label="Curso ou Classe" required error={errors.course}>
              <Input
                value={form.course}
                onChange={handleText('course')}
                onVoiceText={text => setField('course', text)}
                placeholder="Ex: Contabilidade CV3 ou 12 Classe"
                hasError={!!errors.course}
              />
            </Field>
            <Field label="Disciplina / Módulo" required error={errors.subject}>
              <Input
                value={form.subject}
                onChange={handleText('subject')}
                onVoiceText={text => setField('subject', text)}
                placeholder="Ex: Legislação Comercial e Fiscal"
                hasError={!!errors.subject}
              />
            </Field>
            <Field label="Tema do trabalho" required error={errors.theme}>
              <Textarea
                value={form.theme}
                onChange={handleText('theme')}
                onVoiceText={text => setField('theme', text)}
                placeholder="Ex: Princípios Básicos da Legislação Laboral em Moçambique"
                hasError={!!errors.theme}
                rows={2}
              />
            </Field>
            <Field label="Grupo (opcional) ou Nome:">
              <Input
                value={form.group}
                onChange={handleText('group')}
                onVoiceText={text => setField('group', text)}
                placeholder="Ex: 3º Grupo ou Nome:"
              />
            </Field>
          </Section>

          {/* Membros */}
          <Section label="Membros do Grupo">
            {errors.members && (
              <p className="font-mono text-[10px] text-[var(--modal-error)]">
                {errors.members}
              </p>
            )}
            <div className="space-y-2">
              {form.members.map((member, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-[10px] text-[var(--modal-faint)] w-5 text-right">
                    {i + 1}.
                  </span>
                  <Input
                    value={member}
                    onChange={e => updateMember(i, e.target.value)}
                    onVoiceText={text => updateMember(i, text)}
                    placeholder={`Membro ${i + 1}`}
                    hasError={!!errors.members && !member.trim()}
                  />
                  {form.members.length > 1 && (
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
            <Field label="Nome do docente / orientador" required error={errors.teacher}>
              <Input
                value={form.teacher}
                onChange={handleText('teacher')}
                onVoiceText={text => setField('teacher', text)}
                placeholder="Ex: Prof. António Machava"
                hasError={!!errors.teacher}
              />
            </Field>
          </Section>

          {/* Local e data */}
          <Section label="Local e Data">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" required error={errors.city}>
                <Input
                  value={form.city}
                  onChange={handleText('city')}
                  onVoiceText={text => setField('city', text)}
                  placeholder="Ex: Quelimane"
                  hasError={!!errors.city}
                />
              </Field>
              <Field label="Data" required error={errors.date}>
                <Input
                  value={form.date}
                  onChange={handleText('date')}
                  onVoiceText={text => setField('date', text)}
                  placeholder="Ex: Março de 2026"
                  hasError={!!errors.date}
                />
              </Field>
            </div>
          </Section>
        </div>

        {/* Rodapé — fixo na base, sempre visível */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--modal-border)] px-5 py-3.5 bg-[var(--modal-bg)]">
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
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

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
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] text-[var(--modal-muted)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--modal-error)]">*</span>
        )}
      </label>
      {children}
      {error && (
        <p className="font-mono text-[10px] text-[var(--modal-error)]">{error}</p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  onVoiceText,
  placeholder,
  hasError,
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
  value,
  onChange,
  onVoiceText,
  placeholder,
  hasError,
  rows = 2,
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
