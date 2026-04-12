'use client';

import { Maximize, Minimize } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function GlobalFullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(typeof document !== 'undefined' && !!document.documentElement.requestFullscreen);
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!isSupported) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  }, [isSupported]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggleFullscreen}
      aria-label={isFullscreen ? 'Sair de ecrã inteiro' : 'Entrar em ecrã inteiro'}
      className="press-feedback fixed bottom-4 right-4 z-[70] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--parchment)]/90 text-[var(--muted)] shadow-lg backdrop-blur transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
      title={isFullscreen ? 'Sair de ecrã inteiro' : 'Entrar em ecrã inteiro'}
    >
      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </button>
  );
}
