/**
 * WhatsApp-style doodle wallpaper for civil and structural engineering: a seamless tile of thin
 * line icons (beams, columns, trusses, cranes, bridges, hard hat, rulers, rebar …) mixed with
 * greyed-out engineering emojis. Generated in code so it follows the active theme and mode.
 * Presentation only.
 */

const TILE = 520;
const GRID = 6;
const CELL = TILE / GRID;
const ICON_BOX = 48;
/** Max centre offset from the cell centre, keeps every doodle inside its cell so the tile is seamless. */
const JITTER = 12;
const MAX_ROTATION_DEG = 24;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.1;
const EMOJI_SIZE = 30;
const STROKE_WIDTH = 1.8;
const SEED = 20260930;

/** 48×48 outline icons (stroke only). */
const ICONS: Record<string, string> = {
  iBeam: '<path d="M8 8h32v6H8zM21 14h6v20h-6zM8 34h32v6H8z"/>',
  column:
    '<path d="M18 6h12v30H18zM10 36h28v6H10z"/><circle cx="14" cy="39" r="1"/><circle cx="34" cy="39" r="1"/>',
  truss: '<path d="M4 36h40M4 36L24 10l20 26M14 23v13M24 10v26M34 23v13M14 23l10 13M34 23L24 36"/>',
  bridge:
    '<path d="M2 38h44M10 38V12M38 38V12M10 12Q24 34 38 12M2 26Q6 12 10 12M38 12Q42 12 46 26M17 38V24M24 38v-4M31 38V24"/>',
  crane:
    '<path d="M20 44V10M26 44V10M20 18h6M20 26h6M20 34h6M6 10h38M10 10v10M8 20h6v6H8zM26 10L32 4M20 10L32 4M32 10h12"/>',
  hardHat: '<path d="M8 30a16 16 0 0132 0M4 30h40v6H4zM22 14v9M26 14v9"/>',
  ruler:
    '<rect x="4" y="18" width="40" height="12" rx="1"/><path d="M10 18v5M16 18v7M22 18v5M28 18v7M34 18v5M40 18v7"/>',
  setSquare: '<path d="M8 40V8l32 32zM15 32V23l9 9z"/>',
  compass: '<circle cx="24" cy="6" r="2.5"/><path d="M24 9v4M24 13L11 43M24 13l13 30M17 31h14"/>',
  building:
    '<path d="M12 42V8h24v34M8 42h32M17 14h4M27 14h4M17 21h4M27 21h4M17 28h4M27 28h4M21 42v-7h6v7"/>',
  brickWall:
    '<rect x="6" y="10" width="36" height="28"/><path d="M6 19h36M6 29h36M18 10v9M30 10v9M12 19v10M24 19v10M36 19v10M18 29v9M30 29v9"/>',
  rcSection:
    '<rect x="10" y="10" width="28" height="28" rx="3"/><circle cx="16" cy="16" r="2.2"/><circle cx="32" cy="16" r="2.2"/><circle cx="16" cy="32" r="2.2"/><circle cx="32" cy="32" r="2.2"/><path d="M24 10v5M24 33v5"/>',
  hexNut: '<path d="M24 6l15 9v18l-15 9-15-9V15z"/><circle cx="24" cy="24" r="6"/>',
  level:
    '<rect x="4" y="18" width="40" height="12" rx="2"/><rect x="18" y="21" width="12" height="6" rx="3"/><path d="M24 21v6"/>',
  plumbBob: '<path d="M24 4v16M18 20h12l-6 22zM21 28h6"/>',
  excavator:
    '<path d="M6 36h28v6H6zM10 36v-9h14v9M24 29l9-16 9 10M33 13l-3-4M42 23l-2 7 5 2"/><circle cx="12" cy="42" r="2"/><circle cx="28" cy="42" r="2"/>',
  dimension: '<path d="M6 24h36M6 24l6-4M6 24l6 4M42 24l-6-4M42 24l-6 4M6 14v20M42 14v20"/>',
  udlBeam:
    '<path d="M6 32h36M6 32l-4 7h8zM42 32l-4 7h8zM10 12h28M12 12v14M18 12v14M24 12v14M30 12v14M36 12v14M10 26l2 4 2-4M22 26l2 4 2-4M34 26l2 4 2-4"/>',
  momentDiagram: '<path d="M6 8v34M6 24h38M6 24Q26 -2 44 24"/>',
  footing: '<path d="M20 6h8v18h-8zM8 24h32v8H8zM14 32v10M24 32v10M34 32v10"/>',
  cone: '<path d="M24 6l10 30H14zM10 40h28M17 24h14"/>',
  circularColumn:
    '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="13" r="1.6"/><circle cx="35" cy="24" r="1.6"/><circle cx="24" cy="35" r="1.6"/><circle cx="13" cy="24" r="1.6"/>',
  stairs: '<path d="M6 40h10V32h10V24h10V16h6M6 40h36M36 16v24"/>',
  sectionMark:
    '<path d="M6 24h36M10 14v20M38 14v20M10 14l-4 4M38 14l4 4"/><circle cx="24" cy="24" r="4"/>',
};

