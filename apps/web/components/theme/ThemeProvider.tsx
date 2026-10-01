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
  nextAutoSwitch,
  paletteToCss,
  resolveAutoMode,
} from "@/lib/theme";
import { wallpaperCssUrl } from "@/lib/wallpaper";
import type { ColorMode, Palette, ResolvedMode, ThemeId } from "@/lib/theme";

interface ThemeContextValue {
  themeId: ThemeId;
  mode: ColorMode;
  resolvedMode: ResolvedMode;
  palette: Palette;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ColorMode) => void;
  /** Civil / structural engineering doodle wallpaper behind the dashboard. */
  wallpaper: boolean;
  setWallpaper: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Longest setTimeout delay browsers accept. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Small margin so the clock has certainly passed the boundary when the timer fires. */
const SWITCH_MARGIN_MS = 500;

/**
 * Clock subscription for Auto mode: notifies at every local 07:00 / 19:00 boundary, and on tab focus
 * or visibility change (covers laptop sleep, clock/timezone changes while the tab was in background).
 */
function subscribeClock(callback: () => void) {
  let timer: number | undefined;
  const arm = () => {
    window.clearTimeout(timer);
    const wait = nextAutoSwitch(new Date()).getTime() - Date.now() + SWITCH_MARGIN_MS;
    timer = window.setTimeout(wake, Math.min(Math.max(wait, SWITCH_MARGIN_MS), MAX_TIMEOUT_MS));
  };
  const wake = () => {
    callback();
    arm();
  };
  arm();
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
  };
}

interface Preference {
  themeId: ThemeId;
  mode: ColorMode;
  wallpaper: boolean;
}

function loadPreference(): Preference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as { themeId?: unknown; mode?: unknown; wallpaper?: unknown })
      : {};
    return {
      themeId: isThemeId(parsed.themeId) ? parsed.themeId : DEFAULT_THEME,
      mode: isColorMode(parsed.mode) ? parsed.mode : DEFAULT_MODE,
      wallpaper: typeof parsed.wallpaper === "boolean" ? parsed.wallpaper : true,
    };
  } catch {
    return { themeId: DEFAULT_THEME, mode: DEFAULT_MODE, wallpaper: true };
  }
}

/** Doodle strength per mode: subtle like a chat wallpaper, never competing with the content. */
const WALLPAPER_OPACITY = {
  light: { line: 0.3, emoji: 0.2 },
  dark: { line: 0.25, emoji: 0.17 },
} as const;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState(loadPreference);
  const timeMode = useSyncExternalStore(
    subscribeClock,
    () => resolveAutoMode(new Date()),
    () => "light" as const,
  );
  const resolvedMode: ResolvedMode = pref.mode === "auto" ? timeMode : pref.mode;
  const palette = THEMES[pref.themeId][resolvedMode];

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(paletteToCss(palette)))
      root.style.setProperty(name, value);
    root.dataset.theme = pref.themeId;
    root.dataset.mode = resolvedMode;
    root.style.colorScheme = resolvedMode;
    root.style.backgroundColor = palette.bg;
    root.style.setProperty(
      "--wallpaper",
      pref.wallpaper
        ? wallpaperCssUrl({
            color: palette.muted,
            lineOpacity: WALLPAPER_OPACITY[resolvedMode].line,
            emojiOpacity: WALLPAPER_OPACITY[resolvedMode].emoji,
          })
        : "none",
    );
  }, [palette, pref.themeId, pref.wallpaper, resolvedMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(pref));
    } catch {
      // Storage unavailable: preference lasts for this session only.
    }
  }, [pref]);

  const setThemeId = useCallback((themeId: ThemeId) => setPref((p) => ({ ...p, themeId })), []);
  const setMode = useCallback((mode: ColorMode) => setPref((p) => ({ ...p, mode })), []);
  const setWallpaper = useCallback(
    (wallpaper: boolean) => setPref((p) => ({ ...p, wallpaper })),
    [],
  );

  const value = useMemo(
    () => ({
      themeId: pref.themeId,
      mode: pref.mode,
      resolvedMode,
      palette,
      setThemeId,
      setMode,
      wallpaper: pref.wallpaper,
      setWallpaper,
    }),
    [pref, resolvedMode, palette, setThemeId, setMode, setWallpaper],
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
    wallpaper: false,
    setWallpaper: () => undefined,
  };
}
