'use client';

import { useRef, useState, useCallback, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { colors, editorTheme, fonts, withAlpha } from '@/lib/theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  isMobile?: boolean;
}

export function MarkdownEditor({ value, onChange, isMobile = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [recentAction, setRecentAction] = useState<'import' | 'clear' | 'pagebreak' | 'section' | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vars = useMemo(() => ({
    '--editor-surface': editorTheme.surface,
    '--editor-surface-alt': editorTheme.surfaceAlt,
    '--editor-border': editorTheme.border,
    '--editor-border-subtle': editorTheme.borderSubtle,
    '--editor-caret': editorTheme.caretColor,
    '--text-secondary': colors.textSecondary,
    '--text-muted': colors.textMuted,
    '--text-faint': colors.textFaint,
    '--text-dim': colors.textDim,
    '--gold': colors.gold,
    '--gold-33': withAlpha(colors.gold, '33'),
    '--gold-88': withAlpha(colors.gold, '88'),
    '--gold-11': withAlpha(colors.gold, '11'),
    '--gold-08': withAlpha(colors.gold, '08'),
    '--green': colors.green,
    '--font-label': fonts.label,
    '--font-mono': fonts.mono,
  } as CSSProperties), []);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);

  const showActionFeedback = useCallback((action: 'import' | 'clear' | 'pagebreak' | 'section') => {
    setRecentAction(action);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setRecentAction(current => (current === action ? null : current));
      feedbackTimeoutRef.current = null;
    }, 1800);
  }, []);

  const insertAtCursor = useCallback((marker: string, feedbackKey: 'pagebreak' | 'section') => {
    const textarea = textareaRef.current;
    const insertion = `\n\n${marker}\n\n`;

    if (!textarea) {
      onChange(value + insertion);
    } else {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + insertion + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertion.length;
        textarea.selectionStart = textarea.selectionEnd = pos;
      });
    }
    showActionFeedback(feedbackKey);
  }, [value, onChange, showActionFeedback]);

  const readFile = useCallback((file: File) => {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      alert('Por favor, seleccione um ficheiro .md ou .txt');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      onChange(text);
      setUploadedFilename(file.name);
      showActionFeedback('import');
    };
    reader.readAsText(file, 'utf-8');
  }, [onChange, showActionFeedback]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = '';
  };

  const clearFile = () => {
    setUploadedFilename(null);
    onChange('');
    showActionFeedback('clear');
  };

  const lineCount = value.split('\n').length;

  return (
    <div style={vars} className="flex flex-col gap-2">
      <div className={`flex justify-between gap-3 px-0.5 ${isMobile ? 'flex-col items-stretch' : 'flex-row items-center'}`}>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-[var(--text-faint)] [font-family:var(--font-label)]">Editor Markdown</span>

        <div className={`flex flex-wrap gap-1.5 ${isMobile ? 'w-full items-stretch' : 'w-auto items-center'}`}>
          {uploadedFilename && (
            <div className={`flex items-center gap-1.5 rounded border border-[var(--gold-33)] bg-[var(--editor-surface)] px-2 py-[3px] ${isMobile ? 'max-w-full' : ''}`}>
              <span className="truncate text-[11px] text-[var(--gold)] [font-family:var(--font-label)]">📄 {uploadedFilename}</span>
              <button className="press-feedback flex items-center rounded px-0.5 text-xs leading-none text-[var(--text-faint)]" onClick={clearFile} title="Limpar" aria-label="Limpar ficheiro importado">
                {recentAction === 'clear' ? '✓' : '×'}
              </button>
            </div>
          )}

          <ToolbarBtn
            onClick={() => fileInputRef.current?.click()}
            label={recentAction === 'import' ? 'Importado' : 'Importar .md'}
            icon={(
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
            fullWidth={isMobile}
          />

          <ToolbarBtn
            onClick={() => insertAtCursor('{pagebreak}', 'pagebreak')}
            label={recentAction === 'pagebreak' ? 'Inserido ✓' : '↕ Quebra de pág.'}
            title="Insere uma quebra de página (não reinicia numeração)"
            color={colors.textMuted}
            fullWidth={isMobile}
          />

          <ToolbarBtn
            onClick={() => insertAtCursor('{section}', 'section')}
            label={recentAction === 'section' ? 'Inserido ✓' : '≡ Nova secção'}
            title="Insere uma nova secção (paginação reinicia em 1)"
            color={colors.greenBright}
            fullWidth={isMobile}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 px-0.5">
        {[
          { marker: '{pagebreak}', desc: 'quebra de página', color: colors.textFaint },
          { marker: '{section}', desc: 'nova secção · paginação reinicia em 1', color: colors.green },
        ].map(({ marker, desc, color }) => (
          <span key={marker} className="text-[10px] tracking-[0.04em] text-[var(--text-dim)] [font-family:var(--font-label)]">
            <code className="rounded-[3px] bg-[var(--editor-surface)] px-[5px] py-px" style={{ color }}>{marker}</code>
            {' '}→ {desc}
          </span>
        ))}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-md border bg-[var(--editor-surface-alt)] transition-[border-color,box-shadow] ${dragging ? 'border-[var(--gold-88)] shadow-[0_0_0_3px_var(--gold-11),inset_0_0_40px_var(--gold-08)]' : 'border-[var(--editor-border)]'}`}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md bg-[var(--gold-08)]">
            <svg className="h-10 w-10 text-[var(--gold)] opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className={`text-[var(--gold)] opacity-80 tracking-[0.08em] [font-family:var(--font-label)] ${isMobile ? 'text-xs' : 'text-[13px]'}`}>Largar ficheiro .md aqui</span>
          </div>
        )}

        <div className="flex overflow-hidden rounded-md">
          <div aria-hidden className={`pointer-events-none select-none overflow-hidden border-r border-[var(--editor-border-subtle)] bg-[#111009] py-[14px] ${isMobile ? 'min-w-9' : 'min-w-11'}`}>
            <div className="flex flex-col items-end">
              {value.split('\n').slice(0, 200).map((_, i) => (
                <span key={i} className={`block pr-2.5 tracking-[-0.02em] text-[var(--text-dim)] [font-family:var(--font-label)] ${isMobile ? 'text-[10px]' : 'text-[11px]'} leading-[1.65]`}>
                  {i + 1}
                </span>
              ))}
              {lineCount > 200 && <span className="pt-0.5 pr-2 text-[10px] text-[var(--editor-border)] [font-family:var(--font-label)]">···</span>}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            spellCheck={false}
            className={`flex-1 resize-y border-none bg-transparent text-[var(--text-secondary)] outline-none [caret-color:var(--editor-caret)] [font-family:var(--font-mono)] tracking-[0.01em] leading-[1.65] ${isMobile ? 'min-h-[360px] p-3 text-xs' : 'min-h-[480px] px-4 py-[14px] text-[13px]'}`}
            placeholder={'# Título\n\nEscreva o seu Markdown aqui...\n\nEquações inline: $ax^2 + bx + c = 0$\n\nEquações em bloco:\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'}
          />
        </div>
      </div>

      <p className="m-0 px-0.5 text-[11px] leading-[1.5] tracking-[0.04em] text-[var(--text-dim)] [font-family:var(--font-label)]">
        Arraste um ficheiro <span className="text-[var(--text-faint)]">.md</span> para o editor, ou clique em{' '}
        <span className="text-[var(--text-faint)]">Importar .md</span> para carregar.
      </p>

      <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleFileInput} className="hidden" />
    </div>
  );
}

function ToolbarBtn({
  onClick, label, icon, title, color = colors.textMuted, fullWidth = false,
}: {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  title?: string;
  color?: string;
  fullWidth?: boolean;
}) {
  const vars = useMemo(() => ({
    '--btn-color': color,
    '--btn-border-hover': withAlpha(color, '55'),
    '--editor-surface': editorTheme.surface,
    '--editor-border': editorTheme.border,
    '--font-label': fonts.label,
  } as CSSProperties), [color]);

  return (
    <button
      className={`press-feedback flex items-center justify-center gap-1.5 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-[10px] py-[5px] text-[11px] tracking-[0.06em] text-[var(--btn-color)] transition-all hover:border-[var(--btn-border-hover)] hover:brightness-110 [font-family:var(--font-label)] ${fullWidth ? 'w-full' : 'w-auto'}`}
      onClick={onClick}
      title={title}
      style={vars}
    >
      {icon}
      {label}
    </button>
  );
}
