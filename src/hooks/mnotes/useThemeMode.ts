'use client';

import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;
    
    setThemeMode(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    setMounted(true);
  }, []);

  const toggleThemeMode = () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    localStorage.setItem('theme-mode', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return { themeMode, toggleThemeMode, mounted };
}
