'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { colors, editorTheme, fonts, gradients, withAlpha } from '@/lib/theme';

interface Props {
  onClick: () => void;
  loading: boolean;
  filename?: string;
  fullWidth?: boolean;
}

export function ExportButton({ onClick, loading, filename = 'document', fullWidth = false }: Props) {
  const [hovered, setHovered] = useState(false);
  const [recentlyExported, setRecentlyExported] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      className="press-feedback"
      onClick={handleClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        padding: '10px 22px',
        width: fullWidth ? '100%' : 'auto',
        maxWidth: '100%',
        background: loading
          ? '#1e1b18'
          : hovered
            ? gradients.goldHover
            : gradients.gold,
        border: 'none',
        borderRadius: '5px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
        transition: 'all 0.2s ease',
        boxShadow: hovered && !loading ? `0 4px 20px ${withAlpha(colors.gold, '30')}` : '0 2px 8px #00000040',
        transform: hovered && !loading ? 'translateY(-1px)' : 'none',
      }}
    >
      {loading ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.textMuted}
          strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={editorTheme.bg} strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}

      <span
        style={{
          fontFamily: fonts.serif,
          fontStyle: 'italic',
          fontSize: fullWidth ? '13px' : '14px',
          fontWeight: 400,
          color: loading ? colors.textFaint : editorTheme.bg,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'A gerar…' : recentlyExported ? `Exportado ${filename}.docx` : `Exportar ${filename}.docx`}
      </span>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
