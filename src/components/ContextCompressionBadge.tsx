// components/ContextCompressionBadge.tsx
// Indicador visual discreto do estado de compressão de contexto.
// Aparece no TccPanel quando a compressão está activa.

'use client';

import { useState, useEffect } from 'react';
import type { CompressionStatus } from '@/hooks/useTccSession';

interface Props {
  status: CompressionStatus;
}

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

  const badgeTone = showPulse
    ? 'border-[#c9a96e44] bg-[#c9a96e33]'
    : 'border-[#6a9e5f44] bg-[#6a9e5f44]';

  const dotTone = showPulse
    ? 'bg-[#c9a96e] shadow-[0_0_6px_#c9a96e]'
    : 'bg-[#6a9e5f] shadow-[0_0_4px_#6a9e5f88]';

  const mainTextTone = showPulse ? 'text-[#c9a96e]' : 'text-[#7a9272]';

  return (
    <div
      className={`flex items-center gap-1.5 rounded px-[0.65rem] py-[0.3rem] font-mono text-[10px] tracking-[0.06em] transition-all duration-500 ease-in-out border ${badgeTone}`}
    >
      {/* Ícone de estado */}
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500 ease-in-out ${dotTone} ${showPulse ? 'animate-[compression-pulse_1s_ease-in-out_3]' : ''}`}
      />

      <span className={mainTextTone}>
        {showPulse
          ? '✦ Contexto comprimido'
          : `∑ Resumo activo · ${status.summaryLength} chars`
        }
      </span>

      {/* Tooltip com mais detalhe */}
      {status.coveredUpTo !== null && !showPulse && (
        <span className="ml-0.5 border-l border-[#1e2a1e] pl-1.5 text-[#3a4e36]">
          secções 0–{status.coveredUpTo} resumidas
        </span>
      )}
    </div>
  );
}
