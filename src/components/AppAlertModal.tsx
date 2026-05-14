'use client';

import { useEffect, useState } from 'react';
import { listenAppAlert, type AppAlertDetail } from '@/lib/ui-alert';

const DEFAULT_TITLE = 'Muneri';

export function AppAlertModal() {
  const [alertState, setAlertState] = useState<AppAlertDetail | null>(null);

  useEffect(() => listenAppAlert(setAlertState), []);

  if (!alertState) return null;

  const isConstruction = alertState.kind === 'construction';

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#d9a46b33] bg-[linear-gradient(180deg,#21150f,#16110f)] p-5 shadow-[0_20px_80px_rgba(0,0,0,.55)]">
        {isConstruction && (
          <div className="mb-4 rounded-xl border border-[#d9a46b33] bg-black/20 p-3">
            <div className="mb-2 flex items-end gap-1">
              <div className="h-2 w-6 animate-pulse rounded bg-[#f59e0b]" />
              <div className="h-3 w-6 animate-pulse rounded bg-[#f7b75a] [animation-delay:120ms]" />
              <div className="h-4 w-6 animate-pulse rounded bg-[#ffd18f] [animation-delay:240ms]" />
              <div className="h-5 w-6 animate-pulse rounded bg-[#f7b75a] [animation-delay:360ms]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f59e0b] border-t-transparent" />
              <span className="font-mono text-xs tracking-[0.08em] text-[#f7d5ad]">EM CONSTRUÇÃO · ATUALIZAÇÕES</span>
            </div>
          </div>
        )}
        <h3 className="font-sans text-2xl font-semibold text-[#f4e6d5]">{alertState.title || DEFAULT_TITLE}</h3>
        <p className="mt-4 font-sans text-lg leading-relaxed text-[#f4e6d5]">{alertState.message}</p>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setAlertState(null)}
            className="rounded-lg bg-[#f59e0b] px-5 py-2 text-base font-bold text-black transition hover:brightness-110"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
