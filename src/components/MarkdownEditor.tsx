'use client';

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';
import { showAppAlert } from '@/lib/ui-alert';

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
  const [recentAction, setRecentAction] = useState<'import' | 'clear' | 'pagebreak' | 'section' | 'toc' | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousValueRef = useRef(value);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);

  useEffect(() => {
    const previous = previousValueRef.current;
    const grewByAppend = value.length > previous.length && value.startsWith(previous);
    previousValueRef.current = value;

    if (!grewByAppend) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    requestAnimationFrame(() => {
      textarea.scrollTo({
        top: textarea.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [value]);

  const showActionFeedback = useCallback((action: 'import' | 'clear' | 'pagebreak' | 'section' | 'toc') => {
    setRecentAction(action);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setRecentAction(current => (current === action ? null : current));
      feedbackTimeoutRef.current = null;
    }, 1800);
  }, []);

  const insertAtCursor = useCallback((marker: string, feedbackKey: 'pagebreak' | 'section' | 'toc') => {
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
      showAppAlert({
        title: 'Formato inválido',
        message: 'Por favor, seleccione um ficheiro .md ou .txt.',
      });
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
    <div className="flex flex-col gap-2">
      <div className={`flex justify-between gap-3 px-0.5 ${isMobile ? 'flex-col items-stretch' : 'flex-row items-center'}`}>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Editor Markdown</span>

        <div className={`flex flex-wrap gap-1.5 ${isMobile ? 'w-full items-stretch' : 'w-auto items-center'}`}>
          {uploadedFilename && (
            <div className={`flex items-center gap-1.5 rounded border border-[#c9a96e33] bg-surface px-2 py-[3px] ${isMobile ? 'max-w-full' : ''}`}>
              <span className="truncate font-mono text-[11px] text-gold">📄 {uploadedFilename}</span>
              <button className="press-feedback flex items-center rounded px-0.5 text-xs leading-none text-text-faint" onClick={clearFile} title="Limpar" aria-label="Limpar ficheiro importado">
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
            tone="muted"
            fullWidth={isMobile}
          />

          <ToolbarBtn
            onClick={() => insertAtCursor('{section}', 'section')}
            label={recentAction === 'section' ? 'Inserido ✓' : '≡ Nova secção'}
            title="Insere uma nova secção (paginação reinicia em 1)"
            tone="section"
            fullWidth={isMobile}
          />

          {/* ── Botão de índice automático ── */}
          <ToolbarBtn
            onClick={() => insertAtCursor('{toc}', 'toc')}
            label={recentAction === 'toc' ? 'Inserido ✓' : '☰ Índice'}
            title="Insere um índice automático gerado pelos títulos do documento"
            tone="toc"
            fullWidth={isMobile}
          />
        </div>
      </div>

      {/* Legenda dos marcadores */}
      <div className={`flex flex-wrap gap-4 px-0.5 ${isMobile ? 'gap-2' : ''}`}>
        {[
          { marker: '{pagebreak}', desc: 'quebra de página', markerClassName: 'text-text-faint' },
          { marker: '{section}',   desc: 'nova secção · paginação reinicia em 1', markerClassName: 'text-green' },
          { marker: '{toc}',       desc: 'índice automático · actualizado no Word', markerClassName: 'text-[#7db8e0]' },
        ].map(({ marker, desc, markerClassName }) => (
          <span key={marker} className="font-mono text-[10px] tracking-[0.04em] text-text-dim">
            <code className={`rounded-[3px] bg-surface px-[5px] py-px ${markerClassName}`}>{marker}</code>
            {' '}→ {desc}
          </span>
        ))}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-md border bg-surface-alt transition-[border-color,box-shadow] ${dragging ? 'border-[#c9a96e88] shadow-[0_0_0_3px_#c9a96e11,inset_0_0_40px_#c9a96e08]' : 'border-border-strong'}`}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md bg-[#c9a96e08]">
            <svg className="h-10 w-10 text-gold opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className={`font-mono text-gold opacity-80 tracking-[0.08em] ${isMobile ? 'text-xs' : 'text-[13px]'}`}>Largar ficheiro .md aqui</span>
          </div>
        )}

        <div className="flex overflow-hidden rounded-md">
          <div aria-hidden className={`pointer-events-none select-none overflow-hidden border-r border-border-subtle bg-[#111009] py-[14px] ${isMobile ? 'min-w-9' : 'min-w-11'}`}>
            <div className="flex flex-col items-end">
              {value.split('\n').slice(0, 200).map((_, i) => (
                <span key={i} className={`block pr-2.5 font-mono tracking-[-0.02em] text-text-dim ${isMobile ? 'text-[10px]' : 'text-[11px]'} leading-[1.65]`}>
                  {i + 1}
                </span>
              ))}
              {lineCount > 200 && <span className="pt-0.5 pr-2 font-mono text-[10px] text-border-strong">···</span>}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            spellCheck={false}
            className={`flex-1 resize-y border-none bg-transparent font-mono text-text-secondary caret-gold outline-none tracking-[0.01em] leading-[1.65] ${isMobile ? 'min-h-[360px] p-3 text-xs' : 'min-h-[480px] px-4 py-[14px] text-[13px]'}`}
            placeholder={'# Título\n\nEscreva o seu Markdown aqui...\n\nEquações inline: $ax^2 + bx + c = 0$\n\nEquações em bloco:\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'}
          />
        </div>
      </div>

      <p className="m-0 px-0.5 font-mono text-[11px] leading-[1.5] tracking-[0.04em] text-text-dim">
        Arraste um ficheiro <span className="text-text-faint">.md</span> para o editor, ou clique em{' '}
        <span className="text-text-faint">Importar .md</span> para carregar.
      </p>

      <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleFileInput} className="hidden" />
    </div>
  );
}

function ToolbarBtn({
  onClick, label, icon, title, tone = 'muted', fullWidth = false,
}: {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  title?: string;
  tone?: 'muted' | 'section' | 'toc';
  fullWidth?: boolean;
}) {
  const toneClassName =
    tone === 'section'
      ? 'text-[#6a9e5f] hover:border-[#6a9e5f55]'
      : tone === 'toc'
        ? 'text-[#7db8e0] hover:border-[#7db8e055]'
        : 'text-text-muted hover:border-[#8a7d6e55]';

  return (
    <button
      className={`press-feedback flex items-center justify-center gap-1.5 rounded border border-border-strong bg-surface px-[10px] py-[5px] font-mono text-[11px] tracking-[0.06em] transition-all hover:brightness-110 ${toneClassName} ${fullWidth ? 'w-full' : 'w-auto'}`}
      onClick={onClick}
      title={title}
    >
      {icon}
      {label}
    </button>
  );
}
