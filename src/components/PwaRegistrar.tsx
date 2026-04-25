'use client';

import {useEffect} from 'react';

const SW_PATH = '/sw.js';
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let updateTimer: number | undefined;
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_PATH, {
          scope: '/',
          updateViaCache: 'none',
        });

        const activateUpdate = () => {
          registration.waiting?.postMessage({type: 'SKIP_WAITING'});
        };

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateUpdate();
            }
          });
        });

        updateTimer = window.setInterval(() => {
          void registration.update();
        }, UPDATE_INTERVAL_MS);
      } catch (error) {
        console.error('Falha ao registar o service worker do PWA.', error);
      }
    };

    void registerServiceWorker();

    return () => {
      if (updateTimer) {
        window.clearInterval(updateTimer);
      }
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