const EMOJIS = ["👷", "🏗️", "🧱", "📐", "📏", "🌉", "🏢", "🔩", "⛑️", "🚧", "🪜", "🏭", "⚙️", "🛠️"];

const EMOJI_FONTS = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

/** Deterministic PRNG so the wallpaper never changes between renders or builds. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export interface WallpaperOptions {
  /** Doodle stroke color (#rrggbb). */
  color: string;
  lineOpacity: number;
  emojiOpacity: number;
}

type Doodle = { kind: "icon"; name: string } | { kind: "emoji"; glyph: string };

/** Pool of doodles for the grid cells: every icon and emoji appears, the rest is filled by cycling. */
function doodleSequence(rand: () => number): Doodle[] {
  const pool: Doodle[] = [
    ...Object.keys(ICONS).map((name): Doodle => ({ kind: "icon", name })),
    ...EMOJIS.map((glyph): Doodle => ({ kind: "emoji", glyph })),
  ];
  const cells = GRID * GRID;
  const order = shuffled(pool, rand);
  return Array.from({ length: cells }, (_, i) => order[i % order.length] as Doodle);
}

/** Seamless doodle tile as SVG markup. */
export function buildWallpaperSvg({ color, lineOpacity, emojiOpacity }: WallpaperOptions): string {
  const rand = mulberry32(SEED);
  const sequence = doodleSequence(rand);
  const lines: string[] = [];
  const emojis: string[] = [];

  /** Doodles within this distance of a tile edge are drawn again on the opposite side (seamless wrap). */
  const WRAP_MARGIN = ICON_BOX;

  sequence.forEach((doodle, i) => {
    const row = Math.floor(i / GRID);
    // Alternate rows are shifted half a cell, like the scattered layout of a chat wallpaper.
    const stagger = row % 2 === 1 ? CELL / 2 : 0;
    const x =
      ((((i % GRID) * CELL + CELL / 2 + stagger + (rand() * 2 - 1) * JITTER) % TILE) + TILE) % TILE;
    const y = row * CELL + CELL / 2 + (rand() * 2 - 1) * JITTER;
    const rotation = (rand() * 2 - 1) * MAX_ROTATION_DEG;
    const scale = MIN_SCALE + rand() * (MAX_SCALE - MIN_SCALE);

    const xs = [x];
    if (x < WRAP_MARGIN) xs.push(x + TILE);
    if (x > TILE - WRAP_MARGIN) xs.push(x - TILE);
    xs.forEach((cx, copy) => {
      const place = `translate(${cx.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})`;
      const mark = copy > 0 ? ' data-copy="1"' : "";
      if (doodle.kind === "icon") {
        lines.push(
          `<g${mark} transform="${place} translate(${-ICON_BOX / 2} ${-ICON_BOX / 2})">${ICONS[doodle.name]}</g>`,
        );
      } else {
        emojis.push(
          `<text${mark} transform="${place}" text-anchor="middle" dominant-baseline="central" font-size="${EMOJI_SIZE}">${doodle.glyph}</text>`,
        );
      }
    });
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">` +
    `<defs><filter id="m"><feColorMatrix type="saturate" values="0"/></filter></defs>` +
    `<g fill="none" stroke="${color}" stroke-opacity="${lineOpacity}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${lines.join("")}</g>` +
    `<g filter="url(#m)" opacity="${emojiOpacity}" font-family="${EMOJI_FONTS}">${emojis.join("")}</g>` +
    `</svg>`
  );
}

/** CSS `url(...)` value for the wallpaper tile. */
export function wallpaperCssUrl(options: WallpaperOptions): string {
  return `url("data:image/svg+xml,${encodeURIComponent(buildWallpaperSvg(options))}")`;
}

export const WALLPAPER_TILE_PX = TILE;
export const WALLPAPER_DOODLE_COUNT = GRID * GRID;
export const WALLPAPER_ICON_NAMES = Object.keys(ICONS);
export const WALLPAPER_EMOJIS = EMOJIS;
