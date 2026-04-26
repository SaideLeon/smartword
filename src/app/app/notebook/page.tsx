'use client';

import React, { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { useThemeMode } from '@/hooks/mnotes/useThemeMode';
import { useAppStore } from '@/store/mnotes/app-store';
import { INITIAL_NOTEBOOKS } from '@/lib/mnotes/data/initial-notebooks';

// Components
import { AppNav } from '@/components/mnotes/layout/AppNav';
import { HomeView } from '@/components/mnotes/home/HomeView';
import { NotebookView } from '@/components/mnotes/notebook/NotebookView';
import { ActivityPanel } from '@/components/mnotes/notebook/activity/ActivityPanel';
import { AddSourceModal } from '@/components/mnotes/modals/AddSourceModal';

export default function MuneriNotebooks() {
  const { themeMode, mounted } = useThemeMode();
  const { 
    notebooks, 
    setNotebooks, 
    view,
  } = useAppStore();

  // Initialize notebooks if empty
  useEffect(() => {
    if (notebooks.length === 0) {
      setNotebooks(INITIAL_NOTEBOOKS);
    }
  }, [notebooks.length, setNotebooks]);

  if (!mounted) return null;

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  return (
    <main className={`${themeVars} h-screen bg-[var(--parchment)] text-[var(--ink)] font-sans antialiased flex flex-col overflow-hidden`}>
      <AppNav />

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'home' ? (
            <HomeView key="home" />
          ) : (
            <NotebookView key="notebook" />
          )}
        </AnimatePresence>
      </div>

      <ActivityPanel />
      <AddSourceModal />
    </main>
  );
}
