'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Plus, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/mnotes/app-store';
import { Notebook } from '@/types/mnotes';

export const NotebookCard = ({ notebook }: { notebook: Notebook }) => {
  const { setSelectedNotebook, setSources, setMessages, setView } = useAppStore();

  const handleOpen = () => {
    setSelectedNotebook(notebook);
    setSources(notebook.sources || []);
    setMessages([]);
    setView('notebook');
  };

  return (
    <article 
      onClick={handleOpen}
      className="group relative space-y-4 bg-[var(--parchment)] p-6 sm:p-8 transition-all hover:bg-[var(--border)]/10 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded border border-[var(--border)] bg-[var(--parchment)] text-xl sm:text-2xl transition-transform group-hover:scale-110 shadow-sm">
          {notebook.icon}
        </div>
        <span className="label-mono text-[var(--gold2)] bg-[var(--gold2)]/10 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px]">
          {(notebook.sources || []).length} Fontes
        </span>
      </div>
      <h3 className="font-serif text-xl sm:text-2xl group-hover:text-[var(--gold2)] transition-colors leading-tight">{notebook.title}</h3>
      <p className="text-xs sm:text-sm leading-relaxed text-[var(--muted)] line-clamp-2 opacity-70">{notebook.description}</p>
      <div className="pt-4 sm:pt-6 flex items-center justify-between border-t border-[var(--border)]">
        <span className="label-mono opacity-60 italic normal-case text-[9px] sm:text-[10px]">{notebook.lastModified}</span>
        <ChevronRight size={14} className="text-[var(--gold2)] group-hover:translate-x-1.5 transition-transform" />
      </div>
    </article>
  );
};

export const NotebookGrid = () => {
  const { notebooks } = useAppStore();

  return (
    <div className="grid gap-px bg-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 shadow-2xl">
      {notebooks.map((nb) => (
        <NotebookCard key={nb.id} notebook={nb} />
      ))}
    </div>
  );
};
