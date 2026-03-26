'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { colors, editorTheme, fonts, gradients, withAlpha } from '@/lib/theme';

interface Props {
  onClick: () => void;
  loading: boolean;
  filename?: string;
  fullWidth?: boolean;
}

export function ExportButton({ onClick, loading, filename = 'document', fullWidth = false }: Props) {
  const [recentlyExported, setRecentlyExported] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vars = useMemo(() => ({
    '--gold-shadow': withAlpha(colors.gold, '30'),
    '--btn-bg': gradients.gold,
    '--btn-bg-hover': gradients.goldHover,
    '--btn-bg-loading': '#1e1b18',
    '--btn-fg': editorTheme.bg,
    '--btn-fg-loading': colors.textFaint,
    '--font-serif': fonts.serif,
  } as CSSProperties), []);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);

  const handleClick = useCallback(() => {
    if (!loading) {
      setRecentlyExported(true);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setRecentlyExported(false);
        feedbackTimeoutRef.current = null;
      }, 2200);
    }

    onClick();
  }, [loading, onClick]);

  return (
    <button
      style={vars}
      className={`press-feedback group flex max-w-full items-center justify-center gap-2 rounded-[5px] border-none px-[22px] py-2.5 transition-all ${fullWidth ? 'w-full' : 'w-auto'} ${loading ? 'cursor-not-allowed bg-[var(--btn-bg-loading)] opacity-50' : 'cursor-pointer bg-[var(--btn-bg)] hover:-translate-y-px hover:bg-[var(--btn-bg-hover)] hover:shadow-[0_4px_20px_var(--gold-shadow)]'} shadow-[0_2px_8px_#00000040]`}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <svg className="h-[15px] w-[15px] animate-spin text-[var(--btn-fg-loading)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : (
        <svg className="h-[15px] w-[15px] text-[var(--btn-fg)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}

      <span className={`whitespace-nowrap text-[13px] font-normal italic tracking-[0.01em] [font-family:var(--font-serif)] ${loading ? 'text-[var(--btn-fg-loading)]' : 'text-[var(--btn-fg)]'} ${fullWidth ? 'text-[13px]' : 'text-sm'}`}>
        {loading ? 'A gerar…' : recentlyExported ? `Exportado ${filename}.docx` : `Exportar ${filename}.docx`}
      </span>
    </button>
  );
}
