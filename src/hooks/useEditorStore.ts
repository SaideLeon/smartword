import { create } from 'zustand';

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
  setCurrentStructure: (structure: string[]) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  sidePanel: 'none',
  content: DEFAULT_MARKDOWN,
  filename: 'matematica-teste',
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
  setCurrentStructure: (currentStructure) => set({ currentStructure }),
}));

export const useSidePanel = () => useEditorStore((s) => s.sidePanel);

export const usePanelActions = () =>
  useEditorStore((s) => ({
    togglePanel: s.togglePanel,
    closePanel: s.closePanel,
    openPanel: s.openPanel,
  }));

export const useEditorContent = () => useEditorStore((s) => s.content);

export const useEditorMeta = () =>
  useEditorStore((s) => ({
    filename: s.filename,
    currentStructure: s.currentStructure,
    canUndo: s.undoStack.length > 0,
    canRedo: s.redoStack.length > 0,
  }));

export const useEditorActions = () =>
  useEditorStore((s) => ({
    setContent: s.setContent,
    clearDefaultContent: s.clearDefaultContent,
    undo: s.undo,
    redo: s.redo,
    setFilename: s.setFilename,
    setFilenameFromTopic: s.setFilenameFromTopic,
    setCurrentStructure: s.setCurrentStructure,
  }));
