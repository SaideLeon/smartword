import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { CoverData } from '@/lib/docx/cover-types';

export type SidePanel = 'none' | 'chat' | 'tcc' | 'work';

const HISTORY_LIMIT = 100;
const DEFAULT_MARKDOWN = `# Matemática — Equações do 2.º Grau e Logaritmos

## 1. Equações do 2.º Grau

Uma equação do 2.º grau (ou equação quadrática) é toda equação da forma:

$$ax^2 + bx + c = 0$$

onde $a \\neq 0$ e $a, b, c \\in \\mathbb{R}$.`;

function buildFilenameFromTopic(topic: string) {
  const normalized = topic
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);

  return normalized || 'documento';
}

interface EditorState {
  sidePanel: SidePanel;
  content: string;
  filename: string;
  includeCover: boolean;
  coverData: CoverData | null;
  currentStructure: string[];
  undoStack: string[];
  redoStack: string[];
  togglePanel: (panel: SidePanel) => void;
  closePanel: () => void;
  openPanel: (panel: SidePanel) => void;
  setContent: (content: string | ((prev: string) => string)) => void;
  clearDefaultContent: () => void;
  undo: () => void;
  redo: () => void;
  setFilename: (filename: string) => void;
  setFilenameFromTopic: (topic: string) => void;
  setIncludeCover: (value: boolean) => void;
  setCoverData: (data: CoverData | null) => void;
  resetExportPreferences: () => void;
  setCurrentStructure: (structure: string[]) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  sidePanel: 'none',
  content: DEFAULT_MARKDOWN,
  filename: 'matematica-teste',
  includeCover: false,
  coverData: null,
  currentStructure: [],
  undoStack: [],
  redoStack: [],

  togglePanel: (panel) => set({ sidePanel: get().sidePanel === panel ? 'none' : panel }),
  closePanel: () => set({ sidePanel: 'none' }),
  openPanel: (panel) => set({ sidePanel: panel }),

  setContent: (value) => {
    const prev = get().content;
    const next = typeof value === 'function' ? value(prev) : value;

    if (next === prev) return;

    set((state) => ({
      content: next,
      undoStack: [...state.undoStack.slice(-(HISTORY_LIMIT - 1)), prev],
      redoStack: [],
    }));
  },

  clearDefaultContent: () => {
    if (get().content === DEFAULT_MARKDOWN) {
      get().setContent('');
    }
  },

  undo: () => {
    const { undoStack, content, redoStack } = get();
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    set({
      content: previous,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack.slice(-(HISTORY_LIMIT - 1)), content],
    });
  },

  redo: () => {
    const { redoStack, content, undoStack } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    set({
      content: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack.slice(-(HISTORY_LIMIT - 1)), content],
    });
  },

  setFilename: (filename) => set({ filename }),
  setFilenameFromTopic: (topic) => set({ filename: buildFilenameFromTopic(topic) }),
  setIncludeCover: (includeCover) => set({ includeCover }),
  setCoverData: (coverData) => set({ coverData }),
  resetExportPreferences: () => set({ includeCover: false, coverData: null }),
  setCurrentStructure: (currentStructure) => set({ currentStructure }),
}));

export const useSidePanel = () => useEditorStore((s) => s.sidePanel);

export const usePanelActions = () =>
  useEditorStore(
    useShallow((s) => ({
    togglePanel: s.togglePanel,
    closePanel: s.closePanel,
    openPanel: s.openPanel,
    })),
  );

export const useEditorContent = () => useEditorStore((s) => s.content);

export const useEditorMeta = () =>
  useEditorStore(
    useShallow((s) => ({
      filename: s.filename,
      includeCover: s.includeCover,
      currentStructure: s.currentStructure,
      canUndo: s.undoStack.length > 0,
      canRedo: s.redoStack.length > 0,
    })),
  );

export const useExportPreferences = () =>
  useEditorStore(
    useShallow((s) => ({
      includeCover: s.includeCover,
      coverData: s.coverData,
    })),
  );

export const useEditorActions = () =>
  useEditorStore(
    useShallow((s) => ({
      setContent: s.setContent,
      clearDefaultContent: s.clearDefaultContent,
      undo: s.undo,
      redo: s.redo,
      setFilename: s.setFilename,
      setFilenameFromTopic: s.setFilenameFromTopic,
      setIncludeCover: s.setIncludeCover,
      setCoverData: s.setCoverData,
      resetExportPreferences: s.resetExportPreferences,
      setCurrentStructure: s.setCurrentStructure,
    })),
  );
