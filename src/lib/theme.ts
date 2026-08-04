const THEME_KEY = 'task_manager_theme';

export type Theme = 'hacker' | 'normal' | 'dark';

const THEMES: Theme[] = ['hacker', 'normal', 'dark'];

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'hacker';
  const stored = localStorage.getItem(THEME_KEY);
  return THEMES.includes(stored as Theme) ? (stored as Theme) : 'hacker';
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}
