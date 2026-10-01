/**
 * Visual themes for the engineering workspace. Single source of truth for colors used by CSS
 * (as custom properties), the SVG plan and the three.js scene. Presentation only.
 */
export interface Palette {
  bg: string;
  panel: string;
  panelAlt: string;
  headerBg: string;
  ink: string;
  label: string;
  muted: string;
  line: string;
  inputLine: string;
  editable: string;
  track: string;
  shadow: string;
  overlayBg: string;
  accent: string;
  accentInk: string;
  accent2: string;
  accentText: string;
  accentSoft: string;
  green: string;
  greenBg: string;
  greenLine: string;
  amber: string;
  amberBg: string;
  amberLine: string;
  red: string;
  redBg: string;
  redLine: string;
  excel: string;
  // Drawing (plan + 3D)
  canvas: string;
  grid: string;
  axis: string;
  svgText: string;
  svgMuted: string;
  column: string;
  columnStroke: string;
  perimeter: string;
  gross: string;
  tangent: string;
  opening: string;
  openingStroke: string;
  centroid: string;
  critical: string;
  slab: string;
  slabEdge: string;
  gridMajor: string;
  gridMinor: string;
  fenceLine: string;
}

export type ThemeId = "structural" | "blueprint" | "concrete";
export type ColorMode = "light" | "dark" | "auto";
export type ResolvedMode = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  light: Palette;
  dark: Palette;
}

const STATUS_LIGHT = {
  green: "#16805b",
  greenBg: "#e9f7f0",
  greenLine: "#bfe5d4",
  amber: "#b7791f",
  amberBg: "#fff7e6",
  amberLine: "#f0d9a8",
  red: "#b42318",
  redBg: "#fff0ee",
  redLine: "#f2b8b5",
  excel: "#1d6f42",
};

