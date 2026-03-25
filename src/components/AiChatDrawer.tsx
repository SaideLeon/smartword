'use client';

import { AiChat } from '@/components/AiChat';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  isMobile?: boolean;
}

export function AiChatDrawer({ open, onClose, onInsert, onReplace, isMobile = false }: Props) {
  if (!open) return null;

  return (
    <>
      <button
        aria-label="Fechar chat IA"
        className="fixed inset-0 z-[60] cursor-default bg-black/45"
        onClick={onClose}
      />
      <aside
        aria-label="Painel do chat IA"
        className="fixed bottom-0 right-0 z-[61] flex h-[min(92dvh,820px)] w-full max-w-[420px] animate-[slideIn_0.25s_ease] flex-col border-l border-[#2a2520] bg-[#0d0c0b] shadow-[-12px_0_30px_rgba(0,0,0,0.35)] md:top-0 md:h-full"
      >
        <AiChat onInsert={onInsert} onReplace={onReplace} onClose={onClose} isMobile={isMobile} />
      </aside>
    </>
  );
}
