'use client';

import { useState } from 'react';

interface Props {
  onClick: () => void;
  loading: boolean;
  filename?: string;
  fullWidth?: boolean;
}

export function ExportButton({ onClick, loading, filename = 'document', fullWidth = false }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      className="press-feedback"
      onClick={onClick}
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
            ? 'linear-gradient(135deg, #d4b47a 0%, #9a7820 100%)'
            : 'linear-gradient(135deg, #c9a96e 0%, #8b6914 100%)',
        border: 'none',
        borderRadius: '5px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
        transition: 'all 0.2s ease',
        boxShadow: hovered && !loading ? '0 4px 20px #c9a96e30' : '0 2px 8px #00000040',
        transform: hovered && !loading ? 'translateY(-1px)' : 'none',
      }}
    >
      {loading ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8a7d6e"
          strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f0e0d" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}

      <span
        style={{
          fontFamily: "'Georgia', serif",
          fontStyle: 'italic',
          fontSize: fullWidth ? '13px' : '14px',
          fontWeight: 400,
          color: loading ? '#5a5248' : '#0f0e0d',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'A gerar…' : `Exportar ${filename}.docx`}
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
