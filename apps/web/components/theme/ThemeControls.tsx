"use client";

import { useId } from "react";
import { AUTO_SCHEDULE_LABEL, THEMES, THEME_IDS, detectTimeZone } from "@/lib/theme";
import type { ColorMode, ThemeId } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

const MODES: { mode: ColorMode; label: string; icon: string }[] = [
  { mode: "light", label: "Light", icon: "☀" },
  { mode: "dark", label: "Dark", icon: "☾" },
  { mode: "auto", label: "Auto", icon: "◐" },
];

/** Header controls: engineering theme dropdown and Light / Dark / Auto mode toggle. */
export function ThemeControls() {
  const { themeId, mode, resolvedMode, setThemeId, setMode } = useTheme();
  const selectId = useId();
  return (
    <div className="theme-controls">
      <label htmlFor={selectId} className="sr-only">
        Theme
      </label>
      <select
        id={selectId}
        className="theme-select"
        value={themeId}
        onChange={(e) => setThemeId(e.target.value as ThemeId)}
        title={THEMES[themeId].description}
      >
        {THEME_IDS.map((id) => (
          <option key={id} value={id}>
            {THEMES[id].name}
          </option>
        ))}
      </select>
      <div className="mode-toggle" role="group" aria-label="Color mode">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            title={
              m.mode === "auto"
                ? `Auto — by time of day in ${detectTimeZone()}: ${AUTO_SCHEDULE_LABEL} (now ${resolvedMode})`
                : `${m.label} mode`
            }
            onClick={() => setMode(m.mode)}
          >
            <span aria-hidden="true">{m.icon}</span> {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
