'use client';

import { useEffect, useState } from 'react';
import { listenAppAlert, type AppAlertDetail } from '@/lib/ui-alert';

const DEFAULT_TITLE = 'Muneri';

export function AppAlertModal() {
  const [alertState, setAlertState] = useState<AppAlertDetail | null>(null);

  useEffect(() => listenAppAlert(setAlertState), []);

  if (!alertState) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#d9a46b33] bg-[linear-gradient(180deg,#21150f,#16110f)] p-5 shadow-[0_20px_80px_rgba(0,0,0,.55)]">
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
