'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  X, 
  Send, 
  Search, 
  SquareChevronRight,
  Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/store/mnotes/app-store';
import { useChat } from '@/hooks/mnotes/useChat';
import { useSources } from '@/hooks/mnotes/useSources';
import { useSuggestions } from '@/hooks/mnotes/useSuggestions';

export const NotebookView = () => {
  const { 
    selectedNotebook, 
    sources, 
    isSidebarOpen, 
    setIsSidebarOpen, 
    messages, 
    isLoading,
    highlightedSourceId,
    setHighlightedSourceId,
    setIsAddSourceModalOpen
  } = useAppStore();

  const { handleSendMessage, handleSummarizeDocument } = useChat();
  const { toggleSourceSelection } = useSources();
  const { suggestedQuestions, isGeneratingSuggestions, generateSuggestions } = useSuggestions();
  
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (sources.length > 0) {
      generateSuggestions(sources);
    }
  }, [sources.length]);

  const handleCitationClick = (citeId: number) => {
    const activeSources = sources.filter(s => s.selected || s.data);
    const source = activeSources[citeId - 1];
    if (source) {
      setHighlightedSourceId(source.id);
      document.getElementById(`source-${source.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setHighlightedSourceId(null), 3000);
    }
  };

  return (
    <motion.div 
      key="notebook"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full overflow-hidden"
    >
      {/* Left Panel: Sources */}
      <AnimatePresence>
        {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-y-0 left-0 z-40 w-[280px] sm:w-[300px] border-r border-[var(--border)] bg-[var(--parchment)] flex flex-col pt-[60px] md:pt-0 md:relative md:flex md:translate-x-0 ${isSidebarOpen ? 'shadow-2xl' : ''}`}
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="label-mono">Repositório de Fontes</span>
              <button onClick={() => setIsSidebarOpen(false)} className="icon-btn text-[var(--faint)] md:hidden">
                <X size={18} />
              </button>
              <button className="icon-btn text-[var(--faint)] hidden md:block">
                <SquareChevronRight size={16} />
              </button>
            </div>
        
            <div className="p-4 space-y-4">
              <div className="bg-[var(--parchment)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="label-mono mb-2 text-[var(--faint)]">Processar Documentos</h3>
                <button 
                   onClick={() => setIsAddSourceModalOpen(true)}
                   className="btn-gold w-full flex items-center justify-center gap-2 bg-[var(--gold)] text-black rounded-lg py-2 font-medium"
                >
                  <Plus size={14} /> Adicionar Fonte
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={14} />
                <input 
                  type="text" 
                  placeholder="Busca semântica..." 
                  className="w-full bg-transparent border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--gold2)] outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
              <div>
                <div className="flex items-center justify-between label-mono border-b border-[var(--border)] pb-2 mb-4">
                  <span>Inventário Activo</span>
                  <span className="text-[var(--gold2)]">{sources.filter(s => s.selected).length} Sel.</span>
                </div>
                
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div 
                      key={source.id}
                      id={`source-${source.id}`}
                      onClick={() => toggleSourceSelection(source.id)}
                      className={`p-3 bg-[var(--parchment)] border transition-all relative overflow-hidden rounded-xl cursor-pointer hover:border-[var(--gold2)] group ${
                        source.id === highlightedSourceId 
                          ? 'border-[var(--gold2)] ring-2 ring-[var(--gold2)]/20 scale-[1.02]' 
                          : source.selected ? 'border-[var(--gold2)]/40' : 'border-[var(--border)]'
                      }`}
                    >
                      {source.selected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--gold2)]"></div>}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${source.selected ? 'bg-[var(--gold2)]/20 text-[var(--gold2)]' : 'bg-[var(--border)]/20 text-[var(--faint)]'} font-mono text-[10px] font-bold shrink-0`}>
                          {source.type.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--ink)] font-medium truncate group-hover:text-[var(--gold2)] transition-colors">
                            {source.name}
                          </div>
                          <p className="text-[9px] text-[var(--faint)] mt-0.5 font-mono">
                            {source.type === 'pdf' ? (source.data ? 'Vectorizado com ∂' : 'Fonte Local') : 'Texto Customizado'}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full transition-all ${source.selected ? 'bg-[var(--gold2)] text-black border-none' : 'border border-[var(--border)]'} flex items-center justify-center text-[10px]`}>
                          {source.selected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                      {source.selected && source.data && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSummarizeDocument(source.id);
                          }}
                          className="mt-3 w-full border border-[var(--border)] rounded-lg py-1.5 text-[9px] font-bold text-[var(--gold2)] uppercase tracking-wider hover:bg-[var(--gold2)]/5 transition-all"
                        >
                          Resumir Documento
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Middle Panel: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--parchment)] relative">
        <header className="p-3 sm:p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--navBg)]/90 backdrop-blur-md sticky top-0 z-[5]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="label-mono shrink-0 hidden sm:inline">Diálogo Analítico</span>
            <div className="h-4 w-px bg-[var(--border)] hidden sm:block"></div>
            <div className="flex items-center gap-2 min-w-0">
               <span className="text-[11px] font-serif italic text-[var(--gold2)] truncate">
                 {selectedNotebook?.title}
               </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="icon-btn text-[var(--faint)] p-2 hover:bg-[var(--border)]/10 rounded-lg"><Search size={16} /></button>
            <button className="icon-btn text-[var(--faint)] p-2 hover:bg-[var(--border)]/10 rounded-lg"><Plus size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 space-y-6 sm:space-y-10 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 sm:gap-6 py-12 sm:py-20 text-center animate-in fade-in zoom-in-95 duration-700">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-4xl shadow-2xl relative text-black">
                {selectedNotebook?.icon}
                <div className="absolute -inset-2 bg-[var(--gold2)]/20 blur-xl rounded-full -z-10 animate-pulse"></div>
              </div>
              <div className="space-y-2 sm:space-y-4 px-4">
                <h2 className="font-serif text-2xl sm:text-3xl text-[var(--ink)] tracking-tight">{selectedNotebook?.title}</h2>
                <p className="text-sm sm:text-base text-[var(--muted)] max-w-lg leading-relaxed mx-auto">
                  {selectedNotebook?.description}
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-[var(--ink)]' 
                  : 'bg-[var(--parchment)] border border-[var(--border)] text-[var(--muted)]'
              }`}>
                <div className={`prose prose-sm prose-invert max-w-none ${msg.role === 'user' ? 'text-[var(--ink)]' : 'text-[var(--muted)]'} text-xs sm:text-sm`}>
                  <ReactMarkdown
                    components={{
                       a: ({...props }) => {
                        const content = String(props.children);
                        const match = content.match(/\[Doc (\d+)\]/);
                        if (match) {
                          const citeId = parseInt(match[1]);
                          return (
                            <button 
                              onClick={() => handleCitationClick(citeId)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--gold2)]/10 text-[var(--gold2)] rounded border border-[var(--gold2)]/20 hover:bg-[var(--gold2)]/20 transition-colors mx-0.5 font-bold"
                            >
                              {content}
                            </button>
                          );
                        }
                        return <a {...props} className="text-[var(--gold2)] underline" />;
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap gap-2">
                    {msg.citations.map(citeId => (
                      <button 
                        key={citeId}
                        onClick={() => handleCitationClick(citeId)}
                        className="text-[9px] font-mono px-2 py-1 bg-[var(--border)]/30 rounded-lg hover:bg-[var(--gold2)]/20 hover:text-[var(--gold2)] transition-all"
                      >
                        [Fonte {citeId}]
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[var(--parchment)] border border-[var(--border)] rounded-2xl p-4 flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold2)] animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold2)] animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold2)] animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 sm:p-6 bg-[var(--navBg)]/90 backdrop-blur-md border-t border-[var(--border)]">
          {/* Suggested Questions */}
          {(isGeneratingSuggestions || suggestedQuestions.length > 0) && (
            <div className="mx-auto max-w-4xl mb-4 sm:mb-6 overflow-x-auto no-scrollbar pb-2">
               <div className="flex gap-2 min-w-max">
                {isGeneratingSuggestions ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--parchment)] animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold2)] animate-ping"></div>
                    <span className="label-mono text-[8px] sm:text-[9px] text-[var(--gold2)] uppercase">Gerando perguntas inteligentes...</span>
                  </div>
                ) : (
                  suggestedQuestions.map((q, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="px-3 sm:px-4 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--parchment)] text-[9px] sm:text-[10px] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)] hover:bg-[var(--gold2)]/10 transition-all text-left max-w-[200px] sm:max-w-xs truncate shadow-sm animate-in fade-in slide-in-from-left-2 duration-500"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      {q}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="mx-auto max-w-4xl relative">
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                  setInputValue('');
                }
              }}
              placeholder="Faça uma pergunta sobre seus documentos..."
              rows={1}
              className="w-full bg-transparent border border-[var(--border)] rounded-2xl px-5 py-4 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] outline-none focus:border-[var(--gold2)] transition-all resize-none shadow-lg pl-6 pr-14"
            />
            <button 
              onClick={() => {
                handleSendMessage(inputValue);
                setInputValue('');
              }}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--gold)] text-black rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-md"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-center text-[9px] text-[var(--faint)] mt-4 label-mono">
            Muneri pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
