'use client';

import React from 'react';
import { useAppStore } from '@/store/mnotes/app-store';
import { ActivityType } from '@/types/mnotes';
import { FileText, Plus, Search, MessageSquare, History, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ICON_MAP: Record<string, any> = {
  notebook_opened: History,
  source_added: Plus,
  document_summarized: FileText,
  semantic_search: Search,
  message_sent: MessageSquare,
};

export const ActivityPanel = () => {
  const { recentActivity, isActivityPanelOpen, setIsActivityPanelOpen } = useAppStore();

  return (
    <AnimatePresence>
      {isActivityPanelOpen && (
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[320px] bg-[var(--parchment)] border-l border-[var(--border)] shadow-2xl flex flex-col pt-[60px] md:pt-0"
        >
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <span className="label-mono">Registo de Actividade</span>
            <button onClick={() => setIsActivityPanelOpen(false)} className="icon-btn text-[var(--faint)] p-2 hover:bg-[var(--border)]/20 rounded-lg">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {recentActivity.length === 0 ? (
              <div className="text-center py-20 text-[var(--faint)]">
                <History size={40} className="mx-auto opacity-10 mb-4" />
                <p className="label-mono italic">Sem actividade recente</p>
              </div>
            ) : (
              recentActivity.map((item) => {
                const Icon = ICON_MAP[item.type] || History;
                return (
                  <div key={item.id} className="flex gap-3 group">
                    <div className="mt-1 w-7 h-7 rounded-lg bg-[var(--border)]/30 flex items-center justify-center text-[var(--muted)] group-hover:bg-[var(--gold2)]/20 group-hover:text-[var(--gold2)] transition-colors shrink-0">
                      <Icon size={14} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="label-mono text-[9px] text-[var(--faint)] uppercase">{item.type.replace('_', ' ')}</p>
                      <p className="text-xs font-medium text-[var(--ink)] truncate">{item.title}</p>
                      <p className="text-[10px] text-[var(--muted)] opacity-60">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
