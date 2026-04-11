'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessingBars } from '@/components/ProcessingBars';

interface Props {
  onClick: () => void;
  loading: boolean;
  filename?: string;
  includeCover?: boolean;
  fullWidth?: boolean;
}

export function ExportButton({ onClick, loading, filename = 'document', includeCover = false, fullWidth = false }: Props) {
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

  const idleLabel = includeCover ? 'Exportar com capa' : `Exportar ${filename}.docx`;
  const exportedLabel = includeCover ? 'Exportado com capa' : `Exportado ${filename}.docx`;

  return (
    <button
      className={`press-feedback flex items-center justify-center gap-2 rounded-[10px] border-none px-4 py-3 transition-all ${fullWidth ? 'w-full' : 'w-auto'} ${loading ? 'cursor-not-allowed bg-[var(--border-subtle)] opacity-50' : 'cursor-pointer bg-[linear-gradient(135deg,#d4b37b,#c9a96e)] text-black hover:-translate-y-px hover:brightness-110'}`}
      onClick={handleClick}
      disabled={loading}
    >
      {loading && <ProcessingBars height={14} />}
      <span className="mono text-[12px] font-bold">{loading ? 'A gerar…' : recentlyExported ? exportedLabel : idleLabel}</span>
    </button>
  );
}
