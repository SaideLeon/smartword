'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Settings, History, Share2 } from 'lucide-react';
import { useThemeMode } from '@/hooks/mnotes/useThemeMode';
import { useAppStore } from '@/store/mnotes/app-store';

export const AppNav = () => {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { 
    view, 
    setView, 
    isActivityPanelOpen, 
    setIsActivityPanelOpen, 
    isSidebarOpen, 
    setIsSidebarOpen 
  } = useAppStore();

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--navBg)] px-4 py-3 shrink-0 transition-colors duration-300 shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          {view === 'notebook' && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="icon-btn md:hidden p-2 hover:bg-[var(--border)]/20 rounded-lg text-[var(--ink)]"
            >
              <Menu size={20} />
            </button>
          )}
          <Link 
            href="#" 
            onClick={(e) => { e.preventDefault(); setView('home'); }} 
            className="flex items-center gap-2 sm:gap-3 group"
          >
            <div className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-xs sm:text-sm font-bold text-black transition-transform group-hover:scale-110">∂</div>
            <span className="font-serif text-lg sm:text-xl italic text-[var(--gold2)]">Muneri</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={toggleThemeMode}
            className="btn-border !p-2 sm:!px-4 sm:!py-2 border border-[var(--border)] rounded-lg text-xs"
          >
            <Settings size={14} className="sm:hidden" />
            <span className="hidden sm:inline">{themeMode === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>
          <button 
            className={`btn-border !p-2 sm:!p-2.5 border border-[var(--border)] rounded-lg ${isActivityPanelOpen ? 'border-[var(--gold2)] text-[var(--gold2)]' : ''}`}
            onClick={() => setIsActivityPanelOpen(!isActivityPanelOpen)}
          >
            <History size={16} />
          </button>
          <button className="btn-gold !px-3 !py-1.5 sm:!px-4 sm:!py-2 text-xs sm:text-sm bg-[var(--gold)] text-black rounded-lg font-medium">
            <span className="hidden xs:inline">Compartilhar</span>
            <Share2 size={14} className="xs:hidden" />
          </button>
        </div>
      </div>
    </nav>
  );
};
