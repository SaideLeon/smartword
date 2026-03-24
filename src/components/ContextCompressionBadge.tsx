// components/ContextCompressionBadge.tsx
// Indicador visual discreto do estado de compressão de contexto.
// Aparece no TccPanel quando a compressão está activa.

'use client';

import { useState, useEffect } from 'react';
import type { CompressionStatus } from '@/hooks/useTccSession';

interface Props {
  status: CompressionStatus;
}

const C = {
  accent:    '#6a9e5f',
  accentDim: '#6a9e5f33',
  muted:     '#4a6644',
  border:    '#1e2a1e',
  surface:   '#111411',
  textDim:   '#7a9272',
  textFaint: '#3a4e36',
  gold:      '#c9a96e',
  goldDim:   '#c9a96e33',
};

export function ContextCompressionBadge({ status }: Props) {
  const [showPulse, setShowPulse] = useState(false);

  // Pulsa brevemente quando acabou de comprimir
  useEffect(() => {
    if (status.justCompressed) {
      setShowPulse(true);
      const t = setTimeout(() => setShowPulse(false), 3000);
      return () => clearTimeout(t);
    }
  }, [status.justCompressed]);

  // Não mostra nada se compressão nunca foi activada
  if (!status.active && !status.justCompressed) return null;

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            '0.4rem',
      padding:        '0.3rem 0.65rem',
      borderRadius:   '4px',
      background:     showPulse ? C.goldDim : C.accentDim,
      border:         `1px solid ${showPulse ? C.gold : C.accent}44`,
      transition:     'all 0.5s ease',
      fontSize:       '10px',
      fontFamily:     'monospace',
      letterSpacing:  '0.06em',
    }}>
      {/* Ícone de estado */}
      <span style={{
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   showPulse ? C.gold : C.accent,
        boxShadow:    showPulse ? `0 0 6px ${C.gold}` : `0 0 4px ${C.accent}88`,
        flexShrink:   0,
        transition:   'all 0.5s ease',
        animation:    showPulse ? 'compressionPulse 1s ease-in-out 3' : 'none',
      }} />

      <span style={{ color: showPulse ? C.gold : C.textDim }}>
        {showPulse
          ? '✦ Contexto comprimido'
          : `∑ Resumo activo · ${status.summaryLength} chars`
        }
      </span>

      {/* Tooltip com mais detalhe */}
      {status.coveredUpTo !== null && !showPulse && (
        <span style={{
          color:         C.textFaint,
          borderLeft:    `1px solid ${C.border}`,
          paddingLeft:   '0.4rem',
          marginLeft:    '0.1rem',
        }}>
          secções 0–{status.coveredUpTo} resumidas
        </span>
      )}

      <style>{`
        @keyframes compressionPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
