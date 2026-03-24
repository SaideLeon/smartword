'use client';

import {useEffect} from 'react';

const SW_PATH = '/sw.js';

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(SW_PATH, {scope: '/'});
      } catch (error) {
        console.error('Falha ao registar o service worker do PWA.', error);
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
