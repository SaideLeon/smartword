type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as FullscreenElement;
  return Boolean(root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen);
}

export function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || null;
}

export async function requestAppFullscreen(): Promise<void> {
  const root = document.documentElement as FullscreenElement;
  if (root.requestFullscreen) {
    await root.requestFullscreen();
    return;
  }
  if (root.webkitRequestFullscreen) {
    await root.webkitRequestFullscreen();
    return;
  }
  if (root.msRequestFullscreen) {
    await root.msRequestFullscreen();
  }
}

export async function exitAppFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }
  if (doc.msExitFullscreen) {
    await doc.msExitFullscreen();
  }
}
