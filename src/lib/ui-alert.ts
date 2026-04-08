export type AppAlertDetail = {
  title?: string;
  message: string;
};

const APP_ALERT_EVENT = 'app-alert';

export function showAppAlert(detail: AppAlertDetail): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<AppAlertDetail>(APP_ALERT_EVENT, { detail }));
}

export function listenAppAlert(handler: (detail: AppAlertDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AppAlertDetail>;
    if (!customEvent.detail?.message) return;
    handler(customEvent.detail);
  };

  window.addEventListener(APP_ALERT_EVENT, listener);
  return () => window.removeEventListener(APP_ALERT_EVENT, listener);
}
