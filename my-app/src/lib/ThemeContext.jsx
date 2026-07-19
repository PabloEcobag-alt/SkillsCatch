import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const THEMES = {
  default: {
    name: 'Indigo Pro',
    primary: '79, 70, 229',        // indigo-600
    primaryHex: '#4F46E5',
    accent: '99, 102, 241',        // indigo-500
    accentHex: '#6366F1',
    sidebarBg: '#ffffff',
    sidebarText: '#1e293b',
    pageBg: '#f8fafc',
    surface: '#ffffff',
    surfaceBorder: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    glow: 'rgba(99, 102, 241, 0.15)',
    isDark: false,
  },
  cyberNeon: {
    name: 'Cyber Neon',
    primary: '16, 185, 129',       // emerald-500
    primaryHex: '#10B981',
    accent: '34, 211, 238',        // cyan-400
    accentHex: '#22D3EE',
    sidebarBg: '#020617',          // slate-950
    sidebarText: '#e2e8f0',
    pageBg: '#0f172a',
    surface: '#1e293b',
    surfaceBorder: '#334155',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    glow: 'rgba(16, 185, 129, 0.2)',
    isDark: true,
  },
  midnightCorp: {
    name: 'Midnight Corp',
    primary: '37, 99, 235',        // blue-600
    primaryHex: '#2563EB',
    accent: '56, 189, 248',        // sky-400
    accentHex: '#38BDF8',
    sidebarBg: '#0f172a',          // slate-900
    sidebarText: '#cbd5e1',
    pageBg: '#1e293b',
    surface: '#334155',
    surfaceBorder: '#475569',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    glow: 'rgba(56, 189, 248, 0.15)',
    isDark: true,
  },
  sunsetBlaze: {
    name: 'Sunset Blaze',
    primary: '249, 115, 22',       // orange-500
    primaryHex: '#F97316',
    accent: '251, 191, 36',        // amber-400
    accentHex: '#FBBF24',
    sidebarBg: '#18181b',          // zinc-900
    sidebarText: '#d4d4d8',
    pageBg: '#27272a',
    surface: '#3f3f46',
    surfaceBorder: '#52525b',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    glow: 'rgba(249, 115, 22, 0.2)',
    isDark: true,
  },
  phantomPurple: {
    name: 'Phantom Purple',
    primary: '124, 58, 237',       // violet-600
    primaryHex: '#7C3AED',
    accent: '232, 121, 249',       // fuchsia-400
    accentHex: '#E879F9',
    sidebarBg: '#030712',          // gray-950
    sidebarText: '#d1d5db',
    pageBg: '#111827',
    surface: '#1f2937',
    surfaceBorder: '#374151',
    textPrimary: '#f9fafb',
    textSecondary: '#9ca3af',
    glow: 'rgba(124, 58, 237, 0.2)',
    isDark: true,
  },
  arcticLight: {
    name: 'Arctic Light',
    primary: '14, 165, 233',       // sky-500
    primaryHex: '#0EA5E9',
    accent: '20, 184, 166',        // teal-400
    accentHex: '#14B8A6',
    sidebarBg: '#f8fafc',          // slate-50
    sidebarText: '#334155',
    pageBg: '#f1f5f9',
    surface: '#ffffff',
    surfaceBorder: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    glow: 'rgba(14, 165, 233, 0.15)',
    isDark: false,
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem('skillscatch-theme') || 'default';
  });

  const theme = THEMES[themeKey] || THEMES.default;

  useEffect(() => {
    localStorage.setItem('skillscatch-theme', themeKey);
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-hex', theme.primaryHex);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-accent-hex', theme.accentHex);
    root.style.setProperty('--color-sidebar-bg', theme.sidebarBg);
    root.style.setProperty('--color-sidebar-text', theme.sidebarText);
    root.style.setProperty('--color-page-bg', theme.pageBg);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-surface-border', theme.surfaceBorder);
    root.style.setProperty('--color-text-primary', theme.textPrimary);
    root.style.setProperty('--color-text-secondary', theme.textSecondary);
    root.style.setProperty('--color-glow', theme.glow);
    root.dataset.theme = themeKey;
    root.classList.toggle('dark-theme', theme.isDark);
  }, [themeKey, theme]);

  const value = useMemo(() => ({ themeKey, setThemeKey, theme, themes: THEMES }), [themeKey, theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export { THEMES };
