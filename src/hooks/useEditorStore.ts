/**
 * useEditorStore.ts — Store global do editor (Zustand).
 *
 * FASE 1: gere apenas o painel lateral activo (sidePanel).
 * FASE 2 (futura): adicionar markdown, filename, histórico undo/redo.
 *
 * INSTALAÇÃO (se ainda não feito):
 *   npm install zustand
 */

import { create } from 'zustand';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SidePanel = 'none' | 'chat' | 'tcc' | 'work';

interface EditorState {
  // ── Estado ──────────────────────────────────────────────────────────────────
  sidePanel: SidePanel;

  // ── Acções ──────────────────────────────────────────────────────────────────

  /**
   * Abre o painel pedido. Se já estiver aberto, fecha-o.
   * Espelha exactamente o comportamento do togglePanel anterior no page.tsx.
   */
  togglePanel: (panel: SidePanel) => void;

  /** Fecha o painel activo. */
  closePanel: () => void;

  /** Abre directamente um painel sem toggle. */
  openPanel: (panel: SidePanel) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>((set, get) => ({
  // Estado inicial
  sidePanel: 'none',

  // Acções
  togglePanel: (panel) =>
    set({ sidePanel: get().sidePanel === panel ? 'none' : panel }),

  closePanel: () =>
    set({ sidePanel: 'none' }),

  openPanel: (panel) =>
    set({ sidePanel: panel }),
}));

// ─── Selectores (evitam re-renders desnecessários) ────────────────────────────

/** Devolve apenas o painel activo. Não re-renderiza quando as acções mudam. */
export const useSidePanel = () => useEditorStore((s) => s.sidePanel);

/** Devolve apenas as acções. Nunca causa re-render por mudança de estado. */
export const usePanelActions = () =>
  useEditorStore((s) => ({
    togglePanel: s.togglePanel,
    closePanel:  s.closePanel,
    openPanel:   s.openPanel,
  }));
