'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/store/mnotes/app-store';
import { NotebookGrid } from './NotebookGrid';

export const HomeView = () => {
  const { setView, setSelectedNotebook, setSources, setMessages } = useAppStore();

  const handleCreateNew = () => {
    const newNotebook = {
      id: crypto.randomUUID(),
      title: 'Novo Notebook',
      icon: '📔',
      sources: [],
      lastModified: 'Agora',
      description: 'Comece um novo estudo aqui.'
    };
    setSelectedNotebook(newNotebook);
    setSources([]);
    setMessages([]);
    setView('notebook');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="h-full overflow-y-auto"
    >
      <header className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 md:px-12 md:py-20 lg:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">
          Muneri · Seus Notebooks Académicos
        </p>
        <h1 className="mt-4 font-serif text-[1.8rem] xs:text-[2.2rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl text-[var(--ink)] max-w-4xl">
          Trabalhos académicos com <em className="text-[var(--gold2)] normal-case not-italic">inteligência e precisão.</em>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg opacity-80">
          Organize suas fontes, faça buscas semânticas e gere resumos automáticos para seus estudos.
        </p>
      </header>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-6 md:px-12">
        <div className="flex items-center justify-between mb-8">
          <p className="label-mono">Notebooks Recentes</p>
          <button 
            onClick={handleCreateNew}
            className="btn-gold px-4 py-2 bg-[var(--gold)] text-black rounded-lg flex items-center gap-2 font-medium"
          >
            <Plus size={16} /> Criar Novo
          </button>
        </div>

        <NotebookGrid />
      </section>

      <footer className="border-t border-[var(--border)] px-5 py-6 sm:px-6 md:px-12">
        <div className="mx-auto max-w-7xl flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
            Muneri · Gerador de Trabalhos Académicos · 2026
          </div>
          <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
        </div>
      </footer>
    </motion.div>
  );
};
