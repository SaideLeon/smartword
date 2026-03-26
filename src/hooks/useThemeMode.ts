'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'muneri-theme-mode';

function getPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  return 'dark';
}

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    setThemeMode(getPreferredTheme());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, themeMode);
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { themeMode, toggleThemeMode };
}
