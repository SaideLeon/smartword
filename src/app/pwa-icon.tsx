import React from 'react';

const BACKGROUND = '#0f0e0d';
const FOREGROUND = '#e7c574';

export function PwaIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const fontSize = Math.round(size * 0.48);
  const safeArea = maskable ? '14%' : '8%';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 30% 20%, #2a2722 0%, ${BACKGROUND} 68%)`,
        borderRadius: size * 0.22,
        padding: safeArea,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: size * 0.18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: FOREGROUND,
          fontWeight: 800,
          fontSize,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          letterSpacing: '-0.05em',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(231,197,116,0.28)',
        }}
      >
        M
      </div>
    </div>
  );
}