const STATUS_DARK = {
  green: "#4cc38a",
  greenBg: "#12291f",
  greenLine: "#1f5139",
  amber: "#e0a84a",
  amberBg: "#2b2312",
  amberLine: "#5a4520",
  red: "#f07167",
  redBg: "#2d1717",
  redLine: "#5c2a28",
  excel: "#4cc38a",
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  structural: {
    id: "structural",
    name: "Structural Blue",
    description: "Default engineering workspace",
    light: {
      bg: "#f4f6f8",
      panel: "#ffffff",
      panelAlt: "#fafbfc",
      headerBg: "#ffffff",
      ink: "#17212b",
      label: "#35404a",
      muted: "#66727f",
      line: "#dbe1e6",
      inputLine: "#cfd7de",
      editable: "#fffdf2",
      track: "rgba(0, 0, 0, 0.08)",
      shadow: "0 8px 24px rgba(25, 45, 65, 0.08)",
      overlayBg: "rgba(255, 255, 255, 0.92)",
      accent: "#1f4e78",
      accentInk: "#ffffff",
      accent2: "#2f6f9f",
      accentText: "#1f4e78",
      accentSoft: "#e8f1f8",
      ...STATUS_LIGHT,
      canvas: "#fbfcfd",
      grid: "#edf0f3",
      axis: "#aab4be",
      svgText: "#35404a",
      svgMuted: "#66727f",
      column: "#dceaf5",
      columnStroke: "#1f4e78",
      perimeter: "#2f6f9f",
      gross: "#9aa7b3",
      tangent: "#d9776f",
      opening: "#fff0ee",
      openingStroke: "#b42318",
      centroid: "#1f4e78",
      critical: "#b42318",
      slab: "#c9d1d9",
      slabEdge: "#8a96a3",
      gridMajor: "#c5ccd3",
      gridMinor: "#e3e7eb",
      fenceLine: "#17212b",
    },
    dark: {
      bg: "#0f1720",
      panel: "#16202b",
      panelAlt: "#1b2733",
      headerBg: "#121b25",
      ink: "#e6edf3",
      label: "#c3ceda",
      muted: "#8b98a6",
      line: "#2a3744",
      inputLine: "#3a4a5a",
      editable: "#252616",
      track: "rgba(255, 255, 255, 0.1)",
      shadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
      overlayBg: "rgba(22, 32, 43, 0.92)",
      accent: "#2f6fa8",
      accentInk: "#ffffff",
      accent2: "#5b9bd5",
      accentText: "#7fb3e0",
      accentSoft: "#1d3347",
      ...STATUS_DARK,
      canvas: "#111a23",
      grid: "#1c2733",
      axis: "#46576a",
      svgText: "#c3ceda",
      svgMuted: "#8b98a6",
      column: "#1d3a55",
      columnStroke: "#7fb3e0",
      perimeter: "#7fb3e0",
      gross: "#6b7c8e",
      tangent: "#e08a80",
      opening: "#3a1d1d",
      openingStroke: "#f07167",
      centroid: "#7fb3e0",
      critical: "#f07167",
      slab: "#6c7a89",
      slabEdge: "#9aa8b6",
      gridMajor: "#3a4a5a",
      gridMinor: "#243240",
      fenceLine: "#e6edf3",
    },
  },
  blueprint: {
    id: "blueprint",
    name: "Blueprint",
    description: "Drafting-table blueprint drawing",
    light: {
      bg: "#e9f0f7",
      panel: "#fbfdff",
      panelAlt: "#f1f6fb",
      headerBg: "#fbfdff",
      ink: "#0e2a47",
      label: "#24456a",
      muted: "#5a7493",
      line: "#c7d7e8",
      inputLine: "#a9c1da",
      editable: "#fffbe6",
      track: "rgba(14, 42, 71, 0.1)",
      shadow: "0 8px 24px rgba(14, 42, 71, 0.1)",
      overlayBg: "rgba(251, 253, 255, 0.94)",
      accent: "#0b4f8c",
      accentInk: "#ffffff",
      accent2: "#1c6fd1",
      accentText: "#0b4f8c",
      accentSoft: "#dbe8f5",
      ...STATUS_LIGHT,
      canvas: "#123f6c",
      grid: "#1e5185",
      axis: "#8fb3d9",
      svgText: "#e8f2ff",
      svgMuted: "#a9c6e6",
      column: "#1d5a92",
      columnStroke: "#ffffff",
      perimeter: "#ffffff",
      gross: "#9cc0e6",
      tangent: "#ffd27a",
      opening: "#1a4f80",
      openingStroke: "#ffb38a",
      centroid: "#ffffff",
      critical: "#ff8a7a",
      slab: "#5d8fc2",
      slabEdge: "#cfe2f7",
      gridMajor: "#3f73a8",
      gridMinor: "#265b8f",
      fenceLine: "#ffffff",
    },
    dark: {
      bg: "#071a2e",
      panel: "#0c2540",
      panelAlt: "#0f2c4b",
      headerBg: "#09213a",
      ink: "#e3eefa",
      label: "#b8cfe6",
      muted: "#7f9bb8",
      line: "#1d3f63",
      inputLine: "#2b5179",
      editable: "#13304d",
      track: "rgba(255, 255, 255, 0.12)",
      shadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      overlayBg: "rgba(12, 37, 64, 0.94)",
      accent: "#2e7bd1",
      accentInk: "#ffffff",
      accent2: "#4ea1ff",
      accentText: "#8cc4ff",
      accentSoft: "#123a61",
      ...STATUS_DARK,
      canvas: "#0a3058",
      grid: "#144272",
      axis: "#6f9bc8",
      svgText: "#e3eefa",
      svgMuted: "#9dbbdb",
      column: "#174d82",
      columnStroke: "#ffffff",
      perimeter: "#ffffff",
      gross: "#8ab2dc",
      tangent: "#ffd27a",
      opening: "#173f68",
      openingStroke: "#ffb38a",
      centroid: "#ffffff",
      critical: "#ff8a7a",
      slab: "#3d6f9f",
      slabEdge: "#b8d4f2",
      gridMajor: "#2d5f91",
      gridMinor: "#173f68",
      fenceLine: "#ffffff",
    },
  },
  concrete: {
    id: "concrete",
    name: "Concrete & Rebar",
    description: "Warm concrete greys, rebar-orange accents",
    light: {
      bg: "#f2f1ee",
      panel: "#fdfcfa",
      panelAlt: "#f6f4f0",
      headerBg: "#fdfcfa",
      ink: "#2b2926",
      label: "#4a4641",
      muted: "#7a746c",
      line: "#dfdbd4",
      inputLine: "#cbc5bb",
      editable: "#fff8e8",
      track: "rgba(43, 41, 38, 0.1)",
      shadow: "0 8px 24px rgba(60, 50, 40, 0.08)",
      overlayBg: "rgba(253, 252, 250, 0.94)",
      accent: "#b45309",
      accentInk: "#ffffff",
      accent2: "#d97706",
      accentText: "#9a4a0b",
      accentSoft: "#fbecd9",
      ...STATUS_LIGHT,
      canvas: "#f7f6f3",
      grid: "#ebe8e2",
      axis: "#b5ada2",
      svgText: "#3f3b36",
      svgMuted: "#7a746c",
      column: "#e3ded6",
      columnStroke: "#57534e",
      perimeter: "#57534e",
      gross: "#a8a29e",
      tangent: "#d97706",
      opening: "#fdecea",
      openingStroke: "#b42318",
      centroid: "#57534e",
      critical: "#b42318",
      slab: "#bdb8b0",
      slabEdge: "#8f8a82",
      gridMajor: "#cbc5bb",
      gridMinor: "#e6e2db",
      fenceLine: "#2b2926",
    },
    dark: {
      bg: "#1b1a18",
      panel: "#24221f",
      panelAlt: "#2b2926",
      headerBg: "#201f1c",
      ink: "#ece8e1",
      label: "#cfc9bf",
      muted: "#9b948a",
      line: "#3a3732",
      inputLine: "#4b4741",
      editable: "#302a1d",
      track: "rgba(255, 255, 255, 0.1)",
      shadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      overlayBg: "rgba(36, 34, 31, 0.94)",
      accent: "#c2620f",
      accentInk: "#ffffff",
      accent2: "#f59e0b",
      accentText: "#f0a35c",
      accentSoft: "#3a2a18",
      ...STATUS_DARK,
      canvas: "#1f1e1b",
      grid: "#2c2a26",
      axis: "#5c5750",
      svgText: "#e6e1d9",
      svgMuted: "#9b948a",
      column: "#3b3833",
      columnStroke: "#d6d0c6",
      perimeter: "#d6d0c6",
      gross: "#8a847b",
      tangent: "#f0a35c",
      opening: "#3a1f1c",
      openingStroke: "#f07167",
      centroid: "#d6d0c6",
      critical: "#f07167",
      slab: "#8a857d",
      slabEdge: "#a9a399",
      gridMajor: "#4b4741",
      gridMinor: "#2f2d29",
      fenceLine: "#ece8e1",
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "structural";
export const DEFAULT_MODE: ColorMode = "auto";
export const THEME_STORAGE_KEY = "civil-platform:theme:v1";

/** camelCase palette key → CSS custom property name (accentSoft → --accent-soft). */
export function cssVarName(key: string): string {
  return `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

export function paletteToCss(palette: Palette): Record<string, string> {
  return Object.fromEntries(Object.entries(palette).map(([k, v]) => [cssVarName(k), v]));
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark" || value === "auto";
}

/** Converts "#rrggbb" to a number for three.js; falls back to mid grey for non-hex values. */
export function hexToNumber(color: string): number {
  return /^#[0-9a-f]{6}$/i.test(color) ? Number.parseInt(color.slice(1), 16) : 0x888888;
}

/**
 * Auto mode follows the local clock in the browser's detected timezone (not the OS setting):
 * light from AUTO_LIGHT_FROM_HOUR (inclusive) until AUTO_DARK_FROM_HOUR, dark otherwise.
 */
export const AUTO_LIGHT_FROM_HOUR = 7;
export const AUTO_DARK_FROM_HOUR = 19;

export function resolveAutoMode(now: Date): ResolvedMode {
  const hour = now.getHours();
  return hour >= AUTO_LIGHT_FROM_HOUR && hour < AUTO_DARK_FROM_HOUR ? "light" : "dark";
}

/** Next local 07:00 or 19:00 strictly after `now` (DST-safe: built from local calendar fields). */
export function nextAutoSwitch(now: Date): Date {
  const at = (dayOffset: number, hour: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 0, 0);
  const today = [at(0, AUTO_LIGHT_FROM_HOUR), at(0, AUTO_DARK_FROM_HOUR)];
  return today.find((c) => c.getTime() > now.getTime()) ?? at(1, AUTO_LIGHT_FROM_HOUR);
}

/** IANA timezone of the browser, e.g. "Europe/Berlin". */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
  } catch {
    return "local time";
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
export const AUTO_SCHEDULE_LABEL = `light ${pad(AUTO_LIGHT_FROM_HOUR)}:00–${pad(AUTO_DARK_FROM_HOUR)}:00, dark ${pad(AUTO_DARK_FROM_HOUR)}:00–${pad(AUTO_LIGHT_FROM_HOUR)}:00`;
