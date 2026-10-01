"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  isColorMode,
  isThemeId,
  paletteToCss,
} from "@/lib/theme";
import type { ColorMode, Palette, ResolvedMode, ThemeId } from "@/lib/theme";

interface ThemeContextValue {
  themeId: ThemeId;
  mode: ColorMode;
  resolvedMode: ResolvedMode;
  palette: Palette;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(callback: () => void) {
  const mq = window.matchMedia?.(DARK_QUERY);
  mq?.addEventListener("change", callback);
  return () => mq?.removeEventListener("change", callback);
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

function loadPreference(): { themeId: ThemeId; mode: ColorMode } {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { themeId?: unknown; mode?: unknown }) : {};
    return {
      themeId: isThemeId(parsed.themeId) ? parsed.themeId : DEFAULT_THEME,
      mode: isColorMode(parsed.mode) ? parsed.mode : DEFAULT_MODE,
    };
  } catch {
    return { themeId: DEFAULT_THEME, mode: DEFAULT_MODE };
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState(loadPreference);
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false);
  const resolvedMode: ResolvedMode =
    pref.mode === "auto" ? (systemDark ? "dark" : "light") : pref.mode;
  const palette = THEMES[pref.themeId][resolvedMode];

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(paletteToCss(palette)))
      root.style.setProperty(name, value);
    root.dataset.theme = pref.themeId;
    root.dataset.mode = resolvedMode;
    root.style.colorScheme = resolvedMode;
    root.style.backgroundColor = palette.bg;
  }, [palette, pref.themeId, resolvedMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(pref));
    } catch {
      // Storage unavailable: preference lasts for this session only.
    }
  }, [pref]);

  const setThemeId = useCallback((themeId: ThemeId) => setPref((p) => ({ ...p, themeId })), []);
  const setMode = useCallback((mode: ColorMode) => setPref((p) => ({ ...p, mode })), []);

  const value = useMemo(
    () => ({ themeId: pref.themeId, mode: pref.mode, resolvedMode, palette, setThemeId, setMode }),
    [pref, resolvedMode, palette, setThemeId, setMode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Theme access; falls back to the default light palette outside a provider (e.g. isolated tests). */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    themeId: DEFAULT_THEME,
    mode: "light",
    resolvedMode: "light",
    palette: THEMES[DEFAULT_THEME].light,
    setThemeId: () => undefined,
    setMode: () => undefined,
  };
}
