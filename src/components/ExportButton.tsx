'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
      className={`press-feedback mn-btn mn-btn-accent flex items-center justify-center gap-2 px-4 py-3 transition-all ${fullWidth ? 'w-full' : 'w-auto'} ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-px hover:brightness-110'}`}
      onClick={handleClick}
      disabled={loading}
    >
      <span className="mono text-[12px] font-bold">{loading ? 'A gerar…' : recentlyExported ? exportedLabel : idleLabel}</span>
    </button>
  );
}
