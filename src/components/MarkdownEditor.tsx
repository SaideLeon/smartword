'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  isMobile?: boolean;
}

export function MarkdownEditor({ value, onChange, isMobile = false }: Props) {
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [recentAction, setRecentAction] = useState<'import' | 'clear' | 'pagebreak' | 'section' | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Inserir marcador na posição do cursor ────────────────────────────────
  const insertAtCursor = useCallback((marker: string, feedbackKey: 'pagebreak' | 'section') => {
    const textarea = textareaRef.current;
    const insertion = `\n\n${marker}\n\n`;

    if (!textarea) {
      onChange(value + insertion);
    } else {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const newValue = value.substring(0, start) + insertion + value.substring(end);
      onChange(newValue);
      // Reposicionar cursor após o marcador
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertion.length;
        textarea.selectionStart = textarea.selectionEnd = pos;
      });
    }
    showActionFeedback(feedbackKey);
  }, [value, onChange, showActionFeedback]);

  const readFile = useCallback(
    (file: File) => {
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
    },
    [onChange, showActionFeedback],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [readFile],
  );

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* ── Barra de ferramentas ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        padding: '0 2px',
        gap: '0.75rem',
      }}>
        <span style={{
          fontSize: '11px', fontFamily: 'monospace', color: '#5a5248',
          letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0,
        }}>
          Editor Markdown
        </span>

        <div style={{
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
          width: isMobile ? '100%' : 'auto',
        }}>
          {/* Badge de ficheiro carregado */}
          {uploadedFilename && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: '#1a1714', border: '1px solid #c9a96e33',
              borderRadius: '4px', padding: '3px 8px',
              maxWidth: isMobile ? '100%' : 'none',
            }}>
              <span style={{ fontSize: '11px', color: '#c9a96e', fontFamily: 'monospace' }}>
                📄 {uploadedFilename}
              </span>
              <button
                className="press-feedback"
                onClick={clearFile}
                style={{ background: 'none', border: 'none', color: '#5a5248', cursor: 'pointer', fontSize: '12px', lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}
                title="Limpar"
              >
                {recentAction === 'clear' ? '✓' : '×'}
              </button>
            </div>
          )}

          {/* Importar .md */}
          <ToolbarBtn
            onClick={() => fileInputRef.current?.click()}
            label={recentAction === 'import' ? 'Importado' : 'Importar .md'}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            }
            fullWidth={isMobile}
          />

          {/* Quebra de página */}
          <ToolbarBtn
            onClick={() => insertAtCursor('{pagebreak}', 'pagebreak')}
            label={recentAction === 'pagebreak' ? 'Inserido ✓' : '↕ Quebra de pág.'}
            title="Insere uma quebra de página (não reinicia numeração)"
            color="#8a7d6e"
            fullWidth={isMobile}
          />

          {/* Nova secção */}
          <ToolbarBtn
            onClick={() => insertAtCursor('{section}', 'section')}
            label={recentAction === 'section' ? 'Inserido ✓' : '≡ Nova secção'}
            title="Insere uma nova secção (paginação reinicia em 1)"
            color="#6a9e5f"
            fullWidth={isMobile}
          />
        </div>
      </div>

      {/* ── Legenda dos marcadores ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap',
        padding: '0 2px',
      }}>
        {[
          { marker: '{pagebreak}', desc: 'quebra de página', color: '#5a5248' },
          { marker: '{section}',   desc: 'nova secção · paginação reinicia em 1', color: '#4a6644' },
        ].map(({ marker, desc, color }) => (
          <span key={marker} style={{ fontSize: '10px', fontFamily: 'monospace', color: '#3a3530', letterSpacing: '0.04em' }}>
            <code style={{ color, background: '#1a1714', padding: '1px 5px', borderRadius: '3px' }}>{marker}</code>
            {' '}→ {desc}
          </span>
        ))}
      </div>

      {/* ── Área de edição ───────────────────────────────────────────────── */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          position: 'relative', borderRadius: '6px',
          border: dragging ? '1px solid #c9a96e88' : '1px solid #2a2520',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: dragging ? '0 0 0 3px #c9a96e11, inset 0 0 40px #c9a96e08' : 'none',
          background: '#141210',
        }}
      >
        {dragging && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '6px',
            background: '#c9a96e08', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '0.5rem', pointerEvents: 'none',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5" opacity={0.7}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={{ color: '#c9a96e', fontFamily: 'monospace', fontSize: isMobile ? '12px' : '13px', letterSpacing: '0.08em', opacity: 0.8 }}>
              Largar ficheiro .md aqui
            </span>
          </div>
        )}

        <div style={{ display: 'flex', overflow: 'hidden', borderRadius: '6px' }}>
          {/* Numeração de linhas */}
          <div aria-hidden style={{
            minWidth: isMobile ? '36px' : '44px',
            background: '#111009', borderRight: '1px solid #1e1b18',
            padding: '14px 0', display: 'flex', flexDirection: 'column',
            alignItems: 'flex-end', userSelect: 'none', pointerEvents: 'none', overflow: 'hidden',
          }}>
            {value.split('\n').slice(0, 200).map((_, i) => (
              <span key={i} style={{
                display: 'block', fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'monospace', color: '#3a3530',
                lineHeight: '1.65', paddingRight: '10px', letterSpacing: '-0.02em',
              }}>
                {i + 1}
              </span>
            ))}
            {value.split('\n').length > 200 && (
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#2a2520', paddingRight: '8px', paddingTop: '2px' }}>
                ···
              </span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              minHeight: isMobile ? '360px' : '480px',
              padding: isMobile ? '12px' : '14px 16px',
              background: 'transparent', border: 'none', outline: 'none',
              resize: 'vertical', fontFamily: "'Courier New', 'Courier', monospace",
              fontSize: isMobile ? '12px' : '13px', lineHeight: '1.65',
              color: '#d4cec7', caretColor: '#c9a96e', letterSpacing: '0.01em',
            }}
            placeholder={'# Título\n\nEscreva o seu Markdown aqui...\n\nEquações inline: $ax^2 + bx + c = 0$\n\nEquações em bloco:\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'}
          />
        </div>
      </div>

      <p style={{
        fontSize: '11px', color: '#3a3530', fontFamily: 'monospace',
        letterSpacing: '0.04em', margin: 0, padding: '0 2px', lineHeight: 1.5,
      }}>
        Arraste um ficheiro <span style={{ color: '#5a5248' }}>.md</span> para o editor, ou clique em{' '}
        <span style={{ color: '#5a5248' }}>Importar .md</span> para carregar.
      </p>

      <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleFileInput} style={{ display: 'none' }} />
    </div>
  );
}

// ── Sub-componente: botão da barra de ferramentas ─────────────────────────────

function ToolbarBtn({
  onClick, label, icon, title, color = '#8a7d6e', fullWidth = false,
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  title?: string;
  color?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      className="press-feedback"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '0.4rem',
        background: '#1a1714', border: '1px solid #2a2520', borderRadius: '4px',
        color, fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.06em',
        padding: '5px 10px', width: fullWidth ? '100%' : 'auto',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}55`;
        (e.currentTarget as HTMLButtonElement).style.color = color;
        (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2520';
        (e.currentTarget as HTMLButtonElement).style.color = color;
        (e.currentTarget as HTMLButtonElement).style.filter = 'none';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
