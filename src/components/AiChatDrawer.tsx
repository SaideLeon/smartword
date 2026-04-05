'use client';

import { useEffect, useRef } from 'react';
import { AiChat } from '@/components/AiChat';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  isMobile?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AiChatDrawer({ open, onClose, onInsert, onReplace, isMobile = false }: Props) {
  const panelRef = useRef<HTMLElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const panel = panelRef.current;
    if (!panel) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const firstFocusable = focusable[0] ?? panel;
    firstFocusable.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const currentFocusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (currentFocusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = currentFocusable[0];
      const last  = currentFocusable[currentFocusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);

    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      lastActiveElementRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
      />

      {/* Painel */}
      <aside
        ref={panelRef}
        aria-label="Painel do chat IA"
        aria-modal="true"
        className="fixed bottom-0 right-0 z-[61] flex h-[min(92dvh,820px)] w-full max-w-[420px] animate-[slideIn_0.25s_ease] flex-col border-l border-[var(--border)] bg-[var(--parchment)] shadow-[-12px_0_40px_rgba(0,0,0,0.35)] outline-none md:top-0 md:h-full"
        role="dialog"
        tabIndex={-1}
      >
        <AiChat onInsert={onInsert} onReplace={onReplace} onClose={onClose} isMobile={isMobile} />
      </aside>
    </>
  );
}
