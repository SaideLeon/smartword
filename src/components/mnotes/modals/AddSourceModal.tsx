'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus } from 'lucide-react';
import { useAppStore } from '@/store/mnotes/app-store';
import { useSources } from '@/hooks/mnotes/useSources';

export const AddSourceModal = () => {
  const { isAddSourceModalOpen, setIsAddSourceModalOpen } = useAppStore();
  const { handleFileUpload, addTextSource } = useSources();
  const [addSourceTab, setAddSourceTab] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextSubmit = () => {
    if (!pastedText.trim() || !pastedTitle.trim()) return;
    addTextSource(pastedTitle, pastedText);
    setPastedText('');
    setPastedTitle('');
    setIsAddSourceModalOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e);
    setIsAddSourceModalOpen(false);
  };

  return (
    <AnimatePresence>
      {isAddSourceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddSourceModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[var(--parchment)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl text-[var(--ink)]">Adicionar Fonte</h2>
                <p className="label-mono mt-1 text-[9px] sm:text-[10px]">Escolha como deseja importar</p>
              </div>
              <button onClick={() => setIsAddSourceModalOpen(false)} className="icon-btn text-[var(--faint)]">
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-[var(--border)]">
              <button 
                onClick={() => setAddSourceTab('file')}
                className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${addSourceTab === 'file' ? 'text-[var(--gold2)] bg-[var(--gold2)]/5 border-b-2 border-[var(--gold2)]' : 'text-[var(--faint)] hover:text-[var(--ink)]'}`}
              >
                Arquivo PDF
              </button>
              <button 
                onClick={() => setAddSourceTab('text')}
                className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${addSourceTab === 'text' ? 'text-[var(--gold2)] bg-[var(--gold2)]/5 border-b-2 border-[var(--gold2)]' : 'text-[var(--faint)] hover:text-[var(--ink)]'}`}
              >
                Texto Direto
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {addSourceTab === 'file' ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-xl py-8 sm:py-12 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--gold2)] hover:bg-[var(--gold2)]/5 transition-all group"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--faint)] group-hover:text-[var(--gold2)] group-hover:bg-[var(--gold2)]/10 transition-colors mb-3 sm:mb-4">
                    <Plus size={24} />
                  </div>
                  <p className="font-serif text-base sm:text-lg text-[var(--ink)]">Clique para selecionar PDF</p>
                  <p className="label-mono mt-1 opacity-60 text-[9px] sm:text-[10px]">Suporta apenas arquivos .pdf</p>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label-mono mb-2 block">Título da Fonte</label>
                    <input 
                      type="text" 
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      placeholder="Ex: Notas de Aula - Biologia"
                      className="w-full bg-transparent border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold2)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="label-mono mb-2 block">Conteúdo</label>
                    <textarea 
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Cole ou digite o texto aqui..."
                      rows={8}
                      className="w-full bg-transparent border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold2)] transition-colors resize-none"
                    />
                  </div>
                  <button 
                    onClick={handleTextSubmit}
                    disabled={!pastedText.trim() || !pastedTitle.trim()}
                    className="btn-gold w-full flex items-center justify-center py-3 bg-[var(--gold)] text-black rounded-xl font-medium disabled:opacity-50"
                  >
                    Salvar Fonte de Texto
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
