import { create } from 'zustand';
import { readJson, writeJson } from '../lib/storage';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'querylite.theme';

function initialTheme(): Theme {
  const stored = readJson<Theme | null>(THEME_KEY, null);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

/** Follows the system setting until the visitor picks a theme themselves. */
export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => {
  const theme = initialTheme();
  apply(theme);
  return {
    theme,
    toggle: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      apply(next);
      writeJson(THEME_KEY, next);
      set({ theme: next });
    },
  };
});
