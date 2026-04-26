import { create } from 'zustand';
import { Notebook, Source, Message, ActivityItem } from '@/types/mnotes';

interface AppState {
  // Navigation & View
  view: 'home' | 'notebook';
  setView: (view: 'home' | 'notebook') => void;
  
  // Notebooks
  notebooks: Notebook[];
  setNotebooks: (notebooks: Notebook[]) => void;
  selectedNotebook: Notebook | null;
  setSelectedNotebook: (notebook: Notebook | null) => void;
  
  // Sources
  sources: Source[];
  setSources: (sources: Source[]) => void;
  addSource: (source: Source) => void;
  highlightedSourceId: string | null;
  setHighlightedSourceId: (id: string | null) => void;
  
  // Chat
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  
  // Activity
  recentActivity: ActivityItem[];
  addActivity: (activity: ActivityItem) => void;
  isActivityPanelOpen: boolean;
  setIsActivityPanelOpen: (isOpen: boolean) => void;
  
  // Modals & Panels
  isAddSourceModalOpen: boolean;
  setIsAddSourceModalOpen: (isOpen: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'home',
  setView: (view) => set({ view }),
  
  notebooks: [],
  setNotebooks: (notebooks) => set({ notebooks }),
  selectedNotebook: null,
  setSelectedNotebook: (selectedNotebook) => set({ selectedNotebook }),
  
  sources: [],
  setSources: (sources) => set({ sources }),
  addSource: (source) => set((state) => ({ sources: [...state.sources, source] })),
  highlightedSourceId: null,
  setHighlightedSourceId: (highlightedSourceId) => set({ highlightedSourceId }),
  
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  
  recentActivity: [],
  addActivity: (activity) => set((state) => ({ 
    recentActivity: [activity, ...state.recentActivity].slice(0, 20) 
  })),
  isActivityPanelOpen: false,
  setIsActivityPanelOpen: (isActivityPanelOpen) => set({ isActivityPanelOpen }),
  
  isAddSourceModalOpen: false,
  setIsAddSourceModalOpen: (isAddSourceModalOpen) => set({ isAddSourceModalOpen }),
  isSidebarOpen: false,
  setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
}));
